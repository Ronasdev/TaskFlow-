/** Contraintes garanties par la base, indépendamment du code applicatif — docs/TESTING.md §6. */
import { closeTestApp, createTestApp, resetDatabase, TestContext } from '../utils/app';

describe('Contraintes SQL', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => closeTestApp(ctx));
  beforeEach(() => resetDatabase(ctx.prisma));

  it('interdit deux OWNER sur un même projet', async () => {
    const alice = await ctx.factory.user();
    const bob = await ctx.factory.user();
    await expect(
      ctx.prisma.projectMember.create({
        data: { projectId: alice.personalProjectId, userId: bob.id, role: 'OWNER' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('interdit status = DONE sans completed_at (et inversement)', async () => {
    const alice = await ctx.factory.user();
    await expect(
      ctx.prisma.task.create({
        data: { projectId: alice.personalProjectId, title: 'x', status: 'DONE', completedAt: null },
      }),
    ).rejects.toThrow(/task_completed_at_consistent/);
    await expect(
      ctx.prisma.task.create({
        data: {
          projectId: alice.personalProjectId,
          title: 'x',
          status: 'TODO',
          completedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/task_completed_at_consistent/);
  });

  it('interdit un assigné non membre du projet (FK composite)', async () => {
    const alice = await ctx.factory.user();
    const bob = await ctx.factory.user();
    await expect(
      ctx.prisma.$executeRaw`INSERT INTO tasks (id, project_id, title, assignee_id, updated_at)
        VALUES (gen_random_uuid(), ${alice.personalProjectId}::uuid, 'x', ${bob.id}::uuid, now())`,
    ).rejects.toThrow(/tasks_assignee_fkey/);
  });

  it('bloque la suppression d’un membre encore assigné (le service doit désassigner)', async () => {
    const alice = await ctx.factory.user();
    const bob = await ctx.factory.user();
    const project = await ctx.factory.project(alice, [[bob, 'MEMBER']]);
    await ctx.factory.task(project.id, { assigneeId: bob.id });
    await expect(
      ctx.prisma.projectMember.delete({
        where: { projectId_userId: { projectId: project.id, userId: bob.id } },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('interdit un titre vide', async () => {
    const alice = await ctx.factory.user();
    await expect(
      ctx.prisma.task.create({ data: { projectId: alice.personalProjectId, title: '   ' } }),
    ).rejects.toThrow(/task_title_not_blank/);
  });
});
