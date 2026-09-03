import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function PDFViewer({ jobId, summary }) {
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'none'
  const pdfUrl = `${API_BASE}/api/download/${jobId}`;
  const texUrl = `${API_BASE}/api/tex/${jobId}`;

  return (
    <div className="glass-card animate-fade-in-up" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.3rem',
          flexShrink: 0,
        }}>
          🎯
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{
            fontFamily: 'Outfit',
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--accent-success)',
            marginBottom: 2,
          }}>
            Tailored Resume Ready
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Your resume has been modified and compiled successfully.
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href={pdfUrl}
            download="tailored_resume.pdf"
            id="download-pdf-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              fontFamily: 'Outfit',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#fff',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              transition: 'all var(--transition-base)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            ⬇️ Download PDF
          </a>

          <a
            href={texUrl}
            download="modified_latex_source.zip"
            id="download-tex-btn"
            className="btn-secondary"
          >
            📦 Download .tex Source
          </a>
        </div>
      </div>

      {/* AI summary */}
      {summary && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(99, 102, 241, 0.06)',
          border: '1px solid rgba(99, 102, 241, 0.15)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 20,
        }}>
          <p style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'var(--accent-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 6,
          }}>
            AI Modification Summary
          </p>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {summary}
          </p>
        </div>
      )}

      {/* PDF Preview */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        background: '#1a1a2e',
        position: 'relative',
      }}>
        <div style={{
          padding: '10px 16px',
          background: 'rgba(0,0,0,0.3)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#ef4444','#f59e0b','#10b981'].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.8 }} />
            ))}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 8 }}>
            tailored_resume.pdf
          </span>
        </div>

        <iframe
          id="pdf-preview-frame"
          src={`${pdfUrl}#toolbar=0`}
          title="Tailored Resume PDF Preview"
          style={{
            width: '100%',
            height: 700,
            border: 'none',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}
