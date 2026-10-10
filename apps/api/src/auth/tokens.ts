import { createHash, randomBytes } from 'node:crypto';

/** Refresh token opaque : 32 octets aléatoires, encodés base64url. */
export const generateRefreshToken = (): string => randomBytes(32).toString('base64url');

/** Seul le hash SHA-256 est stocké en base. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
