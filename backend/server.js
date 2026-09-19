const express = require('express');
const http = require('node:http');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');

const {
  listBonds,
  getBond,
  createBond,
  updateBondStrategy,
  resetBondPool,
  getAuditReport,
  stmts
} = require('./database');
const { rateLimiterRegistry } = require('./rateLimiter');
const { ConcurrencyManager } = require('./concurrencyManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Event bus for real-time WebSocket distribution
const eventBus = new EventEmitter();
const concurrencyManager = new ConcurrencyManager(eventBus);

// WebSocket Broadcast Helper
function broadcast(payload) {
  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

const recentLogs = [];

// Log subscriber: stream every concurrency event to connected WebSocket clients
eventBus.on('log', (logEntry) => {
  recentLogs.push(logEntry);
  if (recentLogs.length > 500) {
    const successes = recentLogs.filter(l => l.type === 'ALLOCATION_SUCCESS');
    const others = recentLogs.filter(l => l.type !== 'ALLOCATION_SUCCESS');
    recentLogs.length = 0;
    recentLogs.push(...successes.slice(-150), ...others.slice(-350));
  }
  broadcast({
    type: 'TERMINAL_LOG',
    log: logEntry
  });
});

// WebSocket Connection Handler
wss.on('connection', (ws) => {
  // Send initial snapshot including recent logs
  const bonds = listBonds();
  ws.send(JSON.stringify({
    type: 'INIT',
    bonds,
    logs: recentLogs,
    timestamp: Date.now()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (_) {}
  });
});

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. Get all bonds
app.get('/api/bonds', (req, res) => {
  try {
    const bonds = listBonds().map((b) => {
      const limiter = rateLimiterRegistry.getLimiter(b.id, b.rate_limit_per_sec, b.rate_limit_burst);
      return {
        ...b,
        rateLimiterMetrics: limiter.getMetrics(),
        queueStatus: concurrencyManager.getQueueStatus(b.id)
      };
    });
    res.json({ success: true, bonds });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get specific bond details with audit and recent transactions
app.get('/api/bonds/:id', (req, res) => {
  try {
    const bond = getBond(req.params.id);
    if (!bond) return res.status(404).json({ success: false, error: 'Bond not found' });

    const audit = getAuditReport(bond.id);
    const recentTransactions = stmts.getRecentTransactions.all(bond.id, 50);
    const limiter = rateLimiterRegistry.getLimiter(bond.id, bond.rate_limit_per_sec, bond.rate_limit_burst);

    res.json({
      success: true,
      bond,
      audit,
      rateLimiterMetrics: limiter.getMetrics(),
      queueStatus: concurrencyManager.getQueueStatus(bond.id),
      recentTransactions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Issuer creates a new bond IPO
app.post('/api/bonds', (req, res) => {
  try {
    const {
      name,
      issuer,
      rating,
      irr,
      tenor_months,
      payout_frequency,
      face_value,
      total_units,
      allocation_strategy,
      rate_limit_per_sec,
      rate_limit_burst
    } = req.body;

    if (!name || !issuer || !face_value || !total_units) {
      return res.status(400).json({ success: false, error: 'Missing required bond parameters' });
    }

    const newBond = createBond({
      name,
      issuer,
      rating: rating || 'CRISIL AA',
      irr: Number(irr) || 11.0,
      tenor_months: Number(tenor_months) || 24,
      payout_frequency: payout_frequency || 'Monthly',
      face_value: Number(face_value),
      total_units: Number(total_units),
      allocation_strategy: allocation_strategy || 'fair_retail',
      rate_limit_per_sec: Number(rate_limit_per_sec) || 500,
      rate_limit_burst: Number(rate_limit_burst) || 1000
    });

    concurrencyManager.emitLog('BOND_CREATED', `Issuer created new bond: ${newBond.name} (${newBond.total_units} units)`, {
      bondId: newBond.id,
      faceValue: newBond.face_value,
      totalUnits: newBond.total_units,
      strategy: newBond.allocation_strategy
    });

    broadcast({ type: 'BOND_CREATED', bond: newBond });
    res.status(201).json({ success: true, bond: newBond });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Issuer updates Allocation Strategy & Rate Limiting Parameters
app.post('/api/bonds/:id/strategy', (req, res) => {
  try {
    const { strategy, rateLimitPerSec, rateLimitBurst } = req.body;
    const bond = getBond(req.params.id);
    if (!bond) return res.status(404).json({ success: false, error: 'Bond not found' });

    const updated = updateBondStrategy(
      bond.id,
      strategy || bond.allocation_strategy,
      rateLimitPerSec || bond.rate_limit_per_sec,
      rateLimitBurst || bond.rate_limit_burst
    );

    // Update live limiter
    rateLimiterRegistry.updateLimiter(bond.id, updated.rate_limit_per_sec, updated.rate_limit_burst);

    concurrencyManager.emitLog('STRATEGY_UPDATED', `Allocation Strategy changed to [${updated.allocation_strategy.toUpperCase()}]. Rate limit: ${updated.rate_limit_per_sec} req/s, Burst: ${updated.rate_limit_burst}`, {
      bondId: bond.id,
      strategy: updated.allocation_strategy,
      rateLimitPerSec: updated.rate_limit_per_sec,
      rateLimitBurst: updated.rate_limit_burst
    });

    broadcast({ type: 'BOND_UPDATED', bond: updated });
    res.json({ success: true, bond: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Reset Bond Pool & clear transactions (For Stress Testing & Reproducible Benchmarks)
app.post('/api/bonds/:id/reset-stress', (req, res) => {
  try {
    const bond = getBond(req.params.id);
    if (!bond) return res.status(404).json({ success: false, error: 'Bond not found' });

    const units = req.body.units !== undefined ? Number(req.body.units) : 10;
    const resetBond = resetBondPool(bond.id, units);
    rateLimiterRegistry.resetLimiter(bond.id);

    concurrencyManager.emitLog('POOL_RESET', `Bond pool reset to exactly ${units} units for benchmark stress test.`, {
      bondId: bond.id,
      totalUnits: units,
      remainingUnits: units
    });

    broadcast({ type: 'BOND_UPDATED', bond: resetBond });
    res.json({ success: true, bond: resetBond });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. High-concurrency Purchase Endpoint
app.post('/api/bonds/:id/buy', async (req, res) => {
  try {
    const bondId = req.params.id;
    const {
      userId = 'user-' + crypto.randomUUID().slice(0, 6),
      unitsRequested = 1,
      portfolioValue = 25000,
      networkLatencyMs = 40,
      isHni = false
    } = req.body;

    const result = await concurrencyManager.processPurchase({
      bondId,
      userId,
      unitsRequested: Number(unitsRequested),
      portfolioValue: Number(portfolioValue),
      networkLatencyMs: Number(networkLatencyMs),
      isHni: Boolean(isHni)
    });

    const updatedBond = getBond(bondId);
    broadcast({ type: 'BOND_UPDATED', bond: updatedBond });

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(result.status === 'REJECTED_RATE_LIMITED' ? 429 : 409).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Verified Zero-Margin Error Audit Endpoint
app.get('/api/audit/:id', (req, res) => {
  try {
    const audit = getAuditReport(req.params.id);
    if (!audit) return res.status(404).json({ success: false, error: 'Bond not found' });
    res.json({ success: true, audit });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Trigger Concurrent User Load Test Directly via API
let isBenchmarkRunning = false;
app.post('/api/stress-test/run', async (req, res) => {
  if (isBenchmarkRunning) {
    return res.status(409).json({ success: false, error: 'Benchmark is already executing' });
  }

  const bondId = req.body.bondId || 'bond-navi-10l';
  const totalRequests = Number(req.body.totalRequests) || 10000;
  const poolUnits = Number(req.body.poolUnits) || 10;
  const concurrency = Number(req.body.concurrency) || 500;

  const bond = getBond(bondId);
  if (!bond) return res.status(404).json({ success: false, error: 'Bond not found' });

  // Reset pool to exact units first
  const resetBond = resetBondPool(bondId, poolUnits);
  // Relax rate limiter during stress test so we test the lock/queue race conditions directly
  rateLimiterRegistry.updateLimiter(bondId, 50000, 50000);
  rateLimiterRegistry.resetLimiter(bondId);

  isBenchmarkRunning = true;
  res.json({
    success: true,
    message: `Started benchmark with ${totalRequests} concurrent requests against pool of ${poolUnits} units`,
    targetBond: bond.name
  });

  // Run asynchronously and broadcast progress
  (async () => {
    try {
      const startTime = Date.now();
      concurrencyManager.emitLog('BENCHMARK_STARTED', `Initiating ${totalRequests.toLocaleString()} concurrent request simulation on ${bond.name} (${poolUnits} units remaining)...`, {
        totalRequests,
        poolUnits,
        strategy: bond.allocation_strategy
      });

      let completed = 0;
      let successes = 0;
      let rejections = 0;
      const queue = [];

      for (let i = 1; i <= totalRequests; i++) {
        // Retailers: 90% have normal portfolio (10k-50k) and 50-200ms latency
        // HNIs: 10% have high portfolio (10L-1Cr) and low latency
        const isHni = i % 10 === 0;
        const portfolioValue = isHni ? Math.floor(Math.random() * 5000000) + 1000000 : Math.floor(Math.random() * 50000) + 10000;
        const networkLatencyMs = isHni ? Math.floor(Math.random() * 10) + 2 : Math.floor(Math.random() * 200) + 40;

        queue.push({
          userId: `trader-${String(i).padStart(5, '0')}`,
          portfolioValue,
          networkLatencyMs,
          isHni
        });
      }

      // Execute in concurrent worker batches
      let index = 0;
      const workerCount = Math.min(concurrency, 200);

      async function worker() {
        while (index < queue.length) {
          const item = queue[index++];
          try {
            const res = await concurrencyManager.processPurchase({
              bondId,
              userId: item.userId,
              unitsRequested: 1,
              portfolioValue: item.portfolioValue,
              networkLatencyMs: item.networkLatencyMs,
              isHni: item.isHni
            });
            if (res.success) successes++;
            else rejections++;
          } catch (_) {
            rejections++;
          }
          completed++;

          if (completed % 500 === 0 || completed === totalRequests) {
            broadcast({
              type: 'STRESS_TEST_PROGRESS',
              completed,
              total: totalRequests,
              percent: Math.round((completed / totalRequests) * 100),
              successes,
              rejections,
              elapsedMs: Date.now() - startTime
            });
          }
        }
      }

      const workers = Array.from({ length: workerCount }, () => worker());
      await Promise.all(workers);

      const durationMs = Date.now() - startTime;
      const audit = getAuditReport(bondId);

      concurrencyManager.emitLog('BENCHMARK_COMPLETED', `Benchmark completed in ${durationMs}ms: ${successes} succeeded, ${rejections} rejected. Audit status: ${audit.integrity_status}`, {
        totalRequests,
        successes,
        rejections,
        durationMs,
        audit
      });

      broadcast({
        type: 'BENCHMARK_RESULT',
        durationMs,
        successes,
        rejections,
        audit,
        rps: Math.round((totalRequests / (durationMs / 1000)))
      });
    } catch (err) {
      console.error('Benchmark execution error:', err);
    } finally {
      isBenchmarkRunning = false;
      const updated = getBond(bondId);
      broadcast({ type: 'BOND_UPDATED', bond: updated });
    }
  })();
});

// Periodic heartbeat & metrics broadcast (every 1s)
setInterval(() => {
  const bonds = listBonds();
  broadcast({
    type: 'METRICS_TICK',
    timestamp: Date.now(),
    bonds: bonds.map(b => ({
      id: b.id,
      remaining_units: b.remaining_units,
      rateLimiter: rateLimiterRegistry.getLimiter(b.id).getMetrics(),
      queue: concurrencyManager.getQueueStatus(b.id)
    }))
  });
}, 1000);

// Start server
server.listen(PORT, () => {
  console.log(`NCD Concurrency Engine Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket stream active on ws://localhost:${PORT}`);
});
