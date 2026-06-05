import React, { useState, useEffect } from 'react';
import { useTask } from '../hooks/useTasks';
import TagChip from './TagChip';

interface TaskPanelProps {
  taskId: string | null;
  lists: any[];
  onClose: () => void;
  onUpdate: (id: string, input: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddNote: (taskId: string, body: string) => Promise<void>;
}

export default function TaskPanel({
  taskId,
  lists,
  onClose,
  onUpdate,
  onDelete,
  onAddNote,
}: TaskPanelProps) {
  const { task, isLoading } = useTask(taskId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(0);
  const [listId, setListId] = useState('');
  const [rrule, setRrule] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [newNoteBody, setNewNoteBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDueDate(task.dueDate || '');
      setPriority(task.priority);
      setListId(task.listId);
      setRrule(task.rrule || '');
      setTagsStr(task.tags ? task.tags.join(', ') : '');
    }
  }, [task]);

  if (!taskId) return null;

  const handleSave = async (updatedFields?: {
    title?: string;
    description?: string;
    dueDate?: string | null;
    priority?: 0 | 1 | 2 | 3;
    listId?: string;
    rrule?: string;
    tagsStr?: string;
  }) => {
    setIsSaving(true);
    try {
      const activeTitle = updatedFields && 'title' in updatedFields ? updatedFields.title : title;
      const activeDesc = updatedFields && 'description' in updatedFields ? updatedFields.description : description;
      const activeDueDate = updatedFields && 'dueDate' in updatedFields ? updatedFields.dueDate : dueDate;
      const activePriority = updatedFields && 'priority' in updatedFields ? updatedFields.priority : priority;
      const activeListId = updatedFields && 'listId' in updatedFields ? updatedFields.listId : listId;
      const activeRrule = updatedFields && 'rrule' in updatedFields ? updatedFields.rrule : rrule;
      const activeTagsStr = updatedFields && 'tagsStr' in updatedFields ? updatedFields.tagsStr : tagsStr;

      const tags = (activeTagsStr || '')
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      await onUpdate(taskId, {
        title: (activeTitle || '').trim(),
        description: (activeDesc || '').trim() || null,
        dueDate: activeDueDate || null,
        priority: activePriority,
        listId: activeListId,
        rrule: (activeRrule || '').trim() || null,
        tags,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await onDelete(taskId);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteBody.trim()) return;
    try {
      await onAddNote(taskId, newNoteBody.trim());
      setNewNoteBody('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add note');
    }
  };

  return (
    <div className="task-panel-overlay" onClick={onClose}>
      <div className="task-panel glass-panel" onClick={(e) => e.stopPropagation()}>
        {isLoading ? (
          <div className="panel-loader">Loading task details...</div>
        ) : !task ? (
          <div className="panel-loader">Task not found</div>
        ) : (
          <>
            <div className="panel-header">
              <h2>Task Details</h2>
              <button className="close-btn" onClick={onClose}>
                ✕
              </button>
            </div>

            <div className="panel-body">
              <div className="form-group">
                <label>Task Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => handleSave()}
                  className="title-field"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={description}
                  placeholder="Add a description..."
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => handleSave()}
                  rows={3}
                />
              </div>

              <div className="side-by-side">
                <div className="form-group">
                  <label>List</label>
                  <select
                    value={listId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setListId(value);
                      handleSave({ listId: value });
                    }}
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDueDate(value);
                      handleSave({ dueDate: value });
                    }}
                  />
                </div>
              </div>

              <div className="side-by-side">
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => {
                      const value = Number(e.target.value) as any;
                      setPriority(value);
                      handleSave({ priority: value });
                    }}
                  >
                    <option value={0}>None</option>
                    <option value={1}>High (P1)</option>
                    <option value={2}>Medium (P2)</option>
                    <option value={3}>Low (P3)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Recurrence Rule</label>
                  <input
                    type="text"
                    value={rrule}
                    placeholder="e.g. FREQ=WEEKLY"
                    onChange={(e) => setRrule(e.target.value)}
                    onBlur={() => handleSave()}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Tags (comma separated)</label>
                <input
                  type="text"
                  value={tagsStr}
                  placeholder="work, personal, urgent"
                  onChange={(e) => setTagsStr(e.target.value)}
                  onBlur={() => handleSave()}
                />
              </div>

              <div className="notes-section">
                <h3>Notes</h3>
                <div className="notes-list">
                  {task.notes && task.notes.length > 0 ? (
                    task.notes.map((note: any) => (
                      <div key={note.id} className="note-card">
                        <div className="note-body">{note.body}</div>
                        <div className="note-date">
                          {new Date(note.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-notes">No notes added yet.</div>
                  )}
                </div>

                <form onSubmit={handleAddNote} className="note-form">
                  <input
                    type="text"
                    placeholder="Write a new note..."
                    value={newNoteBody}
                    onChange={(e) => setNewNoteBody(e.target.value)}
                    required
                  />
                  <button type="submit" className="glow-btn">
                    Add Note
                  </button>
                </form>
              </div>

              <button className="delete-task-btn" onClick={handleDelete}>
                Delete Task
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .task-panel-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.4);
          z-index: 100;
          display: flex;
          justify-content: flex-end;
        }
        .task-panel {
          width: 500px;
          height: 100%;
          border-left: 1px solid var(--glass-border);
          border-radius: 0;
          display: flex;
          flex-direction: column;
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .panel-loader {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-heading);
          color: var(--text-secondary);
        }
        .panel-header {
          padding: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .close-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 1.2rem;
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .close-btn:hover {
          color: white;
        }
        .panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-group label {
          font-family: var(--font-heading);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .form-group input, .form-group textarea, .form-group select {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 10px 14px;
          border-radius: var(--radius-md);
          color: white;
          font-family: var(--font-body);
          font-size: 0.9rem;
          outline: none;
          transition: var(--transition-smooth);
        }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
          border-color: var(--accent-primary);
        }
        .title-field {
          font-size: 1.2rem !important;
          font-weight: bold;
        }
        .side-by-side {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .notes-section {
          margin-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
        }
        .notes-section h3 {
          font-size: 1rem;
          margin-bottom: 12px;
        }
        .notes-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 16px;
        }
        .note-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 10px 14px;
          border-radius: var(--radius-md);
        }
        .note-body {
          font-size: 0.85rem;
          color: var(--text-primary);
          line-height: 1.4;
        }
        .note-date {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: 6px;
        }
        .no-notes {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-style: italic;
        }
        .note-form {
          display: flex;
          gap: 10px;
        }
        .note-form input {
          flex: 1;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          color: white;
          outline: none;
          font-size: 0.85rem;
        }
        .delete-task-btn {
          background: rgba(239, 68, 68, 0.1);
          color: var(--priority-high);
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 10px;
          border-radius: var(--radius-md);
          font-family: var(--font-heading);
          cursor: pointer;
          transition: var(--transition-smooth);
          margin-top: 10px;
        }
        .delete-task-btn:hover {
          background: var(--priority-high);
          color: white;
        }
      `}</style>
    </div>
  );
}
