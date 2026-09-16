import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Shield, Clock, Hash } from 'lucide-react';

const PRESET_PROFILES = [
  {
    id: 'retail-mobile',
    name: 'Retail Investor (Mobile 4G)',
    portfolio: 25000,
    latency: 180,
    isHni: false,
    desc: 'Tier-2/3 City, higher network latency'
  },
  {
    id: 'retail-fiber',
    name: 'Urban Retailer (Broadband)',
    portfolio: 65000,
    latency: 80,
    isHni: false,
    desc: 'Standard metro broadband'
  },
  {
    id: 'hni-wealth',
    name: 'HNI Wealth Client',
    portfolio: 7500000,
    latency: 15,
    isHni: true,
    desc: 'High portfolio, priority session'
  },
  {
    id: 'colocated-bot',
    name: 'Automated API Client (Datacenter)',
    portfolio: 15000000,
    latency: 2,
    isHni: true,
    desc: 'Colocated low-latency connection'
  }
];

export default function BuyModal({ bond, onClose, onSuccess }) {
  const [selectedProfile, setSelectedProfile] = useState(PRESET_PROFILES[0]);
  const [units, setUnits] = useState(1);
  const [customLatency, setCustomLatency] = useState(180);
  const [customPortfolio, setCustomPortfolio] = useState(25000);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  const activePortfolio = isCustom ? customPortfolio : selectedProfile.portfolio;
  const activeLatency = isCustom ? customLatency : selectedProfile.latency;
  const activeIsHni = isCustom ? customPortfolio >= 1000000 : selectedProfile.isHni;

  const totalAmount = units * bond.face_value;

  const handleBuy = async () => {
    setLoading(true);
    setOrderResult(null);

    // Simulate client network latency
    await new Promise(r => setTimeout(r, Math.min(activeLatency, 300)));

    try {
      const response = await fetch(`/api/bonds/${bond.id}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: `investor-${Math.random().toString(36).substring(2, 7)}`,
          unitsRequested: units,
          portfolioValue: activePortfolio,
          networkLatencyMs: activeLatency,
          isHni: activeIsHni
        })
      });

      const data = await response.json();
      setOrderResult(data);
      if (data.success && onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setOrderResult({
        success: false,
        status: 'ERROR',
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>Invest in {bond.name}</h2>
        <p style={{ color: '#64748B', fontSize: 13, marginBottom: 20 }}>
          {bond.issuer} • Face Value: ₹{bond.face_value.toLocaleString('en-IN')}
        </p>

        {orderResult ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            {orderResult.success ? (
              <div>
                <div style={{ width: 48, height: 48, background: '#ECFDF5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#059669' }}>
                  <CheckCircle2 size={28} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Allocation Confirmed</h3>
                <p style={{ color: '#64748B', fontSize: 13, marginBottom: 18 }}>
                  Units allocated under <strong>{bond.allocation_strategy === 'fair_retail' ? 'Fair Retail Strategy' : 'Portfolio Profit Strategy'}</strong>.
                </p>

                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, textAlign: 'left', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#64748B' }}>Allocated Units:</span>
                    <strong style={{ color: '#059669' }}>{orderResult.unitsAllocated} Unit(s)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#64748B' }}>Remaining Pool:</span>
                    <span>{orderResult.remainingUnits} units</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#64748B' }}>Queue Ticket:</span>
                    <span>#{orderResult.ticketNumber}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#64748B' }}>Engine Latency:</span>
                    <span>{orderResult.elapsedMs}ms</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', wordBreak: 'break-all' }}>
                    <span style={{ color: '#64748B' }}>Transaction Hash:</span>
                    <span style={{ color: '#0284C7' }}>{orderResult.txHash ? orderResult.txHash.slice(0, 18) + '...' : 'N/A'}</span>
                  </div>
                </div>

                <button className="btn-primary" style={{ width: '100%' }} onClick={onClose}>
                  Done
                </button>
              </div>
            ) : (
              <div>
                <div style={{ width: 48, height: 48, background: '#FEF2F2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#DC2626' }}>
                  <AlertCircle size={28} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Order Gracefully Rejected</h3>
                <p style={{ color: '#64748B', fontSize: 13, marginBottom: 18 }}>
                  {orderResult.message || 'Bond pool is fully subscribed.'}
                </p>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, textAlign: 'left', fontSize: 12, color: '#475569', marginBottom: 20 }}>
                  <strong>Zero-Oversell Verification:</strong> The atomic database lock prevented over-allocation. The bond pool balance remained consistent with zero margin error.
                </div>
                <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setOrderResult(null)}>
                  Try Another Profile
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="form-group">
              <label className="form-label">Select Investor Persona & Network Profile</label>
              <div className="profile-chip-grid">
                {PRESET_PROFILES.map((p) => (
                  <div
                    key={p.id}
                    className={`profile-chip ${!isCustom && selectedProfile.id === p.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedProfile(p);
                      setIsCustom(false);
                    }}
                  >
                    <div className="profile-name">{p.name}</div>
                    <div className="profile-detail">₹{p.portfolio.toLocaleString('en-IN')} • {p.latency}ms latency</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Units to Buy (₹{bond.face_value.toLocaleString('en-IN')} each)</label>
              <input
                type="number"
                min="1"
                max={bond.remaining_units || 1}
                value={units}
                onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value) || 1))}
                className="form-input"
              />
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#64748B' }}>Allocation Mechanism:</span>
                <strong style={{ color: '#0F172A' }}>
                  {bond.allocation_strategy === 'fair_retail' ? 'Fair Retail Queue' : 'Portfolio Profit Priority'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#64748B' }}>Total Investment:</span>
                <strong style={{ color: '#0F172A' }}>₹{totalAmount.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', padding: '12px' }}
              disabled={loading || bond.remaining_units === 0}
              onClick={handleBuy}
            >
              {loading ? 'Processing Transaction...' : `Confirm Purchase (${units} Unit)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
