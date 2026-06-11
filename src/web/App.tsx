import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TaskCreateForm from './components/TaskCreateForm';
import TaskPanel from './components/TaskPanel';
import TodayView from './views/TodayView';
import UpcomingView from './views/UpcomingView';
import ListDetailView from './views/ListDetailView';
import { useLists } from './hooks/useLists';
import { useTasks } from './hooks/useTasks';

export default function App() {
  const [activeView, setActiveView] = useState<'today' | 'upcoming' | string>('today');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Fetch all active lists
  const { lists, createList, updateList, deleteList, createSmartList, updateSmartList } = useLists();

  const handleReorderLists = async (draggedId: string, targetId: string) => {
    const reordered = [...lists];
    const dragIdx = reordered.findIndex((l) => l.id === draggedId);
    const targetIdx = reordered.findIndex((l) => l.id === targetId);
    if (dragIdx === -1 || targetIdx === -1 || dragIdx === targetIdx) return;

    const [item] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, item);

    try {
      await Promise.all(
        reordered.map((list, index) => {
          if (list.sortOrder !== index) {
            return updateList({ id: list.id, input: { sortOrder: index } });
          }
          return Promise.resolve();
        })
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reorder lists');
    }
  };

  // Get active filters based on selection
  const filters: Record<string, any> = {};
  if (activeView === 'today') {
    filters.today = true;
  } else if (activeView === 'upcoming') {
    filters.upcoming = true;
  } else {
    filters.listId = activeView;
  }
  // Include completed and incomplete tasks for local segregation
  filters.completed = undefined;

  const {
    tasks,
    isLoading: tasksLoading,
    createTask,
    updateTask,
    completeTask,
    uncompleteTask,
    deleteTask,
    addNote,
  } = useTasks(filters);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes selected task details
      if (e.key === 'Escape') {
        setSelectedTaskId(null);
      }
      // 'n' focuses quick capture input if not typing elsewhere
      if (e.key === 'n' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const inputEl = document.querySelector('.title-input') as HTMLInputElement;
        inputEl?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCompleteToggle = async (id: string, currentlyCompleted: boolean) => {
    try {
      if (currentlyCompleted) {
        await uncompleteTask(id);
      } else {
        await completeTask(id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleUpdateTask = async (id: string, input: any) => {
    await updateTask({ id, input });
  };

  const handleAddNote = async (taskId: string, body: string) => {
    await addNote({ taskId, body });
  };

  // Find list name if activeView is a listId
  const activeList = lists.find((l) => l.id === activeView);

  return (
    <div className="app-container">
      <Sidebar
        lists={lists}
        activeView={activeView}
        onViewChange={setActiveView}
        onCreateList={async (name) => {
          await createList(name);
        }}
        onDeleteList={async (id) => {
          await deleteList(id);
        }}
        onReorderList={handleReorderLists}
        onCreateSmartList={async (name, filter) => {
          await createSmartList({ name, filter });
        }}
        onUpdateSmartList={async (id, name, filter) => {
          await updateSmartList({ id, name, filter });
        }}
      />

      <main className="main-content">
        <div className="view-scroll-area">
          {activeView === 'today' && (
            <TodayView
              tasks={tasks}
              isLoading={tasksLoading}
              onSelectTask={setSelectedTaskId}
              onCompleteToggle={handleCompleteToggle}
            />
          )}

          {activeView === 'upcoming' && (
            <UpcomingView
              tasks={tasks}
              isLoading={tasksLoading}
              onSelectTask={setSelectedTaskId}
              onCompleteToggle={handleCompleteToggle}
            />
          )}

          {activeView !== 'today' && activeView !== 'upcoming' && (
            <ListDetailView
              listName={activeList?.name || 'Loading List...'}
              tasks={tasks}
              isLoading={tasksLoading}
              onSelectTask={setSelectedTaskId}
              onCompleteToggle={handleCompleteToggle}
            />
          )}
        </div>

        <TaskCreateForm
          lists={lists}
          activeListId={activeView !== 'today' && activeView !== 'upcoming' ? activeView : undefined}
          onCreate={async (input) => {
            await createTask(input);
          }}
        />
      </main>

      <TaskPanel
        taskId={selectedTaskId}
        lists={lists}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={handleUpdateTask}
        onDelete={async (id) => {
          await deleteTask(id);
        }}
        onAddNote={handleAddNote}
      />

      <style>{`
        .app-container {
          display: flex;
          height: 100vh;
          width: 100vw;
          background: var(--bg-primary);
          overflow: hidden;
        }
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 32px 40px;
          height: 100%;
          min-width: 0;
        }
        .view-scroll-area {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
}
