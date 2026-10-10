import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** `passwordHash` n'est jamais sélectionné ici. */
const profileSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  personalProject: { select: { id: true } },
} satisfies Prisma.UserSelect;

type ProfileRow = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  personalProjectId: string | null;
  createdAt: Date;
}

const toProfile = ({ personalProject, ...user }: ProfileRow): UserProfile => ({
  ...user,
  personalProjectId: personalProject?.id ?? null,
});

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });
    // Token valide mais compte introuvable : la session n'a plus de sens.
    if (!user) throw new UnauthorizedException();
    return toProfile(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: profileSelect,
    });
    return toProfile(user);
  }

  /** Change le mot de passe et révoque toutes les autres sessions (SECURITY.md §2.3). */
  async changePassword(userId: string, sessionId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null, familyId: { not: sessionId } },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
