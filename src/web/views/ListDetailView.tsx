import React from 'react';
import TaskRow from '../components/TaskRow';

interface ListDetailViewProps {
  listName: string;
  tasks: any[];
  isLoading: boolean;
  onSelectTask: (id: string) => void;
  onCompleteToggle: (id: string, currentlyCompleted: boolean) => void;
}

export default function ListDetailView({
  listName,
  tasks,
  isLoading,
  onSelectTask,
  onCompleteToggle,
}: ListDetailViewProps) {
  const incomplete = tasks.filter((t) => !t.isCompleted);
  const completed = tasks.filter((t) => t.isCompleted);

  return (
    <div className="view-container">
      <header className="view-header">
        <h2>{listName}</h2>
        <p className="subtitle">All tasks under the list "{listName}".</p>
      </header>

      {isLoading ? (
        <div className="view-loader">Loading list tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📂</span>
          <h3>Empty List</h3>
          <p>No tasks inside "{listName}". Create one to get started!</p>
        </div>
      ) : (
        <div className="task-lists-wrapper">
          {incomplete.length > 0 && (
            <div className="task-section">
              <div className="section-title">Incomplete ({incomplete.length})</div>
              {incomplete.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onSelect={onSelectTask}
                  onCompleteToggle={onCompleteToggle}
                />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="task-section">
              <div className="section-title completed-title">Completed ({completed.length})</div>
              {completed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onSelect={onSelectTask}
                  onCompleteToggle={onCompleteToggle}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        .view-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .view-header {
          margin-bottom: 24px;
        }
        .view-header h2 {
          font-size: 1.8rem;
          color: white;
        }
        .subtitle {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-top: 4px;
        }
        .view-loader {
          padding: 40px;
          text-align: center;
          font-family: var(--font-heading);
          color: var(--text-secondary);
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          text-align: center;
          background: rgba(255, 255, 255, 0.01);
          border: 1px dashed rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-lg);
          margin-bottom: 24px;
        }
        .empty-icon {
          font-size: 3rem;
          margin-bottom: 16px;
        }
        .empty-state h3 {
          font-size: 1.2rem;
          color: white;
          margin-bottom: 8px;
        }
        .empty-state p {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        .task-lists-wrapper {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 24px;
          padding-right: 4px;
        }
        .task-section {
          margin-bottom: 24px;
        }
        .section-title {
          font-family: var(--font-heading);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--accent-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }
        .completed-title {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
