import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { AssignableRole, Dashboard, Member, Project } from '@/types/api';

export interface ProjectInput {
  name: string;
  description?: string | null;
}

export const useProjects = () =>
  useQuery({ queryKey: queryKeys.projects, queryFn: () => api.get<Project[]>('/projects') });

export const useProject = (id: string) =>
  useQuery({ queryKey: queryKeys.project(id), queryFn: () => api.get<Project>(`/projects/${id}`) });

export const useMembers = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.members(projectId ?? ''),
    queryFn: () => api.get<Member[]>(`/projects/${projectId}/members`),
    enabled: !!projectId,
  });

export const useDashboard = () =>
  useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.get<Dashboard>('/dashboard') });

/** Toute modification de projet ou de membres peut changer listes, compteurs et tableau de bord. */
function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: ProjectInput) => api.post<Project>('/projects', input),
    onSuccess: invalidate,
  });
}

export function useUpdateProject(id: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: Partial<ProjectInput>) => api.patch<Project>(`/projects/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });
}

export function useLeaveProject() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: string) => api.post(`/projects/${id}/leave`),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });
}

export function useMemberMutations(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProjects();
  const onSuccess = async () => {
    await invalidate();
    await queryClient.invalidateQueries({ queryKey: queryKeys.members(projectId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
  };

  return {
    add: useMutation({
      mutationFn: (input: { email: string; role: AssignableRole }) =>
        api.post<Member>(`/projects/${projectId}/members`, input),
      onSuccess,
    }),
    updateRole: useMutation({
      mutationFn: ({ userId, role }: { userId: string; role: AssignableRole }) =>
        api.patch<Member>(`/projects/${projectId}/members/${userId}`, { role }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (userId: string) => api.delete(`/projects/${projectId}/members/${userId}`),
      onSuccess,
    }),
  };
}
