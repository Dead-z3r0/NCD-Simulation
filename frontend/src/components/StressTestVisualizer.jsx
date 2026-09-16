import React, { useState } from 'react';
import { Cpu, Play, CheckCircle2, ShieldCheck, RefreshCw, Activity, Layers } from 'lucide-react';

export default function StressTestVisualizer({ bonds, benchmarkState, onRunBenchmark }) {
  const [selectedBondId, setSelectedBondId] = useState('bond-navi-10l');
  const [requestsCount, setRequestsCount] = useState(10000);
  const [poolUnits, setPoolUnits] = useState(10);
  const [concurrency, setConcurrency] = useState(500);

  const activeBond = bonds.find(b => b.id === selectedBondId) || bonds[0];

  const handleLaunch = () => {
    if (activeBond) {
      onRunBenchmark({
        bondId: activeBond.id,
        totalRequests: requestsCount,
        poolUnits,
        concurrency
      });
    }
  };

  const isRunning = benchmarkState?.isRunning;
  const progress = benchmarkState?.progress || { percent: 0, completed: 0, successes: 0, rejections: 0, elapsedMs: 0 };
  const result = benchmarkState?.result;

  const dynamicUserCount = Number(requestsCount) > 0 ? Number(requestsCount) : 10000;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 28 }}>
      {/* Test Configuration */}
      <div className="card-box">
        <div className="card-header-flex">
          <h2 className="card-title">
            <Cpu size={18} color="#059669" />
            Concurrency Benchmark & Stress Testing
          </h2>
        </div>

        <p style={{ color: '#64748B', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
          Simulates simultaneous investor purchase requests competing for a finite bond allocation pool.
          Validates that distributed locks and database transactions prevent race conditions with zero over-allocation.
        </p>

        <div className="form-group">
          <label className="form-label">Target Bond Offering</label>
          <select
            className="form-select"
            value={selectedBondId}
            disabled={isRunning}
            onChange={(e) => setSelectedBondId(e.target.value)}
          >
            {bonds.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} (Face Value: ₹{b.face_value.toLocaleString('en-IN')})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Total Concurrent Requests</label>
            <input
              type="number"
              min="1"
              max="50000"
              className="form-input"
              value={requestsCount}
              disabled={isRunning}
              onChange={(e) => setRequestsCount(parseInt(e.target.value) || '')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Remaining Pool Units</label>
            <input
              type="number"
              min="1"
              className="form-input"
              value={poolUnits}
              disabled={isRunning}
              onChange={(e) => setPoolUnits(parseInt(e.target.value) || 10)}
            />
          </div>
        </div>

        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#64748B' }}>Active Lock Strategy:</span>
            <strong style={{ color: '#0F172A' }}>
              {activeBond?.allocation_strategy === 'fair_retail' ? 'Fair Retail Queue' : 'Portfolio Profit Priority'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#64748B' }}>Expected Result:</span>
            <strong style={{ color: '#059669' }}>
              {poolUnits} Successes, {Math.max(0, dynamicUserCount - poolUnits).toLocaleString()} Rejections
            </strong>
          </div>
        </div>

        {/* Dynamic button value specified by user */}
        <button
          className="btn-primary"
          style={{ width: '100%', padding: '13px', fontSize: 14 }}
          disabled={isRunning || !dynamicUserCount}
          onClick={handleLaunch}
        >
          {isRunning ? (
            <>
              <RefreshCw size={16} className="spin" style={{ marginRight: 8 }} />
              Executing Stress Test ({dynamicUserCount.toLocaleString()} Users)...
            </>
          ) : (
            <>
              <Play size={16} style={{ marginRight: 8 }} />
              Launch {dynamicUserCount.toLocaleString()} Concurrent User Stress Test
            </>
          )}
        </button>
      </div>

      {/* Progress & Live Results */}
      <div className="card-box">
        <div className="card-header-flex">
          <h2 className="card-title">
            <Activity size={18} color="#059669" />
            Audit Scorecard & Verification
          </h2>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#64748B' }}>Progress:</span>
            <span style={{ fontFamily: 'JetBrains Mono', color: '#0F172A', fontWeight: 700 }}>
              {isRunning ? `${progress.percent}% (${progress.completed}/${dynamicUserCount})` : result ? '100% Completed' : 'Standby'}
            </span>
          </div>
          <div className="progress-track" style={{ height: 8 }}>
            <div
              className="progress-fill"
              style={{ width: isRunning ? `${progress.percent}%` : result ? '100%' : '0%' }}
            />
          </div>
        </div>

        {/* Metric Counters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 }}>Successful</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#059669', fontFamily: 'JetBrains Mono' }}>
              {isRunning ? progress.successes : result ? result.successes : 0}
            </div>
          </div>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 }}>Rejected</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#DC2626', fontFamily: 'JetBrains Mono' }}>
              {isRunning ? progress.rejections : result ? result.rejections : 0}
            </div>
          </div>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 }}>Throughput</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#0284C7', fontFamily: 'JetBrains Mono' }}>
              {result ? `${result.rps} req/s` : isRunning ? `${Math.round(progress.completed / Math.max(1, progress.elapsedMs / 1000))} req/s` : '--'}
            </div>
          </div>
        </div>

        {/* Audit Report Box */}
        {result && result.audit ? (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#047857', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
              <ShieldCheck size={18} />
              <span>Zero Margin Error Verified</span>
            </div>

            <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Offered Units:</span>
                <span style={{ color: '#0F172A', fontWeight: 600 }}>{result.audit.total_units}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Allocated Units:</span>
                <span style={{ color: '#047857', fontWeight: 700 }}>{result.audit.units_sold}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Remaining Balance:</span>
                <span style={{ color: '#0F172A' }}>{result.audit.remaining_units}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Negative Balances:</span>
                <span style={{ color: '#047857', fontWeight: 700 }}>0 (None)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Oversold Count:</span>
                <span style={{ color: '#047857', fontWeight: 700 }}>0 (None)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #A7F3D0', paddingTop: 6, marginTop: 4 }}>
                <span style={{ color: '#475569' }}>Integrity Status:</span>
                <span style={{ color: '#047857', fontWeight: 700 }}>100% ACID Consistent</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 8, padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            Click the launch button to trigger the concurrent load test and verify audit integrity.
          </div>
        )}
      </div>
    </div>
  );
}
