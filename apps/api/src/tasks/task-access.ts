import { Prisma } from '@prisma/client';
import { ALL_ROLES, EDITORS, MANAGERS, memberWith } from '../projects/project-access';

/** Constructeurs de WHERE d'autorisation sur les tâches — docs/SECURITY.md §3.2. */

export const taskWhereReadable = (userId: string): Prisma.TaskWhereInput => ({
  project: memberWith(userId, ALL_ROLES),
});

export const taskWhereEditable = (userId: string): Prisma.TaskWhereInput => ({
  project: memberWith(userId, EDITORS),
});

/**
 * Une tâche DONE n'est supprimable (R5) ni réouvrable (C12) que par OWNER/ADMIN ;
 * une tâche non DONE l'est par tout EDITOR.
 */
export const taskWhereDoneGuarded = (userId: string): Prisma.TaskWhereInput => ({
  OR: [
    { status: { not: 'DONE' }, project: memberWith(userId, EDITORS) },
    { project: memberWith(userId, MANAGERS) },
  ],
});

export const taskWhereDeletable = taskWhereDoneGuarded;
export const taskWhereReopenable = taskWhereDoneGuarded;
