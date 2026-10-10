import type { CookieOptions } from 'express';

export const REFRESH_COOKIE = 'refresh_token';
/** Le cookie n'est envoyé qu'aux routes d'authentification (SECURITY.md §2.3). */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function refreshCookieOptions(secure: boolean, ttlDays: number): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: ttlDays * 24 * 60 * 60 * 1000,
  };
}
