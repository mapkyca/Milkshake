const API_BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMessage = 'Request failed';
    try {
      const parsed = JSON.parse(errText);
      errMessage = parsed.error?.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const result = await response.json();
  return result.data as T;
}

export const api = {
  // Lists
  getLists: () => request<any[]>('/lists'),
  getListTasks: (listId: string) => request<any[]>(`/lists/${listId}/tasks`),
  createList: (name: string) => request<any>('/lists', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
  deleteList: (id: string) => request<void>(`/lists/${id}`, {
    method: 'DELETE',
  }),

  // Tasks
  getTasks: (filters: Record<string, any> = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        params.append(key, String(val));
      }
    });
    const query = params.toString();
    return request<any[]>(`/tasks${query ? `?${query}` : ''}`);
  },
  getTask: (id: string) => request<any>(`/tasks/${id}`),
  createTask: (input: any) => request<any>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  updateTask: (id: string, input: any) => request<any>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),
  completeTask: (id: string) => request<{ task: any; next: any | null }>(`/tasks/${id}/complete`, {
    method: 'POST',
  }),
  uncompleteTask: (id: string) => request<any>(`/tasks/${id}/uncomplete`, {
    method: 'POST',
  }),
  deleteTask: (id: string) => request<void>(`/tasks/${id}`, {
    method: 'DELETE',
  }),
  addNote: (taskId: string, body: string) => request<any>(`/tasks/${taskId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  }),

  // Sync
  syncObsidian: (dateStr?: string) => request<any>('/sync/obsidian', {
    method: 'POST',
    body: JSON.stringify({ dateStr }),
  }),

  // Import
  importRTM: (filePath: string, dryRun = false, openOnly = false) => request<any>('/import/rtm', {
    method: 'POST',
    body: JSON.stringify({ filePath, dryRun, openOnly }),
  }),
};
