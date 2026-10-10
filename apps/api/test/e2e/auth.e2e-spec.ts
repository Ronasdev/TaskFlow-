/** Authentification — docs/TESTING.md §5. */
import { JwtService } from '@nestjs/jwt';
import { closeTestApp, createTestApp, freshIp, resetDatabase, TestContext } from '../utils/app';
import { hashToken } from '../../src/auth/tokens';

const REGISTER = '/api/v1/auth/register';
const LOGIN = '/api/v1/auth/login';
const REFRESH = '/api/v1/auth/refresh';
const LOGOUT = '/api/v1/auth/logout';

/** Extrait la valeur du cookie refresh_token d'une réponse. */
function refreshCookie(headers: Record<string, unknown>): string {
  const cookies = (headers['set-cookie'] as string[] | undefined) ?? [];
  const cookie = cookies.find((value) => value.startsWith('refresh_token='));
  if (!cookie) throw new Error('Cookie refresh_token absent');
  return cookie;
}
const cookieValue = (cookie: string) => cookie.split(';')[0]!.split('=')[1]!;

describe('Authentification', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => closeTestApp(ctx));
  beforeEach(() => resetDatabase(ctx.prisma));

  const register = (body: object, ip = freshIp()) =>
    ctx.http().post(REGISTER).set('X-Forwarded-For', ip).send(body);
  const login = (body: object, ip = freshIp()) =>
    ctx.http().post(LOGIN).set('X-Forwarded-For', ip).send(body);
  const refresh = (cookie: string, ip = freshIp()) =>
    ctx.http().post(REFRESH).set('X-Forwarded-For', ip).set('Cookie', cookie.split(';')[0]!);

  const validUser = { email: 'Alice@Example.com ', password: 'Password123', name: '  Alice ' };

  describe('register', () => {
    it('crée utilisateur + projet personnel + adhésion OWNER, et ouvre une session', async () => {
      const res = await register(validUser).expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email: 'alice@example.com', name: 'Alice' });
      expect(res.body.user).not.toHaveProperty('passwordHash');

      const project = await ctx.prisma.project.findUniqueOrThrow({
        where: { personalForUserId: res.body.user.id },
        include: { members: true },
      });
      expect(res.body.user.personalProjectId).toBe(project.id);
      expect(project.members).toEqual([
        expect.objectContaining({ userId: res.body.user.id, role: 'OWNER' }),
      ]);
    });

    it('pose un cookie httpOnly, SameSite=Strict, limité aux routes /api/v1/auth', async () => {
      const res = await register(validUser).expect(201);
      const cookie = refreshCookie(res.headers);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
      expect(cookie).toMatch(/Max-Age=2592000/);
    });

    it('ne stocke jamais le refresh token en clair', async () => {
      const res = await register(validUser).expect(201);
      const raw = cookieValue(refreshCookie(res.headers));
      const stored = await ctx.prisma.refreshToken.findMany();
      expect(stored).toHaveLength(1);
      expect(stored[0]!.tokenHash).toBe(hashToken(raw));
      expect(stored[0]!.tokenHash).not.toBe(raw);
    });

    it('refuse un email déjà inscrit, quelle que soit la casse (409)', async () => {
      await register(validUser).expect(201);
      await register({ ...validUser, email: 'ALICE@example.COM' }).expect(409);
    });

    it.each([
      ['email invalide', { ...validUser, email: 'pas-un-email' }],
      ['mot de passe trop court', { ...validUser, password: 'abc1' }],
      ['mot de passe sans chiffre', { ...validUser, password: 'Password' }],
      ['nom vide', { ...validUser, name: '   ' }],
      ['champ inconnu', { ...validUser, role: 'ADMIN' }],
    ])('rejette : %s (400)', async (_label, body) => {
      const res = await register(body).expect(400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });
  });

  describe('login', () => {
    beforeEach(() => register(validUser).expect(201));

    it('connecte avec les bons identifiants', async () => {
      const res = await login({ email: 'alice@example.com', password: 'Password123' }).expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      refreshCookie(res.headers);
    });

    it('même réponse pour un mauvais mot de passe et un email inconnu', async () => {
      const wrong = await login({ email: 'alice@example.com', password: 'Wrong12345' }).expect(401);
      const unknown = await login({ email: 'nobody@example.com', password: 'Wrong12345' }).expect(
        401,
      );
      expect(wrong.body.message).toBe('Identifiants invalides');
      expect(unknown.body.message).toBe(wrong.body.message);
    });

    it('limite le débit : 6e tentative en 1 minute depuis la même IP → 429', async () => {
      const ip = freshIp();
      for (let i = 0; i < 5; i++) {
        await login({ email: 'alice@example.com', password: 'Wrong12345' }, ip).expect(401);
      }
      await login({ email: 'alice@example.com', password: 'Wrong12345' }, ip).expect(429);
    });
  });

  describe('access token', () => {
    it('refuse une requête sans token (401)', async () => {
      await ctx.http().get('/api/v1/users/me').expect(401);
    });

    it('refuse un token expiré', async () => {
      const user = await ctx.factory.user();
      const jwt = ctx.app.get(JwtService, { strict: false });
      const expired = await jwt.signAsync({ sub: user.id, sid: 'x' }, { expiresIn: -10 });
      await ctx
        .http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });

    it('refuse un token signé avec un autre secret', async () => {
      const user = await ctx.factory.user();
      const jwt = ctx.app.get(JwtService, { strict: false });
      const forged = await jwt.signAsync(
        { sub: user.id, sid: 'x' },
        { secret: 'another-secret-another-secret-another-secret' },
      );
      await ctx.http().get('/api/v1/users/me').set('Authorization', `Bearer ${forged}`).expect(401);
    });

    it('refuse un token non signé (alg: none)', async () => {
      const user = await ctx.factory.user();
      const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
        sub: user.id,
        sid: 'x',
        iss: 'taskflow-api',
        aud: 'taskflow-web',
        exp: Math.floor(Date.now() / 1000) + 600,
      })}.`;
      await ctx
        .http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${unsigned}`)
        .expect(401);
    });

    it('accepte un token valide', async () => {
      const user = await ctx.factory.user();
      const res = await ctx
        .http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
      expect(res.body).toMatchObject({ id: user.id, personalProjectId: user.personalProjectId });
    });
  });

  describe('refresh', () => {
    let cookie: string;
    beforeEach(async () => {
      cookie = refreshCookie((await register(validUser).expect(201)).headers);
    });

    it('émet un nouveau couple de tokens et révoque l’ancien refresh token', async () => {
      const res = await refresh(cookie).expect(200);
      const next = refreshCookie(res.headers);
      expect(cookieValue(next)).not.toBe(cookieValue(cookie));
      expect(res.body.accessToken).toEqual(expect.any(String));

      const old = await ctx.prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashToken(cookieValue(cookie)) },
      });
      expect(old.revokedAt).not.toBeNull();
      expect(old.replacedById).not.toBeNull();
    });

    it('détecte la réutilisation : 401 et toute la famille révoquée', async () => {
      const next = refreshCookie((await refresh(cookie).expect(200)).headers);

      await refresh(cookie).expect(401); // ancien token rejoué
      await refresh(next).expect(401); // le token légitime est aussi révoqué

      const active = await ctx.prisma.refreshToken.count({ where: { revokedAt: null } });
      expect(active).toBe(0);
    });

    it('deux refresh concurrents avec le même token : un seul succès', async () => {
      const results = await Promise.all([refresh(cookie), refresh(cookie)]);
      const statuses = results.map((res) => res.status).sort();
      expect(statuses).toEqual([200, 401]);
    });

    it('refuse un refresh token expiré', async () => {
      await ctx.prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await refresh(cookie).expect(401);
    });

    it('refuse sans cookie, ou avec un cookie inconnu', async () => {
      await ctx.http().post(REFRESH).expect(401);
      await refresh('refresh_token=inconnu').expect(401);
    });

    it('refuse une origine non autorisée (CSRF)', async () => {
      await refresh(cookie).set('Origin', 'https://evil.example').expect(401);
    });
  });

  describe('logout', () => {
    it('logout révoque la session courante et efface le cookie', async () => {
      const cookie = refreshCookie((await register(validUser).expect(201)).headers);
      const res = await ctx.http().post(LOGOUT).set('Cookie', cookie.split(';')[0]!).expect(204);
      expect(refreshCookie(res.headers)).toMatch(/refresh_token=;/);
      await refresh(cookie).expect(401);
    });

    it('logout est idempotent sans cookie', async () => {
      await ctx.http().post(LOGOUT).expect(204);
    });

    it('logout-all révoque toutes les sessions', async () => {
      const first = await register(validUser).expect(201);
      const second = await login({ email: 'alice@example.com', password: 'Password123' }).expect(
        200,
      );

      await ctx
        .http()
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${first.body.accessToken}`)
        .expect(204);

      await refresh(refreshCookie(first.headers)).expect(401);
      await refresh(refreshCookie(second.headers)).expect(401);
    });
  });

  describe('changement de mot de passe', () => {
    it('révoque les autres sessions, pas la courante', async () => {
      const current = await register(validUser).expect(201);
      const other = await login({ email: 'alice@example.com', password: 'Password123' }).expect(
        200,
      );

      await ctx
        .http()
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${current.body.accessToken}`)
        .send({ currentPassword: 'Password123', newPassword: 'NewPassword456' })
        .expect(204);

      await refresh(refreshCookie(other.headers)).expect(401);
      await refresh(refreshCookie(current.headers)).expect(200);
      await login({ email: 'alice@example.com', password: 'NewPassword456' }).expect(200);
    });

    it('refuse un mot de passe actuel incorrect', async () => {
      const user = await ctx.factory.user();
      await ctx
        .http()
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: 'mauvais', newPassword: 'NewPassword456' })
        .expect(401);
    });
  });

  describe('purge', () => {
    it('supprime les tokens expirés et ceux révoqués depuis plus de 7 jours', async () => {
      await register(validUser).expect(201);
      const user = await ctx.prisma.user.findFirstOrThrow();
      const base = { userId: user.id, familyId: user.id };
      await ctx.prisma.refreshToken.createMany({
        data: [
          { ...base, tokenHash: 'expired', expiresAt: new Date(Date.now() - 1000) },
          {
            ...base,
            tokenHash: 'old-revoked',
            expiresAt: new Date(Date.now() + 1e9),
            revokedAt: new Date(Date.now() - 8 * 86_400_000),
          },
        ],
      });
      const { AuthService } = await import('../../src/auth/auth.service');
      expect(await ctx.app.get(AuthService).purgeRefreshTokens()).toBe(2);
      expect(await ctx.prisma.refreshToken.count()).toBe(1);
    });
  });
});
