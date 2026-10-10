import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { Paginated, Task, TaskFilters, TaskPriority, TaskStatus } from '@/types/api';

export interface TaskInput {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
}

export function useTasks(filters: TaskFilters, projectId?: string) {
  return useQuery({
    queryKey: queryKeys.taskList({ projectId, ...filters }),
    queryFn: ({ signal }) =>
      api.get<Paginated<Task>>(
        projectId ? `/projects/${projectId}/tasks` : '/tasks',
        { ...filters },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
    ]);
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: TaskInput }) =>
      api.post<Task>(`/projects/${projectId}/tasks`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TaskInput> }) =>
      api.patch<Task>(`/tasks/${id}`, input),
    onSuccess: invalidate,
  });
}

/**
 * Changement de statut optimiste (case à cocher, glisser-déposer) :
 * mise à jour immédiate des listes en cache, retour arrière en cas d'erreur.
 */
export function useChangeTaskStatus() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTasks();
  const listsKey = [...queryKeys.tasks, 'list'];

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      api.patch<Task>(`/tasks/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: listsKey });
      const snapshot = queryClient.getQueriesData<Paginated<Task>>({ queryKey: listsKey });
      queryClient.setQueriesData<Paginated<Task>>(
        { queryKey: listsKey },
        (page) =>
          page && {
            ...page,
            data: page.data.map((task) => (task.id === id ? { ...task, status } : task)),
          },
      );
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(error.message);
    },
    onSettled: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: invalidate,
  });
}
