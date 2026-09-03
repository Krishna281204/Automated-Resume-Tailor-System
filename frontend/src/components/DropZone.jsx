import React, { useCallback, useState } from 'react';

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const ACCEPTED_DISPLAY = '.pdf, .txt';

export default function DropZone({ file, onFileChange, label, accept = ACCEPTED_DISPLAY }) {
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
    document.getElementById('dropzone-input').click();
  };

  const handleInputChange = (e) => {
    const selected = e.target.files[0];
    if (selected) onFileChange(selected);
  };

  return (
    <div style={{ width: '100%' }}>
      <div
        id="dropzone-area"
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          position: 'relative',
          border: `2px dashed ${dragging ? 'var(--accent-primary)' : file ? 'var(--accent-success)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '32px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all var(--transition-base)',
          background: dragging
            ? 'rgba(99, 102, 241, 0.07)'
            : file
            ? 'rgba(16, 185, 129, 0.05)'
            : 'rgba(255,255,255,0.02)',
          boxShadow: dragging ? '0 0 0 4px rgba(99, 102, 241, 0.1)' : 'none',
        }}
      >
        <input
          id="dropzone-input"
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        {/* Icon */}
        <div style={{
          width: 52,
          height: 52,
          margin: '0 auto 16px',
          borderRadius: '50%',
          background: file
            ? 'rgba(16, 185, 129, 0.15)'
            : 'rgba(99, 102, 241, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.6rem',
          transition: 'all var(--transition-base)',
        }}>
          {file ? '✅' : '📄'}
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
              {label || 'Drop file here or click to browse'}
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Accepts {accept}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
