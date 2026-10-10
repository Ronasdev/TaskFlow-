/**
 * Données de démonstration (développement uniquement) — docs/DATA_MODEL.md §8.
 * Alice OWNER, Bob MEMBER, Carol VIEWER sur un projet partagé ; mot de passe : Password123!
 */
import { Prisma, PrismaClient, ProjectRole, TaskPriority, TaskStatus } from '@prisma/client';
import * as argon2 from 'argon2';

if (process.env.NODE_ENV === 'production') {
  console.error('Le seed de démonstration est interdit en production.');
  process.exit(1);
}

const prisma = new PrismaClient();
const PASSWORD = 'Password123!';
const DAY = 24 * 60 * 60 * 1000;

async function createUser(email: string, name: string, passwordHash: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, name, passwordHash } });
    await tx.project.create({
      data: {
        name: 'Mes tâches',
        personalForUserId: user.id,
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    });
    return user;
  });
}

async function main() {
  if (await prisma.user.findUnique({ where: { email: 'alice@demo.dev' } })) {
    console.log('Données de démonstration déjà présentes, rien à faire.');
    return;
  }

  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const alice = await createUser('alice@demo.dev', 'Alice Martin', passwordHash);
  const bob = await createUser('bob@demo.dev', 'Bob Durand', passwordHash);
  const carol = await createUser('carol@demo.dev', 'Carol Petit', passwordHash);

  const members: { userId: string; role: ProjectRole }[] = [
    { userId: alice.id, role: 'OWNER' },
    { userId: bob.id, role: 'MEMBER' },
    { userId: carol.id, role: 'VIEWER' },
  ];
  const project = await prisma.project.create({
    data: {
      name: 'Refonte du site vitrine',
      description: 'Nouvelle identité visuelle et migration du contenu.',
      members: { create: members },
    },
  });

  const titles = [
    'Audit du site existant',
    'Atelier avec le client',
    'Arborescence des pages',
    'Maquettes basse fidélité',
    'Charte graphique',
    "Maquettes de la page d'accueil",
    'Rédaction des contenus',
    'Choix de l’hébergement',
    'Intégration de la page d’accueil',
    'Formulaire de contact',
    'Optimisation des images',
    'Tests d’accessibilité',
    'Recette client',
    'Redirections SEO',
    'Mise en production',
  ];
  const statuses: TaskStatus[] = [
    'DONE',
    'DONE',
    'DONE',
    'DONE',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'TODO',
  ];
  const priorities: TaskPriority[] = ['HIGH', 'MEDIUM', 'LOW'];
  const assignees = [alice.id, bob.id, carol.id, null];

  await prisma.task.createMany({
    data: titles.map((title, index) => {
      const status = statuses[index] ?? 'TODO';
      return {
        projectId: project.id,
        creatorId: index % 3 === 0 ? bob.id : alice.id,
        title,
        status,
        priority: priorities[index % priorities.length]!,
        assigneeId: assignees[index % assignees.length] ?? null,
        dueDate: new Date(Date.now() + (index - 4) * 2 * DAY),
        completedAt: status === 'DONE' ? new Date(Date.now() - (5 - index) * DAY) : null,
      };
    }),
  });

  const alicePersonal = await prisma.project.findUniqueOrThrow({
    where: { personalForUserId: alice.id },
  });
  const personalTasks: Pick<
    Prisma.TaskCreateManyInput,
    'title' | 'priority' | 'dueDate' | 'status'
  >[] = [
    { title: 'Prendre rendez-vous chez le dentiste', priority: 'LOW' },
    {
      title: 'Préparer la présentation du lundi',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + DAY),
    },
    { title: 'Relire le contrat de prestation', priority: 'MEDIUM', status: 'IN_PROGRESS' },
  ];
  await prisma.task.createMany({
    data: personalTasks.map((task) => ({
      ...task,
      projectId: alicePersonal.id,
      creatorId: alice.id,
      assigneeId: alice.id,
    })),
  });

  console.log(`Seed terminé. Comptes : alice@demo.dev, bob@demo.dev, carol@demo.dev / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
