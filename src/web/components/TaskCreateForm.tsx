import React, { useState } from 'react';

interface TaskCreateFormProps {
  lists: any[];
  activeListId?: string;
  onCreate: (input: any) => Promise<void>;
}

export default function TaskCreateForm({ lists, activeListId, onCreate }: TaskCreateFormProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(0);
  const [listId, setListId] = useState(activeListId || (lists[0]?.id ?? ''));
  const [tagsStr, setTagsStr] = useState('');
  const [rrule, setRrule] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync listId if activeListId changes
  React.useEffect(() => {
    if (activeListId) setListId(activeListId);
  }, [activeListId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !listId) return;

    setIsSubmitting(true);
    try {
      const tags = tagsStr
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      await onCreate({
        listId,
        title: title.trim(),
        priority,
        dueDate: dueDate || undefined,
        tags: tags.length > 0 ? tags : undefined,
        rrule: rrule.trim() || undefined,
      });

      setTitle('');
      setDueDate('');
      setPriority(0);
      setTagsStr('');
      setRrule('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="quick-capture glass-panel" onSubmit={handleSubmit}>
      <div className="input-group">
        <input
          type="text"
          placeholder="I want to..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="title-input"
        />
        <button type="submit" disabled={isSubmitting || !title.trim()} className="glow-btn">
          {isSubmitting ? 'Adding...' : 'Add Task'}
        </button>
      </div>

      <div className="meta-inputs">
        <div className="meta-field">
          <label>List</label>
          <select value={listId} onChange={(e) => setListId(e.target.value)} required>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="meta-field">
          <label>Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div className="meta-field">
          <label>Priority</label>
          <select value={priority} onChange={(e) => setPriority(Number(e.target.value) as any)}>
            <option value={0}>None</option>
            <option value={1}>High (P1)</option>
            <option value={2}>Medium (P2)</option>
            <option value={3}>Low (P3)</option>
          </select>
        </div>

        <div className="meta-field">
          <label>Tags</label>
          <input
            type="text"
            placeholder="e.g. work, urgent"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
          />
        </div>

        <div className="meta-field">
          <label>Recurrence</label>
          <input
            type="text"
            placeholder="e.g. FREQ=DAILY"
            value={rrule}
            onChange={(e) => setRrule(e.target.value)}
          />
        </div>
      </div>

      <style>{`
        .quick-capture {
          padding: 20px;
          margin-bottom: 24px;
          border-radius: var(--radius-lg);
        }
        .input-group {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        .title-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          color: white;
          font-family: var(--font-body);
          font-size: 1rem;
          transition: var(--transition-smooth);
        }
        .title-input:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 10px 0 rgba(99, 102, 241, 0.2);
        }
        .meta-inputs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }
        .meta-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .meta-field label {
          font-family: var(--font-heading);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .meta-field select, .meta-field input {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          color: white;
          font-family: var(--font-body);
          font-size: 0.85rem;
          outline: none;
          transition: var(--transition-smooth);
        }
        .meta-field select:focus, .meta-field input:focus {
          border-color: var(--accent-primary);
        }
      `}</style>
    </form>
  );
}
