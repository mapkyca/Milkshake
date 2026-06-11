import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface SmartListEditorProps {
  isOpen: boolean;
  onClose: () => void;
  initialList?: { id: string; name: string; smartFilter: string } | null;
  onSave: (name: string, filter: string) => Promise<void>;
}

export default function SmartListEditor({
  isOpen,
  onClose,
  initialList,
  onSave,
}: SmartListEditorProps) {
  const [name, setName] = useState('');
  const [filter, setFilter] = useState('');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error?: string;
    line?: number | null;
    column?: number | null;
  } | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    valid: boolean;
    count: number;
    tasks: any[];
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialList?.name || '');
      setFilter(initialList?.smartFilter || '');
      setValidationResult(null);
      setPreviewResult(null);
    }
  }, [isOpen, initialList]);

  // Live validation and preview
  useEffect(() => {
    if (!filter.trim()) {
      setValidationResult(null);
      setPreviewResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidating(true);
      try {
        const valRes = await api.validateFilter(filter);
        setValidationResult(valRes);
        if (valRes.valid) {
          const prevRes = await api.previewFilter(filter);
          setPreviewResult(prevRes);
        } else {
          setPreviewResult(null);
        }
      } catch (err: any) {
        setValidationResult({
          valid: false,
          error: err.message || 'Validation failed',
        });
        setPreviewResult(null);
      } finally {
        setIsValidating(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [filter]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !filter.trim()) return;
    if (validationResult && !validationResult.valid) {
      alert('Please fix the filter syntax errors before saving.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(name.trim(), filter.trim());
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save smart list');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3>{initialList ? 'Edit Smart List' : 'Create Smart List'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="sl-name">Name</label>
            <input
              type="text"
              id="sl-name"
              placeholder="e.g. Finance Actions, Due Today"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSaving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="sl-filter">SLQL Filter Expression</label>
            <input
              type="text"
              id="sl-filter"
              placeholder="e.g. priority:1 due:this-week status:incomplete"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              required
              disabled={isSaving}
              autoComplete="off"
            />
            
            {/* Validation Feedback */}
            {isValidating && <div className="validation-msg loading">Validating filter...</div>}
            
            {!isValidating && validationResult && (
              <div className={`validation-msg ${validationResult.valid ? 'success' : 'error'}`}>
                {validationResult.valid ? (
                  <span>✓ Filter syntax is valid</span>
                ) : (
                  <span>
                    ✗ {validationResult.error}
                    {validationResult.line !== null && validationResult.column !== null && (
                      <span className="error-loc">
                        {' '}
                        (Line {validationResult.line}, Col {validationResult.column})
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          {previewResult && previewResult.valid && (
            <div className="preview-panel">
              <h4>Matches Preview ({previewResult.count} tasks found)</h4>
              {previewResult.tasks.length === 0 ? (
                <p className="no-matches">No tasks currently match this filter.</p>
              ) : (
                <ul className="preview-list">
                  {previewResult.tasks.slice(0, 5).map((t: any) => (
                    <li key={t.id} className="preview-item">
                      <span className="task-status-dot"></span>
                      <span className="task-title">{t.title}</span>
                      {t.dueDate && <span className="task-due">{t.dueDate}</span>}
                    </li>
                  ))}
                  {previewResult.tasks.length > 5 && (
                    <li className="preview-more">
                      and {previewResult.tasks.length - 5} more matching tasks...
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          <footer className="modal-actions">
            <button type="button" className="action-btn cancel-btn" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button
              type="submit"
              className="glow-btn"
              disabled={isSaving || (validationResult !== null && !validationResult.valid)}
            >
              {isSaving ? 'Saving...' : 'Save Smart List'}
            </button>
          </footer>
        </form>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(4, 6, 10, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 120;
        }
        .modal-container {
          width: 500px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 12px;
        }
        .modal-header h3 {
          font-size: 1.25rem;
          color: white;
        }
        .close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 1.1rem;
          cursor: pointer;
        }
        .close-btn:hover {
          color: white;
        }
        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-family: var(--font-heading);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
        }
        .form-group input {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 10px 14px;
          border-radius: var(--radius-md);
          color: white;
          outline: none;
          font-size: 0.95rem;
          transition: var(--transition-smooth);
        }
        .form-group input:focus {
          border-color: var(--accent-primary);
          background: rgba(255, 255, 255, 0.04);
        }
        .validation-msg {
          font-size: 0.8rem;
          margin-top: 4px;
          font-weight: 500;
        }
        .validation-msg.loading {
          color: var(--text-secondary);
        }
        .validation-msg.success {
          color: var(--accent-secondary);
        }
        .validation-msg.error {
          color: var(--priority-high);
        }
        .error-loc {
          font-weight: bold;
          font-style: italic;
        }
        .preview-panel {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: var(--radius-md);
          padding: 14px;
        }
        .preview-panel h4 {
          font-size: 0.8rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .no-matches {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-style: italic;
        }
        .preview-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .preview-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
          color: var(--text-primary);
        }
        .task-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-muted);
        }
        .task-title {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .task-due {
          font-size: 0.75rem;
          color: var(--accent-secondary);
          background: rgba(6, 182, 212, 0.08);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }
        .preview-more {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-style: italic;
          padding-left: 16px;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 16px;
          margin-top: 8px;
        }
        .action-btn {
          font-family: var(--font-heading);
          font-weight: 500;
          padding: 10px 20px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .cancel-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-secondary);
        }
        .cancel-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
}
