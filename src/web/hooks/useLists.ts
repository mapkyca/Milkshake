import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useLists() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lists'],
    queryFn: api.getLists,
  });

  const createMutation = useMutation({
    mutationFn: api.createList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  return {
    lists: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createList: createMutation.mutateAsync,
    deleteList: deleteMutation.mutateAsync,
  };
}
