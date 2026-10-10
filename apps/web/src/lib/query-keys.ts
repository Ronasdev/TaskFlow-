import type { TaskFilters } from '@/types/api';

export const queryKeys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  members: (id: string) => ['projects', id, 'members'] as const,
  tasks: ['tasks'] as const,
  taskList: (scope: { projectId?: string } & TaskFilters) => ['tasks', 'list', scope] as const,
};
