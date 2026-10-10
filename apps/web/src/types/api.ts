/** Types des réponses de l'API — docs/API.md. Les dates arrivent en chaînes ISO 8601. */

export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type AssignableRole = Exclude<ProjectRole, 'OWNER'>;
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
export const TASK_PRIORITIES: TaskPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

export interface User {
  id: string;
  email: string;
  name: string;
  personalProjectId: string | null;
  createdAt: string;
}

export interface Session {
  accessToken: string;
  user: User;
}

export type TaskCounts = Record<TaskStatus, number>;

export interface Project {
  id: string;
  name: string;
  description: string | null;
  isPersonal: boolean;
  myRole: ProjectRole;
  memberCount: number;
  taskCounts: TaskCounts;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  joinedAt: string;
}

export interface UserRef {
  userId: string;
  name: string;
}

export interface Task {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  assignee: UserRef | null;
  creator: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export interface Dashboard {
  counts: TaskCounts;
  overdue: number;
  dueSoon: Task[];
  assignedToMe: Task[];
  recentlyCompleted: Task[];
  projects: {
    id: string;
    name: string;
    myRole: ProjectRole;
    isPersonal: boolean;
    progress: number;
  }[];
}

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assigneeId?: string;
  assignedToMe?: boolean;
  q?: string;
  sort?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
