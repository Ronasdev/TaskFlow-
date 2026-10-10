/**
 * Matrice d'autorisation obligatoire — docs/TESTING.md §4.
 * Pour chaque action × acteur : code HTTP attendu ET base inchangée en cas de refus.
 */
import type { Project, Task } from '@prisma/client';
import type { Test } from 'supertest';
import { closeTestApp, createTestApp, resetDatabase, TestContext } from '../utils/app';
import type { TestUser } from '../utils/factory';

type Actor = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'OUTSIDER';
const ACTORS: Actor[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'OUTSIDER'];

interface World {
  users: Record<Actor, TestUser>;
  newcomer: TestUser;
  project: Project;
  todo: Task;
  done: Task;
}

interface Case {
  name: string;
  expected: [owner: number, admin: number, member: number, viewer: number, outsider: number];
  send: (ctx: TestContext, world: World, actor: TestUser) => Test;
}

const auth = (test: Test, actor: TestUser) => test.set('Authorization', `Bearer ${actor.token}`);

const taskCases: Case[] = [
  {
    name: 'GET /tasks/:id',
    expected: [200, 200, 200, 200, 404],
    send: (ctx, w, a) => auth(ctx.http().get(`/api/v1/tasks/${w.todo.id}`), a),
  },
  {
    name: 'GET /projects/:id/tasks',
    expected: [200, 200, 200, 200, 404],
    send: (ctx, w, a) => auth(ctx.http().get(`/api/v1/projects/${w.project.id}/tasks`), a),
  },
  {
    name: 'POST /projects/:id/tasks',
    expected: [201, 201, 201, 404, 404],
    send: (ctx, w, a) =>
      auth(ctx.http().post(`/api/v1/projects/${w.project.id}/tasks`), a).send({
        title: 'Nouvelle',
      }),
  },
  {
    name: 'PATCH /tasks/:id (titre)',
    expected: [200, 200, 200, 404, 404],
    send: (ctx, w, a) =>
      auth(ctx.http().patch(`/api/v1/tasks/${w.todo.id}`), a).send({ title: 'Modifiée' }),
  },
  {
    name: 'PATCH tâche DONE → TODO (réouverture)',
    expected: [200, 200, 404, 404, 404],
    send: (ctx, w, a) =>
      auth(ctx.http().patch(`/api/v1/tasks/${w.done.id}`), a).send({ status: 'TODO' }),
  },
  {
    name: 'PATCH tâche DONE (titre seul)',
    expected: [200, 200, 200, 404, 404],
    send: (ctx, w, a) =>
      auth(ctx.http().patch(`/api/v1/tasks/${w.done.id}`), a).send({ title: 'Renommée' }),
  },
  {
    name: 'DELETE tâche TODO',
    expected: [204, 204, 204, 404, 404],
    send: (ctx, w, a) => auth(ctx.http().delete(`/api/v1/tasks/${w.todo.id}`), a),
  },
  {
    name: 'DELETE tâche DONE',
    expected: [204, 204, 404, 404, 404],
    send: (ctx, w, a) => auth(ctx.http().delete(`/api/v1/tasks/${w.done.id}`), a),
  },
];

