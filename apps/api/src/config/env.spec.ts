import { validateEnv } from './env';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  CORS_ORIGINS: 'http://a.test, http://b.test',
};

describe('validateEnv', () => {
  it('applique les valeurs par défaut et convertit les types', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it('refuse un secret JWT trop court', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'court' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('refuse COOKIE_SECURE=false en production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'false' })).toThrow(
      /COOKIE_SECURE/,
    );
  });

  it('refuse une configuration sans DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...rest } = base;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });
});
