import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { Project, Session, Task, User } from '@/types/api';

export const API = 'http://localhost:3000/api/v1';

export const testUser: User = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'alice@test.dev',
  name: 'Alice Martin',
  personalProjectId: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const testSession: Session = { accessToken: 'access-token-1', user: testUser };

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    projectId: '44444444-4444-4444-8444-444444444444',
    projectName: 'Projet',
    title: 'Rédiger la page',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: null,
    completedAt: null,
    assignee: null,
    creator: { userId: testUser.id, name: testUser.name },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Projet',
    description: null,
    isPersonal: false,
    myRole: 'OWNER',
    memberCount: 2,
    taskCounts: { TODO: 1, IN_PROGRESS: 0, DONE: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Par défaut : pas de session (refresh refusé). Chaque test surcharge ce dont il a besoin. */
export const server = setupServer(
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
  ),
);
