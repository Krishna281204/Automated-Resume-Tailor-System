import React, { useEffect, useRef } from 'react';

const STEP_ICONS = {
  '📂': 'extract',
  '🤖': 'analyze',
  '⚙️': 'compile',
  '🎉': 'done',
  '❌': 'error',
  '🚀': 'start',
  '✅': 'success',
  '📝': 'summary',
};

function StatusLine({ message, index }) {
  const isError = message.startsWith('❌');
  const isSuccess = message.startsWith('✅') || message.startsWith('🎉');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 'var(--radius-sm)',
        background: isError
          ? 'rgba(239, 68, 68, 0.06)'
          : isSuccess
          ? 'rgba(16, 185, 129, 0.06)'
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${
          isError
            ? 'rgba(239, 68, 68, 0.15)'
            : isSuccess
            ? 'rgba(16, 185, 129, 0.15)'
            : 'rgba(255,255,255,0.04)'
        }`,
        animation: 'slideInRight 0.3s ease both',
        animationDelay: `${index * 0.05}s`,
        opacity: 0,
        animationFillMode: 'forwards',
      }}
    >
      <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: '1px' }}>
        {message.slice(0, 2)}
      </span>
      <p style={{
        fontSize: '0.87rem',
        color: isError
          ? 'var(--accent-error)'
          : isSuccess
          ? 'var(--accent-success)'
          : 'var(--text-secondary)',
        lineHeight: 1.5,
      }}>
        {message.slice(2).trim()}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 20,
      height: 20,
      border: '2px solid rgba(99,102,241,0.2)',
      borderTopColor: 'var(--accent-primary)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      flexShrink: 0,
    }} />
  );
}

export default function StatusPanel({ updates, status }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [updates]);

  if (!updates || updates.length === 0) return null;

  const isRunning = status === 'running';
  const isDone = status === 'done';
  const isError = status === 'error';

  return (
    <div
      className="glass-card animate-fade-in-up"
      style={{ padding: '20px', marginTop: 8 }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        paddingBottom: 14,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {isRunning && <Spinner />}
        {isDone && <span style={{ fontSize: '1.2rem' }}>🎉</span>}
        {isError && <span style={{ fontSize: '1.2rem' }}>⚠️</span>}

        <div>
          <h3 style={{
            fontFamily: 'Outfit',
            fontSize: '1rem',
            fontWeight: 700,
            color: isDone
              ? 'var(--accent-success)'
              : isError
              ? 'var(--accent-error)'
              : 'var(--text-primary)',
          }}>
            {isRunning ? 'Processing…' : isDone ? 'Complete!' : 'Error Encountered'}
          </h3>
          {isRunning && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              This may take 30–120 seconds
            </p>
          )}
        </div>

        {/* Step counter */}
        <div style={{
          marginLeft: 'auto',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 10px',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          fontFamily: 'monospace',
        }}>
          {updates.length} step{updates.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Progress steps */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxHeight: 280,
        overflowY: 'auto',
        paddingRight: 4,
      }}>
        {updates.map((msg, i) => (
          <StatusLine key={i} message={msg} index={i} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
