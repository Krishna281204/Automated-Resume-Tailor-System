import React from 'react';

const PLACEHOLDER = `Examples:
• "Emphasize my Python and machine learning experience in all project bullets."
• "Keep the 'Education' section unchanged."
• "Rewrite project descriptions to highlight scalability and system design."
• "Use action verbs: Built, Designed, Deployed, Optimized."
• "Do not add any new sections or remove any existing ones."`;

export default function InstructionsBox({ value, onChange, disabled }) {
  return (
    <div style={{ width: '100%' }}>
      <textarea
        id="user-instructions"
        className="form-input"
        placeholder={PLACEHOLDER}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={7}
        style={{
          minHeight: 160,
          lineHeight: 1.65,
          fontSize: '0.9rem',
          fontFamily: "'Inter', monospace",
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      <p style={{
        marginTop: 8,
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        lineHeight: 1.5,
      }}>
        Be specific — the more detail you provide, the better the AI can tailor your resume.
      </p>
    </div>
  );
}
