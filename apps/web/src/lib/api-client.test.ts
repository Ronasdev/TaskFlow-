import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { API, server, testSession } from '@/test/server';
import { api, ApiError, onSessionExpired, refreshSession, tokenStore } from './api-client';

describe('api-client', () => {
  it('envoie le token d’accès en en-tête Authorization', async () => {
    tokenStore.set('token-a');
    let authorization: string | null = null;
    server.use(
      http.get(`${API}/users/me`, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      }),
    );
    await api.get('/users/me');
    expect(authorization).toBe('Bearer token-a');
  });

  it('sur 401 : un seul refresh pour N requêtes parallèles, puis rejeu', async () => {
    tokenStore.set('expired');
    let refreshCalls = 0;
    server.use(
      http.post(`${API}/auth/refresh`, async () => {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return HttpResponse.json(testSession);
      }),
      http.get(`${API}/tasks`, ({ request }) =>
        request.headers.get('Authorization') === `Bearer ${testSession.accessToken}`
          ? HttpResponse.json({ data: [], meta: { page: 1, pageSize: 20, total: 0 } })
          : HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
    );

    const results = await Promise.all([api.get('/tasks'), api.get('/tasks'), api.get('/tasks')]);

    expect(refreshCalls).toBe(1);
    expect(results).toHaveLength(3);
    expect(tokenStore.get()).toBe(testSession.accessToken);
  });

  it('refresh en échec : session expirée signalée et ApiError 401', async () => {
    tokenStore.set('expired');
    const expired = vi.fn();
    onSessionExpired(expired);
    server.use(http.get(`${API}/tasks`, () => HttpResponse.json({}, { status: 401 })));

    await expect(api.get('/tasks')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
    expect(tokenStore.get()).toBeNull();
    onSessionExpired(null);
  });

  it('ne tente pas de refresh sur les routes /auth/*', async () => {
    const refresh = vi.fn();
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ message: 'Identifiants invalides' }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, () => {
        refresh();
        return HttpResponse.json(testSession);
      }),
    );
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({
      status: 401,
      message: 'Identifiants invalides',
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('normalise les erreurs de validation par champ', async () => {
    server.use(
      http.post(`${API}/projects`, () =>
        HttpResponse.json(
          { statusCode: 400, message: [{ field: 'name', constraints: ['Le nom est requis'] }] },
          { status: 400 },
        ),
      ),
    );
    const error = await api.post('/projects', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fieldErrors).toEqual([
      { field: 'name', constraints: ['Le nom est requis'] },
    ]);
    expect((error as ApiError).message).toBe('Le nom est requis');
  });

  it('sérialise les filtres multiples en paramètres répétés', async () => {
    let search = '';
    server.use(
      http.get(`${API}/tasks`, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({ data: [], meta: { page: 1, pageSize: 20, total: 0 } });
      }),
    );
    await api.get('/tasks', { status: ['TODO', 'DONE'], q: '', page: 2 });
    expect(search).toBe('?status=TODO&status=DONE&page=2');
  });

  it('ne stocke jamais le token dans localStorage', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(testSession)));
    await refreshSession();
    expect(JSON.stringify({ ...localStorage })).not.toContain(testSession.accessToken);
  });
});
