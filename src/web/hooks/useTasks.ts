import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useTasks(filters: Record<string, any> = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => api.getTasks(filters),
  });

  const createMutation = useMutation({
    mutationFn: api.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: any }) => api.updateTask(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: api.completeTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
    },
  });

  const uncompleteMutation = useMutation({
    mutationFn: api.uncompleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: string }) => api.addNote(taskId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task'] });
    },
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createTask: createMutation.mutateAsync,
    updateTask: updateMutation.mutateAsync,
    completeTask: completeMutation.mutateAsync,
    uncompleteTask: uncompleteMutation.mutateAsync,
    deleteTask: deleteMutation.mutateAsync,
    addNote: addNoteMutation.mutateAsync,
  };
}

export function useTask(id: string | null) {
  const query = useQuery({
    queryKey: ['task', id],
    queryFn: () => (id ? api.getTask(id) : null),
    enabled: !!id,
  });

  return {
    task: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
