// ─── Domain types ────────────────────────────────────────────────────────────

export type Priority = 0 | 1 | 2 | 3; // 0=none 1=high 2=medium 3=low

export interface List {
  id: string;
  name: string;
  isSmart: boolean;
  smartFilter?: string | null;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  listId: string;
  parentId?: string | null;
  title: string;
  description?: string | null;
  priority: Priority;
  dueDate?: string | null;   // YYYY-MM-DD
  rrule?: string | null;     // RFC 5545 RRULE string
  isCompleted: boolean;
  isArchived: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  seriesId?: string | null;
  // joined
  tags: string[];
  subtasks?: Task[];
  notes?: TaskNote[];
}

export interface TaskNote {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRecord {
  id: string;
  source: string;
  externalId: string;
  entityType: string;
  internalId: string;
  importedAt: string;
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateListInput {
  name: string;
  sortOrder?: number;
}

export interface UpdateListInput {
  name?: string;
  sortOrder?: number;
}

export interface CreateTaskInput {
  listId: string;
  parentId?: string;
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;
  rrule?: string;
  tags?: string[];
  seriesId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: Priority;
  dueDate?: string | null;
  rrule?: string | null;
  tags?: string[];
  listId?: string;
}

export interface TaskFilters {
  listId?: string;
  today?: boolean;
  upcoming?: boolean;
  completed?: boolean;
  tags?: string[];
  priority?: Priority;
  parentId?: string | null;
  search?: string;
}

// ─── Import types ─────────────────────────────────────────────────────────────

export interface ImportOptions {
  dryRun?: boolean;
  openOnly?: boolean;
}

export interface ImportSummary {
  listsImported: number;
  listsSkipped: number;
  tasksImported: number;
  tasksSkipped: number;
  notesImported: number;
  errors: string[];
  dryRun: boolean;
}

// ─── DB row types (snake_case) ────────────────────────────────────────────────

export interface ListRow {
  id: string;
  name: string;
  is_smart: number;
  smart_filter: string | null;
  is_archived: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  list_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  priority: number;
  due_date: string | null;
  rrule: string | null;
  is_completed: number;
  is_archived: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  series_id: string | null;
}

export interface TaskTagRow {
  task_id: string;
  tag: string;
}

export interface TaskNoteRow {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}
