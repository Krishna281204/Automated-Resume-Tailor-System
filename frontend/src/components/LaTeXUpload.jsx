import React, { useCallback, useState } from 'react';

export default function LaTeXUpload({ file, onFileChange }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFileChange(dropped);
  }, [onFileChange]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleClick = () => {
    document.getElementById('latex-zip-input').click();
  };

  const handleInputChange = (e) => {
    const selected = e.target.files[0];
    if (selected) onFileChange(selected);
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Instructions banner */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        background: 'rgba(6, 182, 212, 0.07)',
        border: '1px solid rgba(6, 182, 212, 0.2)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: 14,
      }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>💡</span>
        <div>
          <p style={{ fontSize: '0.83rem', color: 'var(--accent-tertiary)', fontWeight: 600, marginBottom: 2 }}>
            How to export from Overleaf
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            In Overleaf, go to <strong style={{ color: 'var(--text-primary)' }}>Menu → Download → Source</strong> to get a .zip file of your project. Upload that ZIP here.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        id="latex-dropzone"
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent-tertiary)' : file ? 'var(--accent-success)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '32px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all var(--transition-base)',
          background: dragging
            ? 'rgba(6, 182, 212, 0.06)'
            : file
            ? 'rgba(16, 185, 129, 0.05)'
            : 'rgba(255,255,255,0.02)',
          boxShadow: dragging ? '0 0 0 4px rgba(6, 182, 212, 0.1)' : 'none',
        }}
      >
        <input
          id="latex-zip-input"
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        <div style={{
          width: 52,
          height: 52,
          margin: '0 auto 16px',
          borderRadius: '50%',
          background: file
            ? 'rgba(16, 185, 129, 0.15)'
            : 'rgba(6, 182, 212, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.6rem',
        }}>
          {file ? '✅' : '🗜️'}
        </div>

        {file ? (
          <>
            <p style={{ fontFamily: 'Outfit', fontWeight: 600, color: 'var(--accent-success)', marginBottom: 4 }}>
              {file.name}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {(file.size / 1024).toFixed(1)} KB · Click to replace
            </p>
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'Outfit', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              Drop your Overleaf ZIP here or click to browse
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Accepts .zip files only
            </p>
          </>
        )}
      </div>
    </div>
  );
}
