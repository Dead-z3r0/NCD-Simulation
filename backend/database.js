const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'ncd_simulation.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
`);

// Schema Definition
db.exec(`
  CREATE TABLE IF NOT EXISTS bonds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    issuer TEXT NOT NULL,
    rating TEXT NOT NULL,
    irr REAL NOT NULL,
    tenor_months INTEGER NOT NULL,
    payout_frequency TEXT DEFAULT 'Monthly',
    face_value REAL NOT NULL,
    total_units INTEGER NOT NULL,
    remaining_units INTEGER NOT NULL CHECK(remaining_units >= 0),
    allocation_strategy TEXT DEFAULT 'fair_retail',
    rate_limit_per_sec INTEGER DEFAULT 500,
    rate_limit_burst INTEGER DEFAULT 1000,
    status TEXT DEFAULT 'OPEN',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    bond_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    units_requested INTEGER NOT NULL,
    units_allocated INTEGER NOT NULL,
    amount REAL NOT NULL,
    portfolio_value REAL NOT NULL,
    network_latency_ms INTEGER NOT NULL,
    queue_ticket INTEGER,
    status TEXT NOT NULL,
    reason TEXT,
    tx_hash TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(bond_id) REFERENCES bonds(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tx_bond_id ON transactions(bond_id);
  CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transactions(timestamp);
`);

// Prepared statements for maximum performance
const stmts = {
  getBond: db.prepare('SELECT * FROM bonds WHERE id = ?'),
  listBonds: db.prepare('SELECT * FROM bonds ORDER BY created_at DESC'),
  insertBond: db.prepare(`
    INSERT INTO bonds (
      id, name, issuer, rating, irr, tenor_months, payout_frequency,
      face_value, total_units, remaining_units, allocation_strategy,
      rate_limit_per_sec, rate_limit_burst, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateBondStrategy: db.prepare(`
    UPDATE bonds 
    SET allocation_strategy = ?, rate_limit_per_sec = ?, rate_limit_burst = ?
    WHERE id = ?
  `),
  resetBondPool: db.prepare(`
    UPDATE bonds 
    SET remaining_units = ?, total_units = ?, status = 'OPEN'
    WHERE id = ?
  `),
  updateBondStatus: db.prepare(`
    UPDATE bonds SET status = ? WHERE id = ?
  `),
  // Atomic decrement: ONLY succeeds if remaining_units >= requested units
  atomicDeductUnits: db.prepare(`
    UPDATE bonds 
    SET remaining_units = remaining_units - ?
    WHERE id = ? AND remaining_units >= ?
  `),
  insertTransaction: db.prepare(`
    INSERT INTO transactions (
      id, bond_id, user_id, units_requested, units_allocated,
      amount, portfolio_value, network_latency_ms, queue_ticket,
      status, reason, tx_hash, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  countTransactionsByBond: db.prepare(`
    SELECT 
      COUNT(*) as total_txs,
      SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful_txs,
      SUM(CASE WHEN status != 'SUCCESS' THEN 1 ELSE 0 END) as rejected_txs,
      SUM(CASE WHEN status = 'SUCCESS' THEN units_allocated ELSE 0 END) as total_units_sold,
      SUM(CASE WHEN status = 'SUCCESS' THEN amount ELSE 0 END) as total_amount_raised
    FROM transactions 
    WHERE bond_id = ?
  `),
  getRecentTransactions: db.prepare(`
    SELECT * FROM transactions 
    WHERE bond_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ?
  `),
  clearTransactionsForBond: db.prepare(`
    DELETE FROM transactions WHERE bond_id = ?
  `)
};

// Seed default bonds if empty
function seedInitialBonds() {
  const existing = stmts.listBonds.all();
  if (existing.length === 0) {
    const defaultBonds = [
      {
        id: 'bond-navi-10l',
        name: 'Navi Finserv High-Yield NCD (Last ₹10 Lakhs Rush)',
        issuer: 'Navi Finserv Limited',
        rating: 'CRISIL A+',
        irr: 11.80,
        tenor_months: 18,
        payout_frequency: 'Monthly',
        face_value: 100000,
        total_units: 10,
        remaining_units: 10,
        allocation_strategy: 'fair_retail',
        rate_limit_per_sec: 500,
        rate_limit_burst: 1000,
        status: 'OPEN',
        created_at: Date.now() - 3600000
      },
      {
        id: 'bond-edelweiss-50cr',
        name: 'Edelweiss Financial Senior Secured NCD',
        issuer: 'Edelweiss Financial Services',
        rating: 'CRISIL AA',
        irr: 10.95,
        tenor_months: 24,
        payout_frequency: 'Annual',
        face_value: 100000,
        total_units: 5000,
        remaining_units: 3420,
        allocation_strategy: 'portfolio_profit',
        rate_limit_per_sec: 1000,
        rate_limit_burst: 2000,
        status: 'OPEN',
        created_at: Date.now() - 7200000
      },
      {
        id: 'bond-muthoot-cap',
        name: 'Muthoot Capital Retail Diversified NCD',
        issuer: 'Muthoot Capital Services',
        rating: 'CRISIL AA+',
        irr: 10.45,
        tenor_months: 36,
        payout_frequency: 'Monthly',
        face_value: 10000,
        total_units: 10000,
        remaining_units: 7850,
        allocation_strategy: 'fair_retail',
        rate_limit_per_sec: 750,
        rate_limit_burst: 1500,
        status: 'OPEN',
        created_at: Date.now() - 10800000
      }
    ];

    for (const b of defaultBonds) {
      stmts.insertBond.run(
        b.id, b.name, b.issuer, b.rating, b.irr, b.tenor_months,
        b.payout_frequency, b.face_value, b.total_units, b.remaining_units,
        b.allocation_strategy, b.rate_limit_per_sec, b.rate_limit_burst,
        b.status, b.created_at
      );
    }
  }
}

seedInitialBonds();

module.exports = {
  db,
  stmts,
  getBond(id) {
    return stmts.getBond.get(id);
  },
  listBonds() {
    return stmts.listBonds.all();
  },
  createBond({ name, issuer, rating, irr, tenor_months, payout_frequency, face_value, total_units, allocation_strategy, rate_limit_per_sec, rate_limit_burst }) {
    const id = 'bond-' + crypto.randomUUID().slice(0, 8);
    const now = Date.now();
    stmts.insertBond.run(
      id, name, issuer, rating, Number(irr), Number(tenor_months),
      payout_frequency || 'Monthly', Number(face_value), Number(total_units),
      Number(total_units), allocation_strategy || 'fair_retail',
      Number(rate_limit_per_sec) || 500, Number(rate_limit_burst) || 1000,
      'OPEN', now
    );
    return stmts.getBond.get(id);
  },
  updateBondStrategy(id, strategy, rateLimitPerSec, burst) {
    stmts.updateBondStrategy.run(strategy, Number(rateLimitPerSec), Number(burst), id);
    return stmts.getBond.get(id);
  },
  resetBondPool(id, units) {
    stmts.resetBondPool.run(Number(units), Number(units), id);
    stmts.clearTransactionsForBond.run(id);
    return stmts.getBond.get(id);
  },
  recordTransaction({ id, bond_id, user_id, units_requested, units_allocated, amount, portfolio_value, network_latency_ms, queue_ticket, status, reason, tx_hash, timestamp }) {
    stmts.insertTransaction.run(
      id, bond_id, user_id, units_requested, units_allocated,
      amount, portfolio_value, network_latency_ms, queue_ticket,
      status, reason, tx_hash, timestamp
    );
  },
  /**
   * Atomic CAS deduction on SQLite engine level.
   * Returns { success: boolean, remaining: number }
   */
  atomicDeduct(bondId, unitsToDeduct) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const bond = stmts.getBond.get(bondId);
      if (!bond) {
        db.exec('ROLLBACK');
        return { success: false, reason: 'Bond not found', remaining: 0 };
      }
      if (bond.remaining_units < unitsToDeduct) {
        db.exec('ROLLBACK');
        return { success: false, reason: 'Sold out / Insufficient units', remaining: bond.remaining_units };
      }

      const info = stmts.atomicDeductUnits.run(unitsToDeduct, bondId, unitsToDeduct);
      if (info.changes === 0) {
        db.exec('ROLLBACK');
        return { success: false, reason: 'Concurrency conflict: units already claimed', remaining: bond.remaining_units };
      }

      const updated = stmts.getBond.get(bondId);
      if (updated.remaining_units === 0) {
        stmts.updateBondStatus.run('SOLD_OUT', bondId);
      }
      db.exec('COMMIT');
      return { success: true, remaining: updated.remaining_units };
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      return { success: false, reason: err.message, remaining: 0 };
    }
  },
  getAuditReport(bondId) {
    const bond = stmts.getBond.get(bondId);
    if (!bond) return null;
    const stats = stmts.countTransactionsByBond.get(bondId);
    const totalAllocated = stats.total_units_sold || 0;
    const expectedRemaining = bond.total_units - totalAllocated;
    const isExactMatch = bond.remaining_units === expectedRemaining && bond.remaining_units >= 0;

    return {
      bond_id: bond.id,
      bond_name: bond.name,
      total_units: bond.total_units,
      remaining_units: bond.remaining_units,
      units_sold: totalAllocated,
      successful_txs: stats.successful_txs || 0,
      rejected_txs: stats.rejected_txs || 0,
      total_txs: stats.total_txs || 0,
      total_amount_raised: stats.total_amount_raised || 0,
      integrity_status: isExactMatch ? 'VERIFIED_ZERO_MARGIN_ERROR' : 'CORRUPTED',
      negative_balance_detected: bond.remaining_units < 0,
      oversold_count: Math.max(0, totalAllocated - bond.total_units)
    };
  }
};
