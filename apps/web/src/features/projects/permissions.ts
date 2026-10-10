import type { AssignableRole, ProjectRole, TaskStatus } from '@/types/api';

/**
 * Reflet de la matrice des permissions (docs/BUSINESS_RULES.md §3).
 * Sert uniquement à masquer / désactiver des actions : l'API reste la seule autorité.
 */

const isManager = (role: ProjectRole) => role === 'OWNER' || role === 'ADMIN';
const isEditor = (role: ProjectRole) => role !== 'VIEWER';

export const can = {
  editProject: (role: ProjectRole) => isManager(role),
  deleteProject: (role: ProjectRole, isPersonal: boolean) => role === 'OWNER' && !isPersonal,
  leaveProject: (role: ProjectRole) => role !== 'OWNER',
  manageMembers: (role: ProjectRole, isPersonal: boolean) => isManager(role) && !isPersonal,

  /** Rôles que `actor` peut attribuer (ajout ou changement de rôle). */
  assignableRoles: (actor: ProjectRole): AssignableRole[] =>
    actor === 'OWNER'
      ? ['ADMIN', 'MEMBER', 'VIEWER']
      : actor === 'ADMIN'
        ? ['MEMBER', 'VIEWER']
        : [],

  /** `actor` peut-il changer le rôle de / retirer un membre ayant le rôle `target` ? */
  manageMember: (actor: ProjectRole, target: ProjectRole) =>
    target !== 'OWNER' &&
    (actor === 'OWNER' || (actor === 'ADMIN' && (target === 'MEMBER' || target === 'VIEWER'))),

  createTask: (role: ProjectRole) => isEditor(role),
  editTask: (role: ProjectRole) => isEditor(role),

  /** R5 : une tâche DONE n'est supprimable que par OWNER / ADMIN. */
  deleteTask: (role: ProjectRole, status: TaskStatus) =>
    status === 'DONE' ? isManager(role) : isEditor(role),

  /** C12 : rouvrir une tâche DONE est réservé à OWNER / ADMIN. */
  changeStatus: (role: ProjectRole, from: TaskStatus, to: TaskStatus) =>
    isEditor(role) && (from !== 'DONE' || to === 'DONE' || isManager(role)),
};

export const ROLE_LABELS: Record<ProjectRole, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  MEMBER: 'Membre',
  VIEWER: 'Lecteur',
};
