import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import BondCard from './components/BondCard';
import BuyModal from './components/BuyModal';
import IssuerPanel from './components/IssuerPanel';
import TerminalLogs from './components/TerminalLogs';
import StressTestVisualizer from './components/StressTestVisualizer';
import { Layers } from 'lucide-react';

export default function App() {
  const [bonds, setBonds] = useState([]);
  const [activeView, setActiveView] = useState('marketplace'); // 'marketplace' | 'issuer' | 'benchmark'
  const [selectedBondForBuy, setSelectedBondForBuy] = useState(null);
  const [logs, setLogs] = useState([]);
  const [benchmarkState, setBenchmarkState] = useState({
    isRunning: false,
    progress: { percent: 0, completed: 0, successes: 0, rejections: 0, elapsedMs: 0 },
    result: null
  });

  // Fetch initial bonds via REST
  const fetchBonds = async () => {
    try {
      const res = await fetch('/api/bonds');
      const data = await res.json();
      if (data.success) {
        setBonds(data.bonds);
      }
    } catch (err) {
      console.error('Failed to fetch bonds:', err);
    }
  };

  useEffect(() => {
    fetchBonds();

    // Direct WebSocket connection to backend on port 4000 (with fallback to current host)
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:4000`;
    let ws;

    try {
      ws = new WebSocket(wsUrl);
    } catch (_) {
      ws = new WebSocket(`ws://${window.location.host}/ws`);
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'INIT') {
          setBonds(msg.bonds);
        } else if (msg.type === 'BOND_UPDATED') {
          setBonds(prev => prev.map(b => b.id === msg.bond.id ? msg.bond : b));
        } else if (msg.type === 'BOND_CREATED') {
          setBonds(prev => [msg.bond, ...prev]);
        } else if (msg.type === 'TERMINAL_LOG') {
          setLogs(prev => [...prev.slice(-300), msg.log]);
        } else if (msg.type === 'STRESS_TEST_PROGRESS') {
          setBenchmarkState(prev => ({
            ...prev,
            isRunning: true,
            progress: msg
          }));
        } else if (msg.type === 'BENCHMARK_RESULT') {
          setBenchmarkState(prev => ({
            ...prev,
            isRunning: false,
            result: msg
          }));
          fetchBonds();
        }
      } catch (e) {
        console.error('WS Parse Error:', e);
      }
    };

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleResetClick = async (bond) => {
    try {
      const res = await fetch(`/api/bonds/${bond.id}/reset-stress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ units: 10 })
      });
      const data = await res.json();
      if (data.success) {
        fetchBonds();
      }
    } catch (e) {
      console.error('Failed to reset pool:', e);
    }
  };

  const handleRunBenchmark = async (params) => {
    setBenchmarkState({
      isRunning: true,
      progress: { percent: 0, completed: 0, successes: 0, rejections: 0, elapsedMs: 0 },
      result: null
    });

    try {
      await fetch('/api/stress-test/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
    } catch (err) {
      console.error('Failed to trigger benchmark:', err);
      setBenchmarkState(prev => ({ ...prev, isRunning: false }));
    }
  };

  return (
    <div className="app-container">
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Clean Institutional Hero Banner (Image 2 style) */}
      <div className="hero-banner">
        <div className="hero-content">
          <div className="hero-eyebrow">Predictable returns.</div>
          <div className="hero-headline">Zero margin error allocation.</div>
          <p>
            Low-latency concurrency control engine modeling high-demand bond offerings. Features
            <strong> Token Bucket</strong> rate limiting, switchable <strong>Distributed Locking</strong> (Fair Retail vs Portfolio Profitability),
            and strict <strong>ACID transactional integrity</strong> under rapid concurrent surges.
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-label">Active Strategy</div>
            <div className="stat-value" style={{ fontSize: 15 }}>
              {bonds[0]?.allocation_strategy === 'fair_retail' ? 'Fair Retail' : 'Portfolio Profit'}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Integrity Status</div>
            <div className="stat-value green">
              Zero Margin Error
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Listed Offerings</div>
            <div className="stat-value">
              {bonds.length} NCDs
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Views */}
      {activeView === 'marketplace' && (
        <div className="dashboard-grid">
          {/* Left Column: Bond Offerings */}
          <div>
            <div className="card-header-flex">
              <h2 className="card-title">
                <Layers size={16} color="#059669" />
                Senior Secured NCD Offerings
              </h2>
              <span style={{ fontSize: 13, color: '#64748B' }}>
                Real-time inventory
              </span>
            </div>

            <div className="bonds-list">
              {bonds.map(bond => (
                <BondCard
                  key={bond.id}
                  bond={bond}
                  onInvestClick={(b) => setSelectedBondForBuy(b)}
                  onResetClick={handleResetClick}
                />
              ))}
            </div>
          </div>

          {/* Right Column: Terminal Logs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <TerminalLogs
              logs={logs}
              onClear={() => setLogs([])}
            />
          </div>
        </div>
      )}

      {activeView === 'issuer' && (
        <div>
          <IssuerPanel
            bonds={bonds}
            onBondCreated={() => fetchBonds()}
            onStrategyChanged={() => fetchBonds()}
          />
          <div style={{ marginTop: 28 }}>
            <TerminalLogs
              logs={logs}
              onClear={() => setLogs([])}
            />
          </div>
        </div>
      )}

      {activeView === 'benchmark' && (
        <div>
          <StressTestVisualizer
            bonds={bonds}
            benchmarkState={benchmarkState}
            onRunBenchmark={handleRunBenchmark}
          />
          <div style={{ marginTop: 28 }}>
            <TerminalLogs
              logs={logs}
              onClear={() => setLogs([])}
            />
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {selectedBondForBuy && (
        <BuyModal
          bond={selectedBondForBuy}
          onClose={() => setSelectedBondForBuy(null)}
          onSuccess={() => fetchBonds()}
        />
      )}
    </div>
  );
}
