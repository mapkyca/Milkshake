import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import SmartListEditor from './SmartListEditor';

interface SidebarProps {
  lists: any[];
  activeView: 'today' | 'upcoming' | string;
  onViewChange: (view: 'today' | 'upcoming' | string) => void;
  onCreateList: (name: string) => Promise<void>;
  onDeleteList: (id: string) => Promise<void>;
  onReorderList: (draggedId: string, targetId: string) => Promise<void>;
  onCreateSmartList: (name: string, filter: string) => Promise<void>;
  onUpdateSmartList: (id: string, name: string, filter: string) => Promise<void>;
}

export default function Sidebar({
  lists,
  activeView,
  onViewChange,
  onCreateList,
  onDeleteList,
  onReorderList,
  onCreateSmartList,
  onUpdateSmartList,
}: SidebarProps) {
  const queryClient = useQueryClient();
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [rtmPath, setRtmPath] = useState('');
  const [showRtmModal, setShowRtmModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Smart List Editor state
  const [isSmartEditorOpen, setIsSmartEditorOpen] = useState(false);
  const [editingSmartList, setEditingSmartList] = useState<any | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetId) {
      await onReorderList(draggedId, targetId);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleAddListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    setIsCreating(true);
    try {
      await onCreateList(newListName.trim());
      setNewListName('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create list');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSyncObsidian = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncObsidian();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
      alert(`Sync Complete!\nWritten: ${res.tasksWritten} tasks.\nCompletions Synced: ${res.completedTasksDetected}.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Obsidian sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportRTM = async () => {
    if (!rtmPath.trim()) return;
    setIsImporting(true);
    try {
      const summary = await api.importRTM(rtmPath.trim());
      alert(
        `Import Complete!\nLists: ${summary.listsImported}\nTasks: ${summary.tasksImported}\nNotes: ${summary.notesImported}`
      );
      setShowRtmModal(false);
      setRtmPath('');
      window.location.reload(); // Refresh to load imported lists
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteListClick = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete the list "${name}"? All tasks inside will be lost.`)) {
      return;
    }
    try {
      await onDeleteList(id);
      if (activeView === id) {
        onViewChange('today');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete list');
    }
  };

  const handleEditSmartListClick = (e: React.MouseEvent, sl: any) => {
    e.stopPropagation();
    setEditingSmartList(sl);
    setIsSmartEditorOpen(true);
  };

  const handleSaveSmartList = async (name: string, filter: string) => {
    if (editingSmartList) {
      await onUpdateSmartList(editingSmartList.id, name, filter);
    } else {
      await onCreateSmartList(name, filter);
    }
    queryClient.invalidateQueries({ queryKey: ['lists'] });
  };

  const normalLists = lists.filter((l) => !l.isSmart);
  const smartLists = lists.filter((l) => l.isSmart);

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-logo">
        <span className="logo-icon">🥛</span>
        <h1>Milkshake</h1>
      </div>

      <nav className="nav-group">
        <h3>Focus</h3>
        <div
          className={`nav-item ${activeView === 'today' ? 'active' : ''}`}
          onClick={() => onViewChange('today')}
        >
          <span className="nav-icon">☀️</span> Today
        </div>
        <div
          className={`nav-item ${activeView === 'upcoming' ? 'active' : ''}`}
          onClick={() => onViewChange('upcoming')}
        >
          <span className="nav-icon">📅</span> Upcoming
        </div>
      </nav>

      {/* Normal Lists Section */}
      <div className="nav-group lists-group">
        <h3>Lists</h3>
        <div className="lists-list">
          {normalLists.map((l) => (
            <div
              key={l.id}
              className={`nav-item list-item ${activeView === l.id ? 'active' : ''} ${
                draggedId === l.id ? 'dragging' : ''
              } ${dragOverId === l.id ? 'drag-over' : ''}`}
              onClick={() => onViewChange(l.id)}
              draggable
              onDragStart={(e) => handleDragStart(e, l.id)}
              onDragOver={(e) => handleDragOver(e, l.id)}
              onDragLeave={handleDragLeave}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, l.id)}
            >
              <span className="nav-icon">📁</span>
              <span className="list-name">{l.name}</span>
              <button
                className="delete-list-btn"
                onClick={(e) => handleDeleteListClick(e, l.id, l.name)}
                title="Delete List"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddListSubmit} className="add-list-form">
          <input
            type="text"
            placeholder="New List..."
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            disabled={isCreating}
            required
          />
          <button type="submit" disabled={isCreating}>
            +
          </button>
        </form>
      </div>

      {/* Smart Lists Section */}
      <div className="nav-group smart-lists-group">
        <h3>Smart Lists</h3>
        <div className="lists-list">
          {smartLists.map((l) => (
            <div
              key={l.id}
              className={`nav-item list-item ${activeView === l.id ? 'active' : ''} ${
                draggedId === l.id ? 'dragging' : ''
              } ${dragOverId === l.id ? 'drag-over' : ''}`}
              onClick={() => onViewChange(l.id)}
              draggable
              onDragStart={(e) => handleDragStart(e, l.id)}
              onDragOver={(e) => handleDragOver(e, l.id)}
              onDragLeave={handleDragLeave}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, l.id)}
            >
              <span className="nav-icon">⚡</span>
              <span className="list-name" title={l.smartFilter || ''}>
                {l.name} {!l.isEnabled && <span className="draft-badge">draft</span>}
              </span>
              <div className="list-item-actions">
                <button
                  className="edit-list-btn"
                  onClick={(e) => handleEditSmartListClick(e, l)}
                  title="Edit Smart List"
                >
                  ✎
                </button>
                <button
                  className="delete-list-btn"
                  onClick={(e) => handleDeleteListClick(e, l.id, l.name)}
                  title="Delete Smart List"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          className="add-smart-list-btn"
          onClick={() => {
            setEditingSmartList(null);
            setIsSmartEditorOpen(true);
          }}
        >
          + Add Smart List
        </button>
      </div>

      <div className="sidebar-actions">
        <button className="glow-btn sync-btn" onClick={handleSyncObsidian} disabled={isSyncing}>
          {isSyncing ? 'Syncing...' : '🔄 Sync Obsidian'}
        </button>

        <button className="import-rtm-btn" onClick={() => setShowRtmModal(true)}>
          📥 Import from RTM
        </button>
      </div>

      {showRtmModal && (
        <div className="modal-overlay" onClick={() => setShowRtmModal(false)}>
          <div className="modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Import RTM Export</h3>
            <p>Enter the absolute path to your Remember The Milk export JSON file on the host mount.</p>
            <input
              type="text"
              placeholder="/data/rtm_export.json"
              value={rtmPath}
              onChange={(e) => setRtmPath(e.target.value)}
            />
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowRtmModal(false)}>
                Cancel
              </button>
              <button className="glow-btn" onClick={handleImportRTM} disabled={isImporting}>
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart List Editor Modal */}
      <SmartListEditor
        isOpen={isSmartEditorOpen}
        onClose={() => setIsSmartEditorOpen(false)}
        initialList={editingSmartList}
        onSave={handleSaveSmartList}
      />

      <style>{`
        .sidebar {
          width: 280px;
          height: 100%;
          border-radius: 0;
          border-right: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          padding: 24px;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
        }
        .logo-icon {
          font-size: 1.8rem;
        }
        .sidebar-logo h1 {
          font-size: 1.5rem;
          color: white;
        }
        .nav-group {
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .lists-group {
          flex: 1.2;
        }
        .smart-lists-group {
          flex: 1;
        }
        .nav-group h3 {
          font-family: var(--font-heading);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          padding: 10px 14px;
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-weight: 500;
          font-size: 0.95rem;
          cursor: pointer;
          border-radius: var(--radius-md);
          transition: var(--transition-smooth);
          margin-bottom: 4px;
        }
        .nav-item:hover {
          color: white;
          background: rgba(255, 255, 255, 0.03);
        }
        .nav-item.active {
          color: white;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%);
          border: 1px solid rgba(99, 102, 241, 0.2);
        }
        .nav-icon {
          margin-right: 12px;
          font-size: 1.1rem;
        }
        .lists-list {
          overflow-y: auto;
          flex: 1;
          margin-bottom: 12px;
        }
        .list-item {
          justify-content: space-between;
          position: relative;
          cursor: grab;
        }
        .list-item:active {
          cursor: grabbing;
        }
        .list-item.dragging {
          opacity: 0.4;
          border: 1px dashed rgba(255, 255, 255, 0.2);
        }
        .list-item.drag-over {
          border: 1px dashed var(--accent-primary);
          background: rgba(255, 255, 255, 0.05);
        }
        .list-name {
          flex: 1;
          margin-right: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .draft-badge {
          font-size: 0.65rem;
          text-transform: uppercase;
          background: rgba(239, 68, 68, 0.15);
          color: var(--priority-high);
          padding: 1px 4px;
          border-radius: 4px;
          font-weight: 600;
        }
        .list-item-actions {
          display: flex;
          align-items: center;
        }
        .edit-list-btn,
        .delete-list-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.85rem;
          opacity: 0;
          transition: var(--transition-smooth);
        }
        .edit-list-btn {
          margin-right: 8px;
        }
        .list-item:hover .edit-list-btn,
        .list-item:hover .delete-list-btn {
          opacity: 1;
        }
        .delete-list-btn:hover {
          color: var(--priority-high);
        }
        .edit-list-btn:hover {
          color: var(--accent-secondary);
        }
        .add-list-form {
          display: flex;
          gap: 6px;
        }
        .add-list-form input {
          flex: 1;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          color: white;
          font-size: 0.85rem;
          outline: none;
        }
        .add-list-form button {
          background: var(--accent-primary);
          border: none;
          color: white;
          width: 30px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-weight: bold;
        }
        .add-smart-list-btn {
          background: transparent;
          border: 1px dashed rgba(255, 255, 255, 0.1);
          color: var(--text-secondary);
          padding: 8px;
          border-radius: var(--radius-md);
          font-family: var(--font-heading);
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition-smooth);
          text-align: center;
          margin-top: 4px;
        }
        .add-smart-list-btn:hover {
          border-color: var(--accent-primary);
          color: white;
          background: rgba(255, 255, 255, 0.02);
        }
        .sidebar-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: auto;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
        }
        .sync-btn {
          width: 100%;
          text-align: center;
        }
        .import-rtm-btn {
          background: transparent;
          border: 1px dashed rgba(255, 255, 255, 0.15);
          color: var(--text-secondary);
          padding: 10px;
          border-radius: var(--radius-md);
          font-family: var(--font-heading);
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .import-rtm-btn:hover {
          border-color: var(--accent-secondary);
          color: white;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 110;
        }
        .modal {
          width: 450px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .modal h3 {
          font-size: 1.2rem;
        }
        .modal p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .modal input {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 10px 14px;
          border-radius: var(--radius-md);
          color: white;
          outline: none;
          font-size: 0.9rem;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .cancel-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-secondary);
          padding: 10px 20px;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-family: var(--font-heading);
        }
        .cancel-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </aside>
  );
}
