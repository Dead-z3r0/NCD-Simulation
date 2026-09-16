const { EventEmitter } = require('node:events');
const { getBond, resetBondPool, getAuditReport } = require('../database');
const { TokenBucketRateLimiter } = require('../rateLimiter');
const { DistributedLockManager, ConcurrencyManager } = require('../concurrencyManager');

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING PHASE 1 CORE CONCURRENCY ENGINE TESTS');
  console.log('======================================================\n');

  // Test 1: Token Bucket Rate Limiter
  console.log('Test 1: Testing Token Bucket Rate Limiter...');
  const limiter = new TokenBucketRateLimiter({ rate: 10, capacity: 5 });
  let allowedCount = 0;
  let throttledCount = 0;

  for (let i = 0; i < 10; i++) {
    const res = limiter.tryConsume(1);
    if (res.allowed) allowedCount++;
    else throttledCount++;
  }

  console.log(`  -> Allowed: ${allowedCount}, Throttled: ${throttledCount}`);
  if (allowedCount !== 5 || throttledCount !== 5) {
    throw new Error(`Token Bucket failed: Expected 5 allowed & 5 throttled, got ${allowedCount}/${throttledCount}`);
  }
  console.log('  ✅ Test 1 Passed: Token Bucket strictly caps bursts.\n');

  // Test 2: Distributed Lock Manager
  console.log('Test 2: Testing Distributed Lock Mutex...');
  const lockMgr = new DistributedLockManager();
  const lock1 = await lockMgr.acquire('test:resource', 'client-A', 200);
  if (!lock1.acquired) throw new Error('Lock 1 acquisition failed');

  let lock2Acquired = false;
  const lock2Promise = lockMgr.acquire('test:resource', 'client-B', 100).then((res) => {
    lock2Acquired = res.acquired;
  });

  // Release lock 1
  lockMgr.release('test:resource', lock1.lockToken);
  await lock2Promise;

  if (!lock2Acquired) throw new Error('Lock 2 acquisition after release failed');
  console.log('  ✅ Test 2 Passed: Lock Handover & Mutex working correctly.\n');

  // Test 3: Zero Margin Error Stress Test (100 parallel buyers for 5 units)
  console.log('Test 3: Zero Margin Error Concurrency Stress Test...');
  const testBondId = 'bond-test-rush';
  
  // Create or reset a 5-unit test bond
  const { db, stmts } = require('../database');
  const existing = stmts.getBond.get(testBondId);
  if (!existing) {
    stmts.insertBond.run(
      testBondId, 'Test Micro-IPO', 'Test FinCorp', 'CRISIL AAA', 12.5, 12,
      'Monthly', 100000, 5, 5, 'fair_retail', 10000, 10000, 'OPEN', Date.now()
    );
  } else {
    resetBondPool(testBondId, 5);
  }

  const emitter = new EventEmitter();
  const manager = new ConcurrencyManager(emitter);

  console.log('  -> Firing 100 simultaneous concurrent purchase requests for 5 available units...');
  const promises = [];
  for (let i = 1; i <= 100; i++) {
    promises.push(
      manager.processPurchase({
        bondId: testBondId,
        userId: `user-${String(i).padStart(3, '0')}`,
        unitsRequested: 1,
        portfolioValue: Math.floor(Math.random() * 500000) + 10000,
        networkLatencyMs: Math.floor(Math.random() * 200) + 10
      })
    );
  }

  const results = await Promise.all(promises);
  const successes = results.filter(r => r.success);
  const rejections = results.filter(r => !r.success);

  console.log(`  -> Results: ${successes.length} Succeeded, ${rejections.length} Gracefully Rejected`);

  const audit = getAuditReport(testBondId);
  console.log('  -> Database Audit Report:', JSON.stringify(audit, null, 2));

  if (successes.length !== 5) {
    throw new Error(`Integrity Violation: Expected exactly 5 successes, got ${successes.length}`);
  }
  if (rejections.length !== 95) {
    throw new Error(`Integrity Violation: Expected exactly 95 rejections, got ${rejections.length}`);
  }
  if (audit.remaining_units !== 0) {
    throw new Error(`Integrity Violation: Remaining units should be 0, got ${audit.remaining_units}`);
  }
  if (audit.negative_balance_detected) {
    throw new Error('FATAL: Negative balance detected in database!');
  }
  if (audit.integrity_status !== 'VERIFIED_ZERO_MARGIN_ERROR') {
    throw new Error(`Audit check failed: ${audit.integrity_status}`);
  }

  console.log('  ✅ Test 3 Passed: EXACTLY 5 succeeded, 95 rejected, 0 negative balance, 0 margin error.\n');
  console.log('🎉 ALL PHASE 1 CORE CONCURRENCY TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
