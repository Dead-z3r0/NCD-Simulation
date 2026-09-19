/**
 * 10,000 Concurrent Users Benchmark Runner
 * Simulates high-contention rush on the last ₹10 Lakhs of an NCD bond offering.
 * Proves that exactly x succeed and 10,000 - x users are gracefully rejected with 0 margin error.
 */

const { EventEmitter } = require('node:events');
const { getBond, resetBondPool, getAuditReport, db, stmts } = require('../backend/database');
const { rateLimiterRegistry } = require('../backend/rateLimiter');
const { ConcurrencyManager } = require('../backend/concurrencyManager');

async function runBenchmark({
  bondId = 'bond-navi-10l',
  totalRequests = 10000,
  poolUnits = 10,
  strategy = 'fair_retail'
} = {}) {
  console.log('\n================================================================');
  console.log(`CONCURRENT USER ALLOCATION BENCHMARK`);
  console.log(`Strategy: [${strategy.toUpperCase()}]`);
  console.log(`Bond Pool: ${poolUnits} units (Last Rs. 10 Lakhs)`);
  console.log(`Contending Requests: ${totalRequests.toLocaleString()} investors`);
  console.log('================================================================\n');

  // 1. Reset pool to exact units
  resetBondPool(bondId, poolUnits);
  stmts.updateBondStrategy.run(strategy, 50000, 50000, bondId);
  rateLimiterRegistry.updateLimiter(bondId, 50000, 50000);

  const emitter = new EventEmitter();
  const manager = new ConcurrencyManager(emitter);

  // 2. Generate investor purchase requests
  console.log(`Generating ${totalRequests.toLocaleString()} investor profiles (Retailers + HNIs)...`);
  const requests = [];
  for (let i = 1; i <= totalRequests; i++) {
    const isHni = i % 10 === 0; // 10% HNIs, 90% Retailers
    const portfolioValue = isHni
      ? Math.floor(Math.random() * 5000000) + 1000000
      : Math.floor(Math.random() * 50000) + 15000;
    const networkLatencyMs = isHni
      ? Math.floor(Math.random() * 10) + 2
      : Math.floor(Math.random() * 200) + 50;

    requests.push({
      bondId,
      userId: `investor-${String(i).padStart(5, '0')}`,
      unitsRequested: 1,
      portfolioValue,
      networkLatencyMs,
      isHni
    });
  }

  // 3. Fire all requests in parallel
  console.log(`Executing ${totalRequests.toLocaleString()} concurrent buy requests against engine...`);
  const startTime = Date.now();

  const results = await Promise.all(
    requests.map(req => manager.processPurchase(req))
  );

  const durationMs = Date.now() - startTime;
  const throughput = Math.round((totalRequests / (durationMs / 1000)));

  const successes = results.filter(r => r.success);
  const rejections = results.filter(r => !r.success);

  console.log('\n----------------------------------------------------------------');
  console.log('BENCHMARK EXECUTION RESULTS');
  console.log('----------------------------------------------------------------');
  console.log(`Total Duration:        ${durationMs} ms`);
  console.log(`Engine Throughput:     ${throughput} requests/sec`);
  console.log(`Successful Orders:     ${successes.length} (Target: exactly ${poolUnits})`);
  console.log(`Graceful Rejections:   ${rejections.length} (Target: exactly ${totalRequests - poolUnits})`);

  console.log('\nAllocation Profile Breakdown:');
  successes.forEach((s, idx) => {
    console.log(`   Unit #${idx + 1}: Ticket #${s.ticketNumber} -> Allocated (Latency: ${s.elapsedMs}ms)`);
  });

  // 4. Strict Database Audit Ledger Verification
  console.log('\n----------------------------------------------------------------');
  console.log('DATABASE AUDIT & INTEGRITY CHECK');
  console.log('----------------------------------------------------------------');
  const audit = getAuditReport(bondId);
  console.log(JSON.stringify(audit, null, 2));

  // Verification Assertions
  const errors = [];
  if (successes.length !== poolUnits) {
    errors.push(`Integrity Failure: Expected ${poolUnits} successes, got ${successes.length}`);
  }
  if (rejections.length !== (totalRequests - poolUnits)) {
    errors.push(`Integrity Failure: Expected ${totalRequests - poolUnits} rejections, got ${rejections.length}`);
  }
  if (audit.remaining_units !== 0) {
    errors.push(`Integrity Failure: Remaining units must be 0, got ${audit.remaining_units}`);
  }
  if (audit.negative_balance_detected) {
    errors.push('CRITICAL INTEGRITY FAILURE: Negative balance detected in database!');
  }
  if (audit.oversold_count > 0) {
    errors.push(`CRITICAL INTEGRITY FAILURE: Oversold count is ${audit.oversold_count}!`);
  }
  if (audit.integrity_status !== 'VERIFIED_ZERO_MARGIN_ERROR') {
    errors.push(`Audit status failure: ${audit.integrity_status}`);
  }

  if (errors.length > 0) {
    console.error('\nBENCHMARK VERIFICATION FAILED:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  } else {
    console.log('\n================================================================');
    console.log('VERIFIED: ZERO MARGIN ERROR & ZERO DATABASE CORRUPTION');
    console.log(`Exactly ${poolUnits} units allocated. Exactly ${(totalRequests - poolUnits).toLocaleString()} gracefully rejected.`);
    console.log('Remaining balance: 0. Database corruption: 0.000%.');
    console.log('================================================================\n');
  }

  return { durationMs, throughput, successes: successes.length, rejections: rejections.length, audit };
}

// Allow CLI execution: node benchmark.js [strategy] [totalRequests]
if (require.main === module) {
  const strategyArg = process.argv[2] || 'fair_retail';
  const requestsArg = Number(process.argv[3]) || 10000;
  runBenchmark({
    bondId: 'bond-navi-10l',
    totalRequests: requestsArg,
    poolUnits: 10,
    strategy: strategyArg
  }).catch(err => {
    console.error('Benchmark crash:', err);
    process.exit(1);
  });
}

module.exports = { runBenchmark };
