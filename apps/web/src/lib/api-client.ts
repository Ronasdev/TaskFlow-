import type { Session } from '@/types/api';
import { env } from './env';

/**
 * Client HTTP de l'application — docs/FRONTEND.md §2.
 * - access token en mémoire uniquement (jamais localStorage) ;
 * - sur 401, un seul refresh partagé entre toutes les requêtes en vol, puis rejeu ;
 * - refresh en échec : la session est déclarée expirée (redirection vers /login).
 */

export interface FieldError {
  field: string;
  constraints: string[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<Session | null> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};

export function onSessionExpired(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

const url = (path: string) => `${env.VITE_API_URL}${path}`;

/** Échange le cookie httpOnly contre un nouvel access token. Les appels concurrents sont fusionnés. */
export function refreshSession(): Promise<Session | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(url('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        accessToken = null;
        return null;
      }
      const session = (await response.json()) as Session;
      accessToken = session.accessToken;
      return session;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

type Query = Record<string, string | number | boolean | string[] | undefined | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

function buildPath(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else params.append(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = 'Une erreur est survenue';
  let fieldErrors: FieldError[] = [];
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string') message = body.message;
    else if (Array.isArray(body.message)) {
      fieldErrors = body.message as FieldError[];
      message = fieldErrors[0]?.constraints[0] ?? 'Données invalides';
    }
  } catch {
    // corps non JSON : message générique
  }
  if (response.status === 429) message = 'Trop de tentatives, réessayez dans une minute';
  return new ApiError(response.status, message, fieldErrors);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isAuthRoute = path.startsWith('/auth/');
  const send = () => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(url(buildPath(path, options.query)), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: isAuthRoute ? 'include' : 'same-origin',
      signal: options.signal,
    });
  };

  let response = await send();

  if (response.status === 401 && !isAuthRoute) {
    const session = await refreshSession();
    if (!session) {
      sessionExpiredHandler?.();
      throw new ApiError(401, 'Session expirée, reconnectez-vous');
    }
    response = await send();
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    apiRequest<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T = void>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
