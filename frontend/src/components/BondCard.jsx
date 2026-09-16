import React from 'react';
import { Award, ArrowRight, RotateCcw, Shield, Zap } from 'lucide-react';

export default function BondCard({ bond, onInvestClick, onResetClick }) {
  const percentSold = Math.min(100, Math.round(((bond.total_units - bond.remaining_units) / bond.total_units) * 100));
  const isSoldOut = bond.remaining_units === 0;

  return (
    <div className={`bond-item ${isSoldOut ? 'sold-out' : ''}`}>
      <div className="bond-top-row">
        <div className="bond-issuer-meta">
          <div className="bond-badges">
            <span className="badge-rating">
              {bond.rating}
            </span>
            <span className="badge-secured">Senior Secured</span>
            <span className="badge-strategy">
              {bond.allocation_strategy === 'fair_retail' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Shield size={12} /> Fair Retail Queue
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Zap size={12} /> Portfolio Priority
                </span>
              )}
            </span>
          </div>
          <h3 className="bond-name">{bond.name}</h3>
          <span className="bond-issuer">{bond.issuer}</span>
        </div>

        <button
          className="btn-secondary"
          title="Reset pool for stress testing"
          style={{ padding: '6px 10px', fontSize: 12 }}
          onClick={() => onResetClick(bond)}
        >
          <RotateCcw size={13} />
          Reset Pool
        </button>
      </div>

      <div className="bond-metrics-row">
        <div className="metric-col">
          <span className="label">Pre-Tax Return</span>
          <span className="val green">{bond.irr}% IRR</span>
        </div>
        <div className="metric-col">
          <span className="label">Tenor & Payout</span>
          <span className="val">{bond.tenor_months}M • {bond.payout_frequency}</span>
        </div>
        <div className="metric-col">
          <span className="label">Face Value</span>
          <span className="val">₹{bond.face_value.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="allocation-progress-wrapper">
        <div className="progress-labels">
          <span>
            <strong>{bond.remaining_units}</strong> of {bond.total_units} units remaining
          </span>
          <span>
            {isSoldOut ? '100% Subscribed' : `${percentSold}% Subscribed`}
          </span>
        </div>
        <div className="progress-track">
          <div
            className={`progress-fill ${isSoldOut ? 'sold-out' : ''}`}
            style={{ width: `${percentSold}%` }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#64748B' }}>
          Total Pool: <strong style={{ color: '#0F172A' }}>₹{((bond.total_units * bond.face_value) / 100000).toFixed(1)} Lakhs</strong>
        </div>

        <button
          className="btn-primary"
          disabled={isSoldOut}
          onClick={() => onInvestClick(bond)}
        >
          {isSoldOut ? 'Fully Subscribed' : 'Invest Now'}
          {!isSoldOut && <ArrowRight size={15} />}
        </button>
      </div>
    </div>
  );
}
