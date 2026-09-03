import React, { useState, useRef } from 'react';

/**
 * CompilationFailedPanel
 *
 * Shown when pdflatex compilation fails after the AI has successfully
 * modified the .tex source. Offers three recovery paths:
 *
 *  1. Open in Overleaf  — uses Overleaf's official "Open in Overleaf" form
 *     POST API (https://www.overleaf.com/docs). Posts the main .tex content
 *     directly; Overleaf creates a new project and opens it in a new tab.
 *
 *  2. Copy LaTeX        — copies the main .tex content to the clipboard.
 *
 *  3. Download .tex ZIP — downloads all modified source files as a ZIP.
 */
export default function CompilationFailedPanel({ jobId, apiBase, summary }) {
  const [copyState, setCopyState] = useState('idle'); // 'idle' | 'copying' | 'copied' | 'error'
  const [overleafState, setOverleafState] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const formRef = useRef(null);
  const texContentRef = useRef('');

  const latexUrl = `${apiBase}/api/latex/${jobId}`;
  const texZipUrl = `${apiBase}/api/tex/${jobId}`;

  // ── Copy to clipboard ──────────────────────────────────────────────────────
  const handleCopy = async () => {
    setCopyState('copying');
    try {
      const res = await fetch(latexUrl);
      if (!res.ok) throw new Error('Failed to fetch LaTeX source');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2500);
    } catch (err) {
      console.error(err);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 3000);
    }
  };

  // ── Open in Overleaf ───────────────────────────────────────────────────────
  // Uses the official Overleaf "Open in Overleaf" POST form API.
  // POST to https://www.overleaf.com/docs with:
  //   snip_name  — project name shown in Overleaf
  //   snip       — full .tex source content
  // Overleaf creates a new project and opens it instantly in a new tab.
  const handleOpenOverleaf = async () => {
    setOverleafState('loading');
    try {
      const res = await fetch(latexUrl);
      if (!res.ok) throw new Error('Failed to fetch LaTeX source');
      texContentRef.current = await res.text();
      setOverleafState('ready');

      // Small tick to let React re-render the hidden form before we submit
      setTimeout(() => {
        formRef.current?.submit();
        setOverleafState('idle');
      }, 50);
    } catch (err) {
      console.error(err);
      setOverleafState('error');
      setTimeout(() => setOverleafState('idle'), 3000);
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const btnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    fontFamily: 'Outfit',
    fontSize: '0.9rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all var(--transition-base)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  };

  const overleafBtn = {
    ...btnBase,
    color: '#fff',
    background: 'linear-gradient(135deg, #4CAF50, #2e7d32)',
    boxShadow: '0 4px 16px rgba(76,175,80,0.35)',
  };

  const copyBtn = {
    ...btnBase,
    color: '#fff',
    background: copyState === 'copied'
      ? 'rgba(16,185,129,0.25)'
      : copyState === 'error'
      ? 'rgba(239,68,68,0.2)'
      : 'rgba(99,102,241,0.15)',
    border: `1px solid ${
      copyState === 'copied' ? 'rgba(16,185,129,0.4)'
      : copyState === 'error' ? 'rgba(239,68,68,0.4)'
      : 'rgba(99,102,241,0.3)'
    }`,
  };

  const downloadBtn = {
    ...btnBase,
    color: '#fff',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.35)',
  };

  return (
    <div
      className="glass-card animate-fade-in-up"
      style={{ padding: '24px 28px', border: '1px solid rgba(16,185,129,0.2)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(16,185,129,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem', flexShrink: 0,
        }}>🎉</div>
        <div>
          <p style={{ fontFamily: 'Outfit', fontWeight: 700, color: 'var(--accent-success)', marginBottom: 2 }}>
            Resume Tailored Successfully!
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            The AI has modified your resume. You can now compile it.
          </p>
        </div>
      </div>

      {/* AI summary if available */}
      {summary && (
        <div style={{
          padding: '12px 14px',
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 18,
        }}>
          <p style={{
            fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5,
          }}>AI Modification Summary</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {summary}
          </p>
        </div>
      )}

      {/* CTA description */}
      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.65 }}>
        The modified <code>.tex</code> source is ready. Choose how to compile it:
      </p>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>

        {/* 1. Open in Overleaf */}
        <button
          id="open-overleaf-btn"
          style={overleafBtn}
          onClick={handleOpenOverleaf}
          disabled={overleafState === 'loading'}
          onMouseEnter={e => { if (overleafState !== 'loading') e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          {overleafState === 'loading' ? (
            <>
              <div style={{
                width: 14, height: 14,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Loading…
            </>
          ) : overleafState === 'error' ? (
            '❌ Failed to load'
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
              </svg>
              Open in Overleaf
            </>
          )}
        </button>

        {/* 2. Copy LaTeX */}
        <button
          id="copy-latex-btn"
          style={copyBtn}
          onClick={handleCopy}
          disabled={copyState === 'copying'}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {copyState === 'copying' ? '⏳ Copying…'
           : copyState === 'copied' ? '✅ Copied!'
           : copyState === 'error'  ? '❌ Failed'
           : '📋 Copy LaTeX'}
        </button>

        {/* 3. Download .tex ZIP */}
        <a
          href={texZipUrl}
          download="modified_latex_source.zip"
          id="error-fallback-download-btn"
          style={downloadBtn}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          📦 Download .tex Source
        </a>
      </div>

      {/* Overleaf tip */}
      <p style={{
        marginTop: 16,
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        lineHeight: 1.6,
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: 14,
      }}>
        💡 <strong style={{ color: 'var(--text-secondary)' }}>Open in Overleaf</strong> creates a new project with your modified code instantly — no account setup needed if you're already logged in.
        Alternatively, <strong style={{ color: 'var(--text-secondary)' }}>Copy LaTeX</strong>, go to{' '}
        <a href="https://overleaf.com" target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>overleaf.com</a>,
        create a blank project, and paste it in.
      </p>

      {/* Hidden Overleaf form — submitted programmatically */}
      {overleafState === 'ready' && (
        <form
          ref={formRef}
          action="https://www.overleaf.com/docs"
          method="post"
          target="_blank"
          style={{ display: 'none' }}
        >
          <input type="hidden" name="snip_name" value="Tailored Resume" />
          <textarea name="snip" defaultValue={texContentRef.current} readOnly />
        </form>
      )}
    </div>
  );
}
