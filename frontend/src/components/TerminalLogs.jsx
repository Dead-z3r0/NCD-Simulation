import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, ArrowDownCircle } from 'lucide-react';

export default function TerminalLogs({ logs, onClear }) {
  const [filter, setFilter] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalBodyRef = useRef(null);

  useEffect(() => {
    if (autoScroll && terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    if (filter === 'SUCCESS') return log.type === 'ALLOCATION_SUCCESS';
    if (filter === 'REJECTED') return log.type === 'ALLOCATION_REJECTED' || log.type === 'RATE_LIMIT_THROTTLED';
    if (filter === 'LOCK') return log.type === 'LOCK_ACQUIRED';
    if (filter === 'BENCHMARK') return log.type.includes('BENCHMARK');
    return true;
  });

  return (
    <div className="terminal-window">
      <div className="terminal-header">
        <div className="terminal-title-group">
          <Terminal size={14} color="#10B981" />
          <span>REAL-TIME AUDIT LOGS</span>
          <span style={{ fontSize: 11, color: '#64748B', marginLeft: 6 }}>({filteredLogs.length} events)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 2, background: '#070B12', padding: 2, borderRadius: 4, border: '1px solid #1E293B' }}>
            {['ALL', 'SUCCESS', 'REJECTED', 'LOCK', 'BENCHMARK'].map(f => (
              <button
                key={f}
                style={{
                  background: filter === f ? '#059669' : 'transparent',
                  color: filter === f ? '#FFFFFF' : '#94A3B8',
                  border: 'none',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '3px 6px',
                  borderRadius: 3,
                  cursor: 'pointer'
                }}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: autoScroll ? '#10B981' : '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title={autoScroll ? 'Auto-scroll is on' : 'Auto-scroll is off'}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            <ArrowDownCircle size={14} />
          </button>

          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Clear logs"
            onClick={onClear}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="terminal-body" ref={terminalBodyRef}>
        {filteredLogs.length === 0 ? (
          <div style={{ color: '#475569', textAlign: 'center', padding: '40px 0' }}>
            Awaiting concurrency events or load test transactions...
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const time = new Date(log.timestamp).toISOString().split('T')[1].slice(0, 12);
            return (
              <div key={log.id || idx} className="terminal-line">
                <span className="log-time">[{time}]</span>
                <span className={`log-tag tag-${log.type}`}>[{log.type}]</span>
                <span className="log-msg">{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
