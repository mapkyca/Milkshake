import React from 'react';

interface PriorityBadgeProps {
  priority: 0 | 1 | 2 | 3;
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (priority === 0) return null;

  let label = '';
  let colorClass = '';

  switch (priority) {
    case 1:
      label = 'P1';
      colorClass = 'pri-high';
      break;
    case 2:
      label = 'P2';
      colorClass = 'pri-med';
      break;
    case 3:
      label = 'P3';
      colorClass = 'pri-low';
      break;
  }

  return (
    <span className={`priority-badge ${colorClass}`}>
      {label}
      <style>{`
        .priority-badge {
          font-family: var(--font-heading);
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: 8px;
          letter-spacing: 0.05em;
        }
        .pri-high {
          background: rgba(239, 68, 68, 0.15);
          color: var(--priority-high);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .pri-med {
          background: rgba(249, 115, 22, 0.15);
          color: var(--priority-medium);
          border: 1px solid rgba(249, 115, 22, 0.3);
        }
        .pri-low {
          background: rgba(59, 130, 246, 0.15);
          color: var(--priority-low);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }
      `}</style>
    </span>
  );
}
