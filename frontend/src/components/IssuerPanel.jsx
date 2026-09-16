import React, { useState } from 'react';
import { PlusCircle, Sliders, Shield, Zap, RotateCcw, CheckCircle } from 'lucide-react';
import { API_BASE } from '../config';

export default function IssuerPanel({ bonds, onBondCreated, onStrategyChanged }) {
  const [newBond, setNewBond] = useState({
    name: '',
    issuer: '',
    rating: 'CRISIL AA+',
    irr: 11.25,
    tenor_months: 24,
    payout_frequency: 'Monthly',
    face_value: 100000,
    total_units: 50,
    allocation_strategy: 'fair_retail',
    rate_limit_per_sec: 500,
    rate_limit_burst: 1000
  });

  const [selectedBondId, setSelectedBondId] = useState(bonds[0]?.id || '');
  const [strategy, setStrategy] = useState('fair_retail');
  const [rateLimitPerSec, setRateLimitPerSec] = useState(500);
  const [rateLimitBurst, setRateLimitBurst] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const currentBond = bonds.find(b => b.id === selectedBondId) || bonds[0];

  const handleCreateBond = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/bonds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBond)
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg('Bond offering created successfully and live in engine.');
        setNewBond({
          name: '',
          issuer: '',
          rating: 'CRISIL AA+',
          irr: 11.25,
          tenor_months: 24,
          payout_frequency: 'Monthly',
          face_value: 100000,
          total_units: 50,
          allocation_strategy: 'fair_retail',
          rate_limit_per_sec: 500,
          rate_limit_burst: 1000
        });
        if (onBondCreated) onBondCreated(data.bond);
      } else {
        setStatusMsg('Error: ' + (data.error || 'Failed to create bond'));
      }
    } catch (err) {
      setStatusMsg('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStrategy = async () => {
    if (!currentBond) return;
    setLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/bonds/${currentBond.id}/strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy,
          rateLimitPerSec: Number(rateLimitPerSec),
          rateLimitBurst: Number(rateLimitBurst)
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`Allocation strategy updated to [${strategy === 'fair_retail' ? 'Fair Retail' : 'Portfolio Profit'}] for ${currentBond.name}`);
        if (onStrategyChanged) onStrategyChanged(data.bond);
      }
    } catch (err) {
      setStatusMsg('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPool = async (units = 10) => {
    if (!currentBond) return;
    try {
      const res = await fetch(`${API_BASE}/api/bonds/${currentBond.id}/reset-stress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ units })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`Bond pool reset to exactly ${units} units (₹${(units * currentBond.face_value / 100000).toFixed(1)} Lakhs)`);
      }
    } catch (err) {
      setStatusMsg('Error: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 28 }}>
      {/* Left: Issue New Bond Form */}
      <div className="card-box">
        <div className="card-header-flex">
          <h2 className="card-title">
            <PlusCircle size={18} color="#059669" />
            Issue New Debt Offering
          </h2>
        </div>

        <form onSubmit={handleCreateBond}>
          <div className="form-group">
            <label className="form-label">Bond Offering Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Piramal Capital Senior Secured NCD"
              className="form-input"
              value={newBond.name}
              onChange={(e) => setNewBond({ ...newBond, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Issuer Entity</label>
              <input
                type="text"
                required
                placeholder="e.g. Piramal Finance Ltd"
                className="form-input"
                value={newBond.issuer}
                onChange={(e) => setNewBond({ ...newBond, issuer: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Credit Rating</label>
              <select
                className="form-select"
                value={newBond.rating}
                onChange={(e) => setNewBond({ ...newBond, rating: e.target.value })}
              >
                <option value="CRISIL AAA">CRISIL AAA</option>
                <option value="CRISIL AA+">CRISIL AA+</option>
                <option value="CRISIL AA">CRISIL AA</option>
                <option value="CRISIL A+">CRISIL A+</option>
                <option value="ICRA AA">ICRA AA</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">IRR (%)</label>
              <input
                type="number"
                step="0.05"
                required
                className="form-input"
                value={newBond.irr}
                onChange={(e) => setNewBond({ ...newBond, irr: parseFloat(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tenor (Months)</label>
              <input
                type="number"
                required
                className="form-input"
                value={newBond.tenor_months}
                onChange={(e) => setNewBond({ ...newBond, tenor_months: parseInt(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payout</label>
              <select
                className="form-select"
                value={newBond.payout_frequency}
                onChange={(e) => setNewBond({ ...newBond, payout_frequency: e.target.value })}
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
                <option value="Cumulative">Cumulative</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Face Value (₹)</label>
              <input
                type="number"
                required
                className="form-input"
                value={newBond.face_value}
                onChange={(e) => setNewBond({ ...newBond, face_value: parseInt(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Units</label>
              <input
                type="number"
                required
                className="form-input"
                value={newBond.total_units}
                onChange={(e) => setNewBond({ ...newBond, total_units: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Creating Offering...' : 'Publish Debt Offering'}
          </button>
        </form>
      </div>

      {/* Right: Allocation Strategy Switcher & Rate Limiter */}
      <div className="card-box">
        <div className="card-header-flex">
          <h2 className="card-title">
            <Sliders size={18} color="#059669" />
            Allocation Strategy & Rate Limiter Controls
          </h2>
        </div>

        {statusMsg && (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#065F46', marginBottom: 16 }}>
            {statusMsg}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Select Target Bond</label>
          <select
            className="form-select"
            value={selectedBondId}
            onChange={(e) => {
              setSelectedBondId(e.target.value);
              const found = bonds.find(b => b.id === e.target.value);
              if (found) {
                setStrategy(found.allocation_strategy);
                setRateLimitPerSec(found.rate_limit_per_sec);
                setRateLimitBurst(found.rate_limit_burst);
              }
            }}
          >
            {bonds.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.remaining_units} / {b.total_units} units)
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Switch Concurrency Control Strategy</label>
          
          {/* Strategy A: Fair Retail */}
          <div
            className={`strategy-radio-card ${strategy === 'fair_retail' ? 'selected' : ''}`}
            onClick={() => setStrategy('fair_retail')}
          >
            <Shield size={20} color="#059669" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>
                Fair Retail Strategy (Anti-Bot / Latency Normalized)
              </div>
              <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>
                Sequential fair ticket numbering and jitter buffering. Retailers with higher network latency are granted equal footing against low-latency automated bots.
              </div>
            </div>
          </div>

          {/* Strategy B: Portfolio Profit */}
          <div
            className={`strategy-radio-card ${strategy === 'portfolio_profit' ? 'selected' : ''}`}
            onClick={() => setStrategy('portfolio_profit')}
          >
            <Zap size={20} color="#D97706" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>
                Portfolio Profit Strategy (Session Wealth Weighted)
              </div>
              <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>
                Lock contention priority dynamically weighted by active session portfolio balance. Optimizes platform revenue and high-ticket capital allocation.
              </div>
            </div>
          </div>
        </div>

        {/* Rate Limiter Parameters */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
            Token Bucket Parameters
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#64748B' }}>Refill Rate:</span>
              <strong style={{ color: '#0F172A', fontFamily: 'JetBrains Mono' }}>{rateLimitPerSec} req/sec</strong>
            </div>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={rateLimitPerSec}
              onChange={(e) => setRateLimitPerSec(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#059669' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#64748B' }}>Burst Capacity:</span>
              <strong style={{ color: '#0F172A', fontFamily: 'JetBrains Mono' }}>{rateLimitBurst} tokens</strong>
            </div>
            <input
              type="range"
              min="200"
              max="10000"
              step="200"
              value={rateLimitBurst}
              onChange={(e) => setRateLimitBurst(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#059669' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={loading}
            onClick={handleUpdateStrategy}
          >
            Apply Strategy
          </button>
          <button
            className="btn-secondary"
            title="Reset to 10 units for testing"
            onClick={() => handleResetPool(10)}
          >
            <RotateCcw size={14} />
            Reset ₹10L Pool
          </button>
        </div>
      </div>
    </div>
  );
}
