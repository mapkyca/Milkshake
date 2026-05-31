import React from 'react';

interface TagChipProps {
  tag: string;
}

export default function TagChip({ tag }: TagChipProps) {
  return (
    <span className="tag-chip">
      #{tag}
      <style>{`
        .tag-chip {
          font-family: var(--font-body);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--accent-secondary);
          background: rgba(6, 182, 212, 0.1);
          border: 1px solid rgba(6, 182, 212, 0.2);
          padding: 2px 8px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          margin-right: 6px;
          transition: var(--transition-smooth);
        }
        .tag-chip:hover {
          background: rgba(6, 182, 212, 0.2);
          border-color: var(--accent-secondary);
        }
      `}</style>
    </span>
  );
}
