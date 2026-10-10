/** Fonctionnel tâches / projets et cas transverses obligatoires — docs/TESTING.md §4. */
import { closeTestApp, createTestApp, randomId, resetDatabase, TestContext } from '../utils/app';
import type { TestUser } from '../utils/factory';

describe('Tâches et projets', () => {
  let ctx: TestContext;
  let alice: TestUser;
  let bob: TestUser;
  let eve: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => closeTestApp(ctx));
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    alice = await ctx.factory.user({ name: 'Alice' });
    bob = await ctx.factory.user({ name: 'Bob' });
    eve = await ctx.factory.user({ name: 'Eve' });
  });

  const as = (user: TestUser) => ({
    get: (url: string) => ctx.http().get(url).set('Authorization', `Bearer ${user.token}`),
    post: (url: string) => ctx.http().post(url).set('Authorization', `Bearer ${user.token}`),
    patch: (url: string) => ctx.http().patch(url).set('Authorization', `Bearer ${user.token}`),
    delete: (url: string) => ctx.http().delete(url).set('Authorization', `Bearer ${user.token}`),
  });

  describe('cycle de vie d’une tâche', () => {
    it('crée, lit, modifie, termine et supprime une tâche personnelle', async () => {
      const created = await as(alice)
        .post(`/api/v1/projects/${alice.personalProjectId}/tasks`)
        .send({
          title: '  Écrire le rapport  ',
          priority: 'HIGH',
          dueDate: '2030-01-15T10:00:00.000Z',
        })
        .expect(201);
      expect(created.body).toMatchObject({
        title: 'Écrire le rapport',
        status: 'TODO',
        priority: 'HIGH',
        projectName: 'Mes tâches',
        creator: { userId: alice.id, name: 'Alice' },
        assignee: null,
        completedAt: null,
      });

      const id = created.body.id as string;
      await as(alice).get(`/api/v1/tasks/${id}`).expect(200);

      const done = await as(alice)
        .patch(`/api/v1/tasks/${id}`)
        .send({ status: 'DONE' })
        .expect(200);
      expect(done.body.completedAt).toEqual(expect.any(String));

      const reopened = await as(alice)
        .patch(`/api/v1/tasks/${id}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
      expect(reopened.body.completedAt).toBeNull();

      await as(alice).delete(`/api/v1/tasks/${id}`).expect(204);
      await as(alice).get(`/api/v1/tasks/${id}`).expect(404);
    });

    it('rejette projectId / creatorId / completedAt dans le body (400)', async () => {
      const task = await ctx.factory.task(alice.personalProjectId);
      for (const body of [
        { projectId: bob.personalProjectId },
        { creatorId: bob.id },
        { completedAt: new Date().toISOString() },
      ]) {
        await as(alice).patch(`/api/v1/tasks/${task.id}`).send(body).expect(400);
      }
      const unchanged = await ctx.prisma.task.findUniqueOrThrow({ where: { id: task.id } });
      expect(unchanged.projectId).toBe(alice.personalProjectId);
    });

    it('rejette un titre null ou vide', async () => {
      const task = await ctx.factory.task(alice.personalProjectId);
      await as(alice).patch(`/api/v1/tasks/${task.id}`).send({ title: null }).expect(400);
      await as(alice).patch(`/api/v1/tasks/${task.id}`).send({ title: '   ' }).expect(400);
    });

    it('répond 400 pour un identifiant non UUID', async () => {
      await as(alice).get('/api/v1/tasks/123').expect(400);
    });
  });

  describe('« ce qui n’est pas à moi n’existe pas »', () => {
    it("une tâche d'autrui est indiscernable d'un UUID inexistant", async () => {
      const foreign = await ctx.factory.task(bob.personalProjectId);
      const a = await as(alice).get(`/api/v1/tasks/${foreign.id}`);
      const b = await as(alice).get(`/api/v1/tasks/${randomId()}`);
      expect(a.status).toBe(404);
      expect(b.status).toBe(404);
      const strip = ({ requestId: _ignored, ...body }: Record<string, unknown>) => body;
      expect(strip(a.body)).toEqual(strip(b.body));
    });

    it("ne divulgue aucune donnée d'un projet étranger dans les listes et le tableau de bord", async () => {
      const secret = 'SECRET-DE-BOB';
      const bobProject = await ctx.factory.project(bob, [], secret);
      await ctx.factory.task(bobProject.id, { title: secret, assigneeId: bob.id });
      await ctx.factory.task(bob.personalProjectId, { title: secret });
      await ctx.factory.task(alice.personalProjectId, { title: 'Tâche Alice' });

      const responses = await Promise.all([
        as(alice).get('/api/v1/tasks'),
        as(alice).get('/api/v1/projects'),
        as(alice).get('/api/v1/dashboard'),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).not.toContain(secret);
      }
      expect(responses[0]!.body.meta.total).toBe(1);
    });

    it("s'assigner une tâche d'un projet étranger → 404 (pas 422)", async () => {
      const foreign = await ctx.factory.task(bob.personalProjectId);
      await as(alice)
        .patch(`/api/v1/tasks/${foreign.id}`)
        .send({ assigneeId: alice.id })
        .expect(404);
    });

    it('créer une tâche dans un projet étranger → 404', async () => {
      await as(alice)
        .post(`/api/v1/projects/${bob.personalProjectId}/tasks`)
        .send({ title: 'Intrusion' })
        .expect(404);
      expect(await ctx.prisma.task.count()).toBe(0);
    });

    it('aucune réponse ne contient passwordHash ni tokenHash', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
      await ctx.factory.task(project.id, { assigneeId: bob.id });
      const bodies = await Promise.all([
        as(alice).get('/api/v1/users/me'),
        as(alice).get(`/api/v1/projects/${project.id}/members`),
        as(alice).get(`/api/v1/projects/${project.id}/tasks`),
        as(alice).get('/api/v1/dashboard'),
      ]);
      for (const res of bodies) {
        expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash|password_hash/);
      }
    });
  });

  describe('assignation (R6)', () => {
    it('assigne une tâche à un membre du projet', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
      const task = await ctx.factory.task(project.id);
      const res = await as(alice)
        .patch(`/api/v1/tasks/${task.id}`)
        .send({ assigneeId: bob.id })
        .expect(200);
      expect(res.body.assignee).toEqual({ userId: bob.id, name: 'Bob' });
    });

    it('refuse un assigné non membre du projet (422), tâche inchangée', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
      const task = await ctx.factory.task(project.id);
      const res = await as(alice)
        .patch(`/api/v1/tasks/${task.id}`)
        .send({ assigneeId: eve.id })
        .expect(422);
      expect(res.body.message).toBe('La personne assignée doit être membre du projet');
      expect(
        (await ctx.prisma.task.findUniqueOrThrow({ where: { id: task.id } })).assigneeId,
      ).toBeNull();
    });

    it('refuse un assigné non membre à la création (422)', async () => {
      await as(alice)
        .post(`/api/v1/projects/${alice.personalProjectId}/tasks`)
        .send({ title: 'x', assigneeId: eve.id })
        .expect(422);
      expect(await ctx.prisma.task.count()).toBe(0);
    });

    it('un VIEWER peut être assigné mais ne peut pas modifier la tâche', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'VIEWER']]);
      const task = await ctx.factory.task(project.id, { assigneeId: bob.id });
      await as(bob).get(`/api/v1/tasks/${task.id}`).expect(200);
      await as(bob).patch(`/api/v1/tasks/${task.id}`).send({ status: 'DONE' }).expect(404);
    });
  });

  describe('membres', () => {
    it('retirer un membre désassigne ses tâches, qui restent dans le projet (C7)', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
      const task = await ctx.factory.task(project.id, { assigneeId: bob.id });
      await as(alice).delete(`/api/v1/projects/${project.id}/members/${bob.id}`).expect(204);

      const after = await ctx.prisma.task.findUniqueOrThrow({ where: { id: task.id } });
      expect(after.assigneeId).toBeNull();
      expect(after.projectId).toBe(project.id);
      await as(bob).get(`/api/v1/tasks/${task.id}`).expect(404);
    });

    it('quitter un projet désassigne aussi ses tâches', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
      const task = await ctx.factory.task(project.id, { assigneeId: bob.id });
      await as(bob).post(`/api/v1/projects/${project.id}/leave`).expect(204);
      expect(
        (await ctx.prisma.task.findUniqueOrThrow({ where: { id: task.id } })).assigneeId,
      ).toBeNull();
    });

    it('ajout d’un membre déjà présent → 409 ; email inconnu → 404', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
      await as(alice)
        .post(`/api/v1/projects/${project.id}/members`)
        .send({ email: bob.email, role: 'VIEWER' })
        .expect(409);
      await as(alice)
        .post(`/api/v1/projects/${project.id}/members`)
        .send({ email: 'inconnu@test.dev', role: 'VIEWER' })
        .expect(404);
    });

    it('refuse d’attribuer le rôle OWNER (400)', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
      await as(alice)
        .patch(`/api/v1/projects/${project.id}/members/${bob.id}`)
        .send({ role: 'OWNER' })
        .expect(400);
    });

    it('un changement de rôle est effectif immédiatement, sans nouveau token', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
      const task = await ctx.factory.task(project.id);
      await as(bob).patch(`/api/v1/tasks/${task.id}`).send({ title: 'ok' }).expect(200);
      await as(alice)
        .patch(`/api/v1/projects/${project.id}/members/${bob.id}`)
        .send({ role: 'VIEWER' })
        .expect(200);
      await as(bob).patch(`/api/v1/tasks/${task.id}`).send({ title: 'refusé' }).expect(404);
    });
  });

  describe('projet personnel (C1, C2)', () => {
    it('ne peut pas recevoir de membres', async () => {
      await as(alice)
        .post(`/api/v1/projects/${alice.personalProjectId}/members`)
        .send({ email: bob.email, role: 'MEMBER' })
        .expect(404);
    });

    it('ne peut pas être supprimé', async () => {
      await as(alice).delete(`/api/v1/projects/${alice.personalProjectId}`).expect(404);
    });

    it('apparaît en premier dans la liste avec isPersonal', async () => {
      await ctx.factory.project(alice, [], 'AAA');
      const res = await as(alice).get('/api/v1/projects').expect(200);
      expect(res.body[0]).toMatchObject({
        id: alice.personalProjectId,
        isPersonal: true,
        myRole: 'OWNER',
      });
      expect(res.body[1]).toMatchObject({ name: 'AAA', isPersonal: false });
    });
  });

  describe('projets', () => {
    it('crée un projet dont le créateur est OWNER', async () => {
      const res = await as(alice).post('/api/v1/projects').send({ name: 'Nouveau' }).expect(201);
      expect(res.body).toMatchObject({
        name: 'Nouveau',
        myRole: 'OWNER',
        memberCount: 1,
        isPersonal: false,
        taskCounts: { TODO: 0, IN_PROGRESS: 0, DONE: 0 },
      });
    });

    it('supprimer un projet supprime ses tâches et ses membres (cascade, FK NO ACTION)', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
      await ctx.factory.task(project.id, { assigneeId: bob.id });
      await as(alice).delete(`/api/v1/projects/${project.id}`).expect(204);
      expect(await ctx.prisma.task.count({ where: { projectId: project.id } })).toBe(0);
      expect(await ctx.prisma.projectMember.count({ where: { projectId: project.id } })).toBe(0);
    });
  });

  describe('listes et filtres', () => {
    it('filtre par statut, assignation, recherche ; pagine', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
      await ctx.factory.task(project.id, { title: 'Alpha', status: 'TODO', assigneeId: bob.id });
      await ctx.factory.task(project.id, { title: 'Beta', status: 'IN_PROGRESS' });
      await ctx.factory.task(project.id, { title: 'Gamma', status: 'DONE' });
      const base = `/api/v1/projects/${project.id}/tasks`;

      const byStatus = await as(alice).get(`${base}?status=TODO&status=IN_PROGRESS`).expect(200);
      expect(byStatus.body.meta.total).toBe(2);

      const unassigned = await as(alice).get(`${base}?assigneeId=none`).expect(200);
      expect(unassigned.body.meta.total).toBe(2);

      const mine = await as(bob).get('/api/v1/tasks?assignedToMe=true').expect(200);
      expect(mine.body.data.map((t: { title: string }) => t.title)).toEqual(['Alpha']);

      const search = await as(alice).get(`${base}?q=amm`).expect(200);
      expect(search.body.data.map((t: { title: string }) => t.title)).toEqual(['Gamma']);

      const page = await as(alice)
        .get(`${base}?pageSize=2&page=2&sort=createdAt&order=asc`)
        .expect(200);
      expect(page.body.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
      expect(page.body.data).toHaveLength(1);
    });

    it('rejette des paramètres de requête invalides (400)', async () => {
      await as(alice).get('/api/v1/tasks?status=WRONG').expect(400);
      await as(alice).get('/api/v1/tasks?pageSize=500').expect(400);
      await as(alice).get('/api/v1/tasks?unknown=1').expect(400);
    });
  });

  describe('tableau de bord', () => {
    it('agrège compteurs, retards, assignations et progression', async () => {
      const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
      const past = new Date(Date.now() - 86_400_000);
      const soon = new Date(Date.now() + 2 * 86_400_000);
      await ctx.factory.task(project.id, { status: 'TODO', dueDate: past, assigneeId: alice.id });
      await ctx.factory.task(project.id, { status: 'IN_PROGRESS', dueDate: soon });
      await ctx.factory.task(project.id, { status: 'DONE' });
      await ctx.factory.task(project.id, { status: 'DONE', dueDate: past });

      const res = await as(alice).get('/api/v1/dashboard').expect(200);
      expect(res.body.counts).toEqual({ TODO: 1, IN_PROGRESS: 1, DONE: 2 });
      expect(res.body.overdue).toBe(1);
      expect(res.body.dueSoon).toHaveLength(1);
      expect(res.body.assignedToMe).toHaveLength(1);
      expect(res.body.recentlyCompleted).toHaveLength(2);
      const shared = res.body.projects.find((p: { id: string }) => p.id === project.id);
      expect(shared.progress).toBe(0.5);
    });
  });

  describe('santé et routes inconnues', () => {
    it('health/live et health/ready sont publics', async () => {
      await ctx.http().get('/api/v1/health/live').expect(200);
      await ctx.http().get('/api/v1/health/ready').expect(200, { status: 'ok', database: 'up' });
    });

    it('route inconnue → 404 avec le corps standard', async () => {
      const res = await as(alice).get('/api/v1/nope').expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, message: 'Ressource introuvable' });
    });
  });
});
