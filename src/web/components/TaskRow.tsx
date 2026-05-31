import React from 'react';
import PriorityBadge from './PriorityBadge';
import TagChip from './TagChip';

interface TaskRowProps {
  task: any;
  onSelect: (id: string) => void;
  onCompleteToggle: (id: string, currentlyCompleted: boolean) => void;
}

export default function TaskRow({ task, onSelect, onCompleteToggle }: TaskRowProps) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.isCompleted;

  return (
    <div className={`task-row ${task.isCompleted ? 'completed' : ''}`} onClick={() => onSelect(task.id)}>
      <div className="task-left" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={task.isCompleted}
          onChange={() => onCompleteToggle(task.id, task.isCompleted)}
          className="task-checkbox"
        />
        <PriorityBadge priority={task.priority} />
        <span className="task-title">{task.title}</span>
      </div>

      <div className="task-right">
        {task.tags && task.tags.map((tag: string) => <TagChip key={tag} tag={tag} />)}
        
        {task.rrule && (
          <span className="recurring-icon" title={task.rrule}>
            🔁
          </span>
        )}

        {task.dueDate && (
          <span className={`due-date ${isOverdue ? 'overdue' : ''}`}>
            📅 {task.dueDate}
          </span>
        )}
      </div>

      <style>{`
        .task-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          cursor: pointer;
          transition: var(--transition-smooth);
          border-radius: var(--radius-md);
          margin-bottom: 8px;
          background: rgba(19, 25, 41, 0.3);
        }
        .task-row:hover {
          background: rgba(255, 255, 255, 0.03);
          transform: translateY(-1px);
          border-color: rgba(99, 102, 241, 0.2);
        }
        .task-row.completed .task-title {
          text-decoration: line-through;
          color: var(--text-muted);
        }
        .task-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .task-checkbox {
          appearance: none;
          width: 18px;
          height: 18px;
          border: 2px solid var(--text-muted);
          border-radius: 4px;
          cursor: pointer;
          transition: var(--transition-smooth);
          position: relative;
        }
        .task-checkbox:checked {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
        }
        .task-checkbox:checked::after {
          content: '✓';
          position: absolute;
          color: white;
          font-size: 12px;
          font-weight: bold;
          top: -1px;
          left: 3px;
        }
        .task-title {
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--text-primary);
          font-weight: 500;
        }
        .task-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .recurring-icon {
          font-size: 0.9rem;
          opacity: 0.8;
        }
        .due-date {
          font-size: 0.8rem;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.05);
          padding: 3px 8px;
          border-radius: 6px;
        }
        .due-date.overdue {
          color: var(--priority-high);
          background: rgba(239, 68, 68, 0.15);
        }
      `}</style>
    </div>
  );
}
