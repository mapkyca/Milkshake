import React from 'react';
import TaskRow from '../components/TaskRow';

interface UpcomingViewProps {
  tasks: any[];
  isLoading: boolean;
  onSelectTask: (id: string) => void;
  onCompleteToggle: (id: string, currentlyCompleted: boolean) => void;
}

export default function UpcomingView({
  tasks,
  isLoading,
  onSelectTask,
  onCompleteToggle,
}: UpcomingViewProps) {
  // Group tasks by due date
  const groupedTasks: Record<string, any[]> = {};
  
  tasks.forEach((t) => {
    const key = t.dueDate || 'No Due Date';
    if (!groupedTasks[key]) {
      groupedTasks[key] = [];
    }
    groupedTasks[key].push(t);
  });

  const dateKeys = Object.keys(groupedTasks).sort();

  return (
    <div className="view-container">
      <header className="view-header">
        <h2>Upcoming</h2>
        <p className="subtitle">Chronological task agenda for the next 7 days.</p>
      </header>

      {isLoading ? (
        <div className="view-loader">Loading your tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🌈</span>
          <h3>Looking clear!</h3>
          <p>No tasks scheduled for the next week.</p>
        </div>
      ) : (
        <div className="task-lists-wrapper">
          {dateKeys.map((dateStr) => (
            <div key={dateStr} className="task-section">
              <div className="section-title">
                {dateStr === 'No Due Date'
                  ? 'No Due Date'
                  : new Date(dateStr).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
              </div>
              {groupedTasks[dateStr].map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onSelect={onSelectTask}
                  onCompleteToggle={onCompleteToggle}
                />
              ))}
            </div>
          ))}
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
          margin-bottom: 28px;
        }
        .section-title {
          font-family: var(--font-heading);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--accent-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
          border-left: 3px solid var(--accent-primary);
          padding-left: 10px;
        }
      `}</style>
    </div>
  );
}
