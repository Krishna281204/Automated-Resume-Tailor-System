import React, { useState, useRef, useEffect } from 'react';
import DropZone from './components/DropZone';
import LaTeXUpload from './components/LaTeXUpload';
import InstructionsBox from './components/InstructionsBox';
import StatusPanel from './components/StatusPanel';
import PDFViewer from './components/PDFViewer';
import CompilationFailedPanel from './components/CompilationFailedPanel';
import './index.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STEPS = [
  { id: 'jd',      label: 'Job Description',   icon: '📋', desc: 'Upload the job description you\'re applying for' },
  { id: 'latex',   label: 'LaTeX Resume',       icon: '📄', desc: 'Upload your Overleaf project as a ZIP file' },
  { id: 'instruct',label: 'Instructions',       icon: '✍️',  desc: 'Tell the AI exactly how to tailor your resume' },
];

export default function App() {
  const [jdFile, setJdFile] = useState(null);
  const [latexZip, setLatexZip] = useState(null);
  const [instructions, setInstructions] = useState('');

  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); // 'running' | 'done' | 'error'
  const [statusUpdates, setStatusUpdates] = useState([]);
  const [jobSummary, setJobSummary] = useState(null);
  const [hasPdf, setHasPdf] = useState(false); // whether the PDF was actually generated
  const [jobError, setJobError] = useState(null); // actual error message when status='error'
  const [aiSucceeded, setAiSucceeded] = useState(false); // true if AI modified but pdflatex failed
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const eventSourceRef = useRef(null);
  const resultRef = useRef(null);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Scroll to results when PDF is ready
  useEffect(() => {
    if (jobStatus === 'done' || jobStatus === 'error') {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [jobStatus]);

  const canSubmit = jdFile && latexZip && instructions.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setJobId(null);
    setJobStatus(null);
    setStatusUpdates([]);
    setJobSummary(null);
    setHasPdf(false);
    setJobError(null);
    setAiSucceeded(false);

    try {
      const formData = new FormData();
      formData.append('jd_file', jdFile);
      formData.append('latex_zip', latexZip);
      formData.append('instructions', instructions);

      const response = await fetch(`${API_BASE}/api/tailor`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(err.detail || 'Failed to start tailoring.');
      }

      const data = await response.json();
      const id = data.job_id;
      setJobId(id);
      setJobStatus('running');

      // Open SSE stream
      const es = new EventSource(`${API_BASE}/api/status/${id}`);
      eventSourceRef.current = es;

      es.addEventListener('update', (e) => {
        setStatusUpdates(prev => [...prev, e.data]);
      });

      es.addEventListener('done', async (e) => {
        setJobStatus('done');
        es.close();

        // Fetch summary and check if PDF generated
        try {
          const info = await fetch(`${API_BASE}/api/job/${id}`).then(r => r.json());
          setJobSummary(info.modification_summary || null);
          setHasPdf(info.has_pdf || false);
        } catch (_) {}
      });

      es.addEventListener('error', async (e) => {
        if (e.data) {
          setStatusUpdates(prev => [...prev, `❌ ${e.data}`]);
        }
        setJobStatus('error');
        es.close();

        // Fetch job info to determine if AI modification succeeded
        // (modification_summary is set only when AI step completed successfully)
        try {
          const info = await fetch(`${API_BASE}/api/job/${id}`).then(r => r.json());
          setJobSummary(info.modification_summary || null);
          setJobError(info.error || e.data || null);
          // AI succeeded = summary exists; pdflatex must have been the failure point
          setAiSucceeded(!!info.modification_summary);
        } catch (_) {
          setJobError(e.data || 'An unexpected error occurred.');
        }
      });

      es.onerror = () => {
        // SSE connection closed by server (normal on completion)
        if (jobStatus !== 'done') {
          es.close();
        }
      };

    } catch (err) {
      setSubmitError(err.message);
      setIsSubmitting(false);
      setJobStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    eventSourceRef.current?.close();
    setJdFile(null);
    setLatexZip(null);
    setInstructions('');
    setJobId(null);
    setJobStatus(null);
    setStatusUpdates([]);
    setJobSummary(null);
    setJobError(null);
    setAiSucceeded(false);
    setHasPdf(false);
    setSubmitError(null);
    setIsSubmitting(false);
  };

  const isRunning = jobStatus === 'running';
  const isDone = jobStatus === 'done';

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {/* ── Hero Header ──────────────────────────────────────── */}
      <header style={{
        textAlign: 'center',
        padding: '60px 24px 40px',
        maxWidth: 900,
        margin: '0 auto',
      }}>
        {/* Logo badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 18px',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 40,
          marginBottom: 28,
          animation: 'fadeIn 0.6s ease both',
        }}>
          <span style={{ fontSize: '1.1rem' }}>🤖</span>
          <span style={{
            fontFamily: 'Outfit',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--accent-primary)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Powered by Gemini + LangGraph
          </span>
        </div>

        <h1 style={{
          fontFamily: 'Outfit',
          fontSize: 'clamp(2rem, 5vw, 3.2rem)',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-0.03em',
          marginBottom: 18,
          background: 'linear-gradient(135deg, #f1f5f9 30%, #a5b4fc 70%, #67e8f9)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'fadeInUp 0.6s ease 0.1s both',
        }}>
          Agentic AI Resume Tailor
        </h1>

        <p style={{
          fontSize: 'clamp(0.95rem, 2vw, 1.12rem)',
          color: 'var(--text-secondary)',
          maxWidth: 560,
          margin: '0 auto',
          lineHeight: 1.7,
          animation: 'fadeInUp 0.6s ease 0.2s both',
        }}>
          Upload your LaTeX resume and a job description. Our AI agent reads, modifies, and compiles your resume — tailored precisely to the role.
        </p>

        {/* Feature pills */}
        <div style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginTop: 24,
          animation: 'fadeInUp 0.6s ease 0.3s both',
        }}>
          {['LaTeX-native', 'Gemini AI', 'LangGraph Agent', 'Instant PDF'].map(tag => (
            <span key={tag} style={{
              padding: '5px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 20,
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              fontWeight: 500,
            }}>
              {tag}
            </span>
          ))}
        </div>
      </header>

      {/* ── Main Form ─────────────────────────────────────────── */}
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>

        {/* Step cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Step 1: Job Description */}
          <div className="glass-card animate-fade-in-up" style={{ padding: '28px', animationDelay: '0.1s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'rgba(99,102,241,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}>
                📋
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'Outfit',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    background: 'rgba(99,102,241,0.12)',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}>Step 1</span>
                  {jdFile && <span style={{ fontSize: '0.85rem', color: 'var(--accent-success)' }}>✓ Ready</span>}
                </div>
                <h2 style={{ fontFamily: 'Outfit', fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>
                  Job Description
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Upload the job description you're applying for (PDF or TXT)
                </p>
              </div>
            </div>
            <DropZone
              file={jdFile}
              onFileChange={setJdFile}
              accept=".pdf, .txt"
              label="Drop the Job Description here"
            />
          </div>

          {/* Step 2: LaTeX ZIP */}
          <div className="glass-card animate-fade-in-up" style={{ padding: '28px', animationDelay: '0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'rgba(6,182,212,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}>
                🗜️
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'Outfit',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--accent-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    background: 'rgba(6,182,212,0.1)',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}>Step 2</span>
                  {latexZip && <span style={{ fontSize: '0.85rem', color: 'var(--accent-success)' }}>✓ Ready</span>}
                </div>
                <h2 style={{ fontFamily: 'Outfit', fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>
                  LaTeX Resume (Overleaf ZIP)
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Export your Overleaf project as a ZIP and upload it here
                </p>
              </div>
            </div>
            <LaTeXUpload file={latexZip} onFileChange={setLatexZip} />
          </div>

          {/* Step 3: Instructions */}
          <div className="glass-card animate-fade-in-up" style={{ padding: '28px', animationDelay: '0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'rgba(139,92,246,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}>
                ✍️
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'Outfit',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--accent-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    background: 'rgba(139,92,246,0.1)',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}>Step 3</span>
                  {instructions.trim() && <span style={{ fontSize: '0.85rem', color: 'var(--accent-success)' }}>✓ Ready</span>}
                </div>
                <h2 style={{ fontFamily: 'Outfit', fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>
                  Tailoring Instructions
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Tell the AI exactly how to modify your resume
                </p>
              </div>
            </div>
            <InstructionsBox
              value={instructions}
              onChange={setInstructions}
              disabled={isRunning}
            />
          </div>

          {/* Submit error */}
          {submitError && (
            <div style={{
              padding: '14px 18px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-error)',
              fontSize: '0.88rem',
            }}>
              ⚠️ {submitError}
            </div>
          )}

          {/* Submit / Reset buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              id="tailor-resume-btn"
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{ flex: 1 }}
            >
              {isRunning ? (
                <>
                  <div style={{
                    width: 18,
                    height: 18,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Tailoring Resume…
                </>
              ) : isDone ? (
                '✅ Tailor Again'
              ) : (
                '🚀 Tailor My Resume'
              )}
            </button>

            {(jobId || submitError) && (
              <button
                id="reset-btn"
                className="btn-secondary"
                onClick={handleReset}
                style={{ flexShrink: 0 }}
              >
                🔄 Reset
              </button>
            )}
          </div>

          {/* Readiness indicator */}
          {(!jdFile || !latexZip || !instructions.trim()) && !isRunning && (
            <div style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              {[
                { done: !!jdFile, label: 'JD uploaded' },
                { done: !!latexZip, label: 'ZIP uploaded' },
                { done: !!instructions.trim(), label: 'Instructions provided' },
              ].map(({ done, label }) => (
                <span key={label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.82rem',
                  color: done ? 'var(--accent-success)' : 'var(--text-muted)',
                }}>
                  <span style={{ fontSize: '0.9rem' }}>{done ? '✅' : '⬜'}</span>
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Live Status Panel ─────────────────────────────────── */}
        {statusUpdates.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <StatusPanel updates={statusUpdates} status={jobStatus} />
          </div>
        )}

        {/* ── PDF Output ────────────────────────────────────────── */}
        {jobStatus === 'done' && jobId && (
          <div ref={resultRef} style={{ marginTop: 24 }}>
            {hasPdf ? (
              <PDFViewer jobId={jobId} summary={jobSummary} />
            ) : (
              <CompilationFailedPanel jobId={jobId} apiBase={API_BASE} summary={jobSummary} />
            )}
          </div>
        )}

        {/* Error state fallback (for actual errors like API key, bad ZIP, etc.) */}
        {jobStatus === 'error' && jobId && (
          <div ref={resultRef} style={{ marginTop: 24 }}>
            <div className="glass-card" style={{
              padding: '20px 24px',
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <p style={{
                fontFamily: 'Outfit', fontWeight: 700,
                color: 'var(--accent-error)', marginBottom: 10,
              }}>
                ❌ Error Encountered
              </p>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                {jobError || 'Something went wrong. Check the status log above for details.'}
              </p>
            </div>
          </div>
        )}

      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer style={{
        textAlign: 'center',
        padding: '48px 24px 24px',
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
      }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span>Built with</span>
          <span style={{ color: 'var(--accent-primary)' }}>Gemini</span>
          <span>·</span>
          <span style={{ color: 'var(--accent-secondary)' }}>LangGraph</span>
          <span>·</span>
          <span style={{ color: 'var(--accent-tertiary)' }}>FastAPI</span>
          <span>·</span>
          <span style={{ color: 'var(--text-secondary)' }}>React</span>
        </div>
      </footer>
    </div>
  );
}
