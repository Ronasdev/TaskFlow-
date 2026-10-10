import {
  memberWhereManageable,
  memberWith,
  projectWhereCanAddMember,
  projectWhereDeletable,
  projectWhereEditable,
  projectWhereManageable,
  projectWhereReadable,
} from './project-access';

const U = 'user-1';

describe('project-access', () => {
  it('memberWith filtre sur l’utilisateur et les rôles', () => {
    expect(memberWith(U, ['OWNER'])).toEqual({
      members: { some: { userId: U, role: { in: ['OWNER'] } } },
    });
  });

  it.each([
    ['readable', projectWhereReadable, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']],
    ['editable', projectWhereEditable, ['OWNER', 'ADMIN', 'MEMBER']],
    ['manageable', projectWhereManageable, ['OWNER', 'ADMIN']],
  ] as const)('projectWhere %s', (_name, build, roles) => {
    expect(build(U)).toEqual(memberWith(U, roles));
  });

  it('projectWhereDeletable : OWNER et jamais le projet personnel', () => {
    expect(projectWhereDeletable(U)).toEqual({
      personalForUserId: null,
      ...memberWith(U, ['OWNER']),
    });
  });

  it('projectWhereCanAddMember : seul OWNER ajoute un ADMIN', () => {
    expect(projectWhereCanAddMember(U, 'ADMIN')).toEqual({
      personalForUserId: null,
      ...memberWith(U, ['OWNER']),
    });
    expect(projectWhereCanAddMember(U, 'MEMBER')).toEqual({
      personalForUserId: null,
      ...memberWith(U, ['OWNER', 'ADMIN']),
    });
  });

  describe('memberWhereManageable', () => {
    const byOwner = {
      role: { in: ['ADMIN', 'MEMBER', 'VIEWER'] },
      project: memberWith(U, ['OWNER']),
    };
    const byAdmin = {
      role: { in: ['MEMBER', 'VIEWER'] },
      project: memberWith(U, ['OWNER', 'ADMIN']),
    };

    it.each([undefined, 'MEMBER', 'VIEWER'] as const)(
      'cible %s : OWNER gère tout sauf OWNER, ADMIN gère MEMBER/VIEWER',
      (target) => {
        expect(memberWhereManageable(U, target)).toEqual({
          project: { personalForUserId: null },
          OR: [byOwner, byAdmin],
        });
      },
    );

    it('promotion en ADMIN : OWNER uniquement', () => {
      expect(memberWhereManageable(U, 'ADMIN')).toEqual({
        project: { personalForUserId: null },
        OR: [byOwner],
      });
    });

    it("l'OWNER n'est jamais ciblable", () => {
      const where = memberWhereManageable(U);
      const roles = (where.OR ?? []).flatMap((clause) => (clause.role as { in: string[] }).in);
      expect(roles).not.toContain('OWNER');
    });
  });
});
