import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { UserProfile, UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AccessTokenPayload } from './strategies/jwt.strategy';
import { generateRefreshToken, hashToken } from './tokens';

export const PERSONAL_PROJECT_NAME = 'Mes tâches';
const INVALID_CREDENTIALS = 'Identifiants invalides';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

export interface Session {
  accessToken: string;
  /** Token clair : uniquement transmis au navigateur via le cookie, jamais persisté. */
  refreshToken: string;
  user: UserProfile;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Hash factice vérifié quand l'email est inconnu : temps de réponse identique (SECURITY.md §2.1). */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Crée l'utilisateur, son projet personnel et son adhésion OWNER de façon atomique (C1). */
  async register(dto: RegisterDto, meta: ClientMeta): Promise<Session> {
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    let userId: string;
    try {
      userId = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email: dto.email, passwordHash, name: dto.name },
          select: { id: true },
        });
        await tx.project.create({
          data: {
            name: PERSONAL_PROJECT_NAME,
            personalForUserId: created.id,
            members: { create: { userId: created.id, role: 'OWNER' } },
          },
        });
        return created.id;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un compte existe déjà avec cet email');
      }
      throw error;
    }
    return this.startSession(userId, meta);
  }

  async login(dto: LoginDto, meta: ClientMeta): Promise<Session> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, passwordHash: true },
    });
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await argon2.verify(hash, dto.password);
    if (!user || !valid) throw new UnauthorizedException(INVALID_CREDENTIALS);
    return this.startSession(user.id, meta);
  }

  /**
   * Rotation du refresh token (SECURITY.md §2.3) :
   * - un token révoqué présenté à nouveau = réutilisation : toute la famille est révoquée ;
   * - révocation conditionnelle (revokedAt: null) : un seul refresh concurrent peut gagner.
   */
  async refresh(rawToken: string | undefined, meta: ClientMeta): Promise<Session> {
    if (!rawToken) throw new UnauthorizedException();

    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!current) throw new UnauthorizedException();

    if (current.revokedAt) {
      await this.revokeFamily(current.familyId);
      this.logger.warn(
        { userId: current.userId, familyId: current.familyId },
        'Réutilisation de refresh token détectée : session révoquée',
      );
      throw new UnauthorizedException();
    }
    if (current.expiresAt <= new Date()) throw new UnauthorizedException();

    const refreshToken = generateRefreshToken();
    await this.prisma.$transaction(async (tx) => {
      const next = await tx.refreshToken.create({
        data: this.refreshTokenData(current.userId, current.familyId, refreshToken, meta),
        select: { id: true },
      });
      const { count } = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: next.id },
      });
      // Un refresh concurrent a déjà consommé ce token : annule la transaction.
      if (count === 0) throw new UnauthorizedException();
    });

    return {
      accessToken: await this.signAccessToken(current.userId, current.familyId),
      refreshToken,
      user: await this.users.getProfile(current.userId),
    };
  }

  /** Révoque la session du cookie courant. Idempotent. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      select: { familyId: true },
    });
    if (token) await this.revokeFamily(token.familyId);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Purge quotidienne : tokens expirés, ou révoqués depuis plus de 7 jours. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeRefreshTokens(): Promise<number> {
    const now = Date.now();
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date(now) } },
          { revokedAt: { lt: new Date(now - 7 * DAY_MS) } },
        ],
      },
    });
    this.logger.log(`${count} refresh token(s) purgé(s)`);
    return count;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= argon2.hash(randomUUID(), { type: argon2.argon2id });
    return this.dummyHash;
  }

  private async startSession(userId: string, meta: ClientMeta): Promise<Session> {
    const familyId = randomUUID();
    const refreshToken = generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: this.refreshTokenData(userId, familyId, refreshToken, meta),
    });
    return {
      accessToken: await this.signAccessToken(userId, familyId),
      refreshToken,
      user: await this.users.getProfile(userId),
    };
  }

  private refreshTokenData(
    userId: string,
    familyId: string,
    rawToken: string,
    meta: ClientMeta,
  ): Prisma.RefreshTokenUncheckedCreateInput {
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    return {
      userId,
      familyId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
      userAgent: meta.userAgent?.slice(0, 500),
      ip: meta.ip?.slice(0, 64),
    };
  }

  private signAccessToken(userId: string, familyId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, sid: familyId };
    return this.jwt.signAsync(payload);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
