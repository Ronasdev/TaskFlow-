import { describe, expect, it } from 'vitest';
import type { ProjectRole } from '@/types/api';
import { can } from './permissions';

/** Table de vérité identique à la matrice e2e de l'API (docs/TESTING.md §4). */
const ROLES: ProjectRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
const table = (fn: (role: ProjectRole) => boolean) => ROLES.map(fn);

describe('can()', () => {
  it('tâches', () => {
    expect(table(can.createTask)).toEqual([true, true, true, false]);
    expect(table(can.editTask)).toEqual([true, true, true, false]);
    expect(table((role) => can.deleteTask(role, 'TODO'))).toEqual([true, true, true, false]);
    expect(table((role) => can.deleteTask(role, 'DONE'))).toEqual([true, true, false, false]);
    expect(table((role) => can.changeStatus(role, 'DONE', 'TODO'))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(table((role) => can.changeStatus(role, 'TODO', 'DONE'))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('projets', () => {
    expect(table(can.editProject)).toEqual([true, true, false, false]);
    expect(table((role) => can.deleteProject(role, false))).toEqual([true, false, false, false]);
    expect(table((role) => can.deleteProject(role, true))).toEqual([false, false, false, false]);
    expect(table(can.leaveProject)).toEqual([false, true, true, true]);
  });

  it('membres', () => {
    expect(table((role) => can.manageMembers(role, false))).toEqual([true, true, false, false]);
    expect(table((role) => can.manageMembers(role, true))).toEqual([false, false, false, false]);
    expect(can.assignableRoles('OWNER')).toEqual(['ADMIN', 'MEMBER', 'VIEWER']);
    expect(can.assignableRoles('ADMIN')).toEqual(['MEMBER', 'VIEWER']);
    expect(can.assignableRoles('MEMBER')).toEqual([]);

    expect(table((target) => can.manageMember('OWNER', target))).toEqual([false, true, true, true]);
    expect(table((target) => can.manageMember('ADMIN', target))).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(table((target) => can.manageMember('MEMBER', target))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
