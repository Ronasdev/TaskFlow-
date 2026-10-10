import { JwtService } from '@nestjs/jwt';
import { Prisma, ProjectRole, TaskStatus, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/prisma/prisma.service';

export const TEST_PASSWORD = 'Password123!';

let passwordHash: Promise<string> | undefined;
let sequence = 0;

export interface TestUser extends User {
  token: string;
  personalProjectId: string;
}

/** Fabriques de données : écrivent directement en base, sans passer par l'API. */
export class Factory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Utilisateur + projet personnel + access token valide. */
  async user(overrides: Partial<Pick<User, 'email' | 'name'>> = {}): Promise<TestUser> {
    passwordHash ??= argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
    sequence += 1;
    const user = await this.prisma.user.create({
      data: {
        email: overrides.email ?? `user${sequence}-${randomUUID().slice(0, 8)}@test.dev`,
        name: overrides.name ?? `Utilisateur ${sequence}`,
        passwordHash: await passwordHash,
      },
    });
    const personal = await this.prisma.project.create({
      data: {
        name: 'Mes tâches',
        personalForUserId: user.id,
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    });
    return { ...user, token: await this.tokenFor(user.id), personalProjectId: personal.id };
  }

  tokenFor(userId: string, sessionId: string = randomUUID()): Promise<string> {
    return this.jwt.signAsync({ sub: userId, sid: sessionId });
  }

  /** Projet partagé : `owner` OWNER, puis les membres donnés. */
  async project(owner: User, members: [User, ProjectRole][] = [], name = 'Projet de test') {
    return this.prisma.project.create({
      data: {
        name,
        members: {
          create: [
            { userId: owner.id, role: 'OWNER' as ProjectRole },
            ...members.map(([user, role]) => ({ userId: user.id, role })),
          ],
        },
      },
    });
  }

  async task(
    projectId: string,
    overrides: Partial<Prisma.TaskUncheckedCreateInput> & { status?: TaskStatus } = {},
  ) {
    const status = overrides.status ?? 'TODO';
    return this.prisma.task.create({
      data: {
        projectId,
        title: 'Tâche de test',
        completedAt: status === 'DONE' ? new Date() : null,
        ...overrides,
        status,
      },
    });
  }
}