const projectCases: Case[] = [
  {
    name: 'GET /projects/:id',
    expected: [200, 200, 200, 200, 404],
    send: (ctx, w, a) => auth(ctx.http().get(`/api/v1/projects/${w.project.id}`), a),
  },
  {
    name: 'GET /projects/:id/members',
    expected: [200, 200, 200, 200, 404],
    send: (ctx, w, a) => auth(ctx.http().get(`/api/v1/projects/${w.project.id}/members`), a),
  },
  {
    name: 'PATCH /projects/:id',
    expected: [200, 200, 404, 404, 404],
    send: (ctx, w, a) =>
      auth(ctx.http().patch(`/api/v1/projects/${w.project.id}`), a).send({ name: 'Renommé' }),
  },
  {
    name: 'DELETE /projects/:id',
    expected: [204, 404, 404, 404, 404],
    send: (ctx, w, a) => auth(ctx.http().delete(`/api/v1/projects/${w.project.id}`), a),
  },
  {
    name: 'POST member (rôle MEMBER)',
    expected: [201, 201, 404, 404, 404],
    send: (ctx, w, a) =>
      auth(ctx.http().post(`/api/v1/projects/${w.project.id}/members`), a).send({
        email: w.newcomer.email,
        role: 'MEMBER',
      }),
  },
  {
    name: 'POST member (rôle ADMIN)',
    expected: [201, 404, 404, 404, 404],
    send: (ctx, w, a) =>
      auth(ctx.http().post(`/api/v1/projects/${w.project.id}/members`), a).send({
        email: w.newcomer.email,
        role: 'ADMIN',
      }),
  },
  {
    name: 'DELETE member MEMBER',
    expected: [204, 204, 404, 404, 404],
    send: (ctx, w, a) =>
      auth(ctx.http().delete(`/api/v1/projects/${w.project.id}/members/${w.users.MEMBER.id}`), a),
  },
  {
    name: 'DELETE member ADMIN',
    expected: [204, 404, 404, 404, 404],
    send: (ctx, w, a) =>
      auth(ctx.http().delete(`/api/v1/projects/${w.project.id}/members/${w.users.ADMIN.id}`), a),
  },
  {
    name: 'DELETE member OWNER',
    expected: [404, 404, 404, 404, 404],
    send: (ctx, w, a) =>
      auth(ctx.http().delete(`/api/v1/projects/${w.project.id}/members/${w.users.OWNER.id}`), a),
  },
  {
    name: 'PATCH rôle ADMIN → MEMBER',
    expected: [200, 404, 404, 404, 404],
    send: (ctx, w, a) =>
      auth(
        ctx.http().patch(`/api/v1/projects/${w.project.id}/members/${w.users.ADMIN.id}`),
        a,
      ).send({
        role: 'MEMBER',
      }),
  },
  {
    name: 'PATCH rôle VIEWER → MEMBER',
    expected: [200, 200, 404, 404, 404],
    send: (ctx, w, a) =>
      auth(
        ctx.http().patch(`/api/v1/projects/${w.project.id}/members/${w.users.VIEWER.id}`),
        a,
      ).send({
        role: 'MEMBER',
      }),
  },
  {
    name: 'PATCH rôle VIEWER → ADMIN',
    expected: [200, 404, 404, 404, 404],
    send: (ctx, w, a) =>
      auth(
        ctx.http().patch(`/api/v1/projects/${w.project.id}/members/${w.users.VIEWER.id}`),
        a,
      ).send({
        role: 'ADMIN',
      }),
  },
  {
    name: 'POST /projects/:id/leave',
    expected: [404, 204, 204, 204, 404],
    send: (ctx, w, a) => auth(ctx.http().post(`/api/v1/projects/${w.project.id}/leave`), a),
  },
];

describe("Matrice d'autorisation", () => {
  let ctx: TestContext;
  let world: World;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(() => closeTestApp(ctx));

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    const f = ctx.factory;
    const users = {
      OWNER: await f.user({ name: 'Owner' }),
      ADMIN: await f.user({ name: 'Admin' }),
      MEMBER: await f.user({ name: 'Member' }),
      VIEWER: await f.user({ name: 'Viewer' }),
      OUTSIDER: await f.user({ name: 'Outsider' }),
    };
    const project = await f.project(users.OWNER, [
      [users.ADMIN, 'ADMIN'],
      [users.MEMBER, 'MEMBER'],
      [users.VIEWER, 'VIEWER'],
    ]);
    world = {
      users,
      newcomer: await f.user({ name: 'Newcomer' }),
      project,
      todo: await f.task(project.id, { title: 'À faire', assigneeId: users.MEMBER.id }),
      done: await f.task(project.id, { title: 'Terminée', status: 'DONE' }),
    };
  });

  /** Photographie de toutes les données métier : doit être identique après un refus. */
  const snapshot = async () =>
    JSON.stringify(
      await Promise.all([
        ctx.prisma.project.findMany({ orderBy: { id: 'asc' } }),
        ctx.prisma.projectMember.findMany({ orderBy: [{ projectId: 'asc' }, { userId: 'asc' }] }),
        ctx.prisma.task.findMany({ orderBy: { id: 'asc' } }),
      ]),
    );

  describe.each([
    ['Tâches', taskCases],
    ['Projets et membres', projectCases],
  ])('%s', (_group, cases) => {
    describe.each(cases)('$name', (testCase) => {
      it.each(ACTORS.map((actor, index) => [actor, testCase.expected[index]!] as const))(
        '%s → %i',
        async (actor, expected) => {
          const before = await snapshot();
          const response = await testCase.send(ctx, world, world.users[actor]);

          expect(response.status).toBe(expected);
          if (expected >= 400) {
            expect(response.body).toMatchObject({
              statusCode: 404,
              message: 'Ressource introuvable',
            });
            expect(await snapshot()).toBe(before);
          }
        },
      );
    });
  });
});
