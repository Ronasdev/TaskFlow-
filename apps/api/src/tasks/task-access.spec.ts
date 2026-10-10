import { memberWith } from '../projects/project-access';
import {
  taskWhereDeletable,
  taskWhereDoneGuarded,
  taskWhereEditable,
  taskWhereReadable,
  taskWhereReopenable,
} from './task-access';

const U = 'user-1';

describe('task-access', () => {
  it('lecture : tous les rôles du projet', () => {
    expect(taskWhereReadable(U)).toEqual({
      project: memberWith(U, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
    });
  });

  it('édition : OWNER, ADMIN, MEMBER (jamais VIEWER)', () => {
    expect(taskWhereEditable(U)).toEqual({ project: memberWith(U, ['OWNER', 'ADMIN', 'MEMBER']) });
  });

  it('DONE protégée : tâche non DONE pour un EDITOR, ou n’importe laquelle pour OWNER/ADMIN', () => {
    expect(taskWhereDoneGuarded(U)).toEqual({
      OR: [
        { status: { not: 'DONE' }, project: memberWith(U, ['OWNER', 'ADMIN', 'MEMBER']) },
        { project: memberWith(U, ['OWNER', 'ADMIN']) },
      ],
    });
  });

  it('suppression (R5) et réouverture (C12) partagent la même règle', () => {
    expect(taskWhereDeletable).toBe(taskWhereDoneGuarded);
    expect(taskWhereReopenable).toBe(taskWhereDoneGuarded);
  });
});
