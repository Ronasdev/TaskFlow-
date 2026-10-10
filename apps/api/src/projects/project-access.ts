import { Prisma, ProjectRole } from '@prisma/client';

/**
 * Constructeurs de WHERE d'autorisation — docs/SECURITY.md §3.
 *
 * Règle : aucune requête sur Project / ProjectMember / Task sans l'un de ces filtres.
 * La propriété (appartenance + rôle) est dans le WHERE, jamais vérifiée dans un `if` après lecture.
 */

export const ALL_ROLES: readonly ProjectRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
export const EDITORS: readonly ProjectRole[] = ['OWNER', 'ADMIN', 'MEMBER'];
export const MANAGERS: readonly ProjectRole[] = ['OWNER', 'ADMIN'];
export const OWNER_ONLY: readonly ProjectRole[] = ['OWNER'];

/** Le projet a pour membre `userId` avec l'un des rôles donnés. */
export const memberWith = (
  userId: string,
  roles: readonly ProjectRole[],
): Prisma.ProjectWhereInput => ({
  members: { some: { userId, role: { in: [...roles] } } },
});

export const projectWhereReadable = (userId: string) => memberWith(userId, ALL_ROLES);
export const projectWhereEditable = (userId: string) => memberWith(userId, EDITORS);
export const projectWhereManageable = (userId: string) => memberWith(userId, MANAGERS);

/** Supprimable : OWNER, et jamais le projet personnel (C2). */
export const projectWhereDeletable = (userId: string): Prisma.ProjectWhereInput => ({
  personalForUserId: null,
  ...memberWith(userId, OWNER_ONLY),
});

/**
 * Projet dans lequel `actorId` peut ajouter un membre ayant le rôle `role` :
 * OWNER/ADMIN pour MEMBER/VIEWER, OWNER seul pour ADMIN (C5), jamais le projet personnel (C2).
 */
export const projectWhereCanAddMember = (
  actorId: string,
  role: ProjectRole,
): Prisma.ProjectWhereInput => ({
  personalForUserId: null,
  ...memberWith(actorId, role === 'ADMIN' ? OWNER_ONLY : MANAGERS),
});

/**
 * Adhésion (ligne ProjectMember) que `actorId` peut gérer (changer de rôle / retirer) :
 * - OWNER : cible ADMIN, MEMBER ou VIEWER ;
 * - ADMIN : cible MEMBER ou VIEWER, et uniquement vers un rôle MEMBER/VIEWER (C5) ;
 * - l'OWNER n'est jamais ciblable (C4).
 *
 * `targetRole` = nouveau rôle visé (changement de rôle) ; omis pour un retrait.
 */
export const memberWhereManageable = (
  actorId: string,
  targetRole?: ProjectRole,
): Prisma.ProjectMemberWhereInput => {
  const byOwner: Prisma.ProjectMemberWhereInput = {
    role: { in: ['ADMIN', 'MEMBER', 'VIEWER'] },
    project: memberWith(actorId, OWNER_ONLY),
  };
  const byAdmin: Prisma.ProjectMemberWhereInput = {
    role: { in: ['MEMBER', 'VIEWER'] },
    project: memberWith(actorId, MANAGERS),
  };
  const adminAllowed =
    targetRole === undefined || targetRole === 'MEMBER' || targetRole === 'VIEWER';

  return {
    project: { personalForUserId: null },
    OR: adminAllowed ? [byOwner, byAdmin] : [byOwner],
  };
};
