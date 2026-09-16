import React from 'react';
import { Layers, Building, Cpu, ShieldCheck } from 'lucide-react';

export default function Navbar({ activeView, setActiveView }) {
  return (
    <header className="navbar">
      <div className="brand-wrapper">
        <div className="brand-logo">
          {/* Authentic clean geometric green ribbon mark */}
          <svg width="34" height="28" viewBox="0 0 34 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 22L12 6H17L9 22H4Z" fill="#059669" />
            <path d="M14 22L22 6H27L19 22H14Z" fill="#10B981" />
            <path d="M24 22L29 12H34L29 22H24Z" fill="#34D399" />
          </svg>
        </div>
        <div>
          <div className="brand-title">
            Debt<span>Engine</span>
            <span className="brand-tag">NCD Allocation</span>
          </div>
        </div>
      </div>

      <div className="nav-actions">
        <div className="mode-pills">
          <button
            className={`mode-pill ${activeView === 'marketplace' ? 'active' : ''}`}
            onClick={() => setActiveView('marketplace')}
          >
            <Layers size={15} />
            Investor View
          </button>
          <button
            className={`mode-pill ${activeView === 'issuer' ? 'active' : ''}`}
            onClick={() => setActiveView('issuer')}
          >
            <Building size={15} />
            Issuer Hub
          </button>
          <button
            className={`mode-pill ${activeView === 'benchmark' ? 'active' : ''}`}
            onClick={() => setActiveView('benchmark')}
          >
            <Cpu size={15} />
            Stress Test
          </button>
        </div>
      </div>
    </header>
  );
}
