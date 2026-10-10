import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onSessionExpired, refreshSession, tokenStore } from '@/lib/api-client';
import type { Session, User } from '@/types/api';
import { AuthContext, type AuthContextValue, type AuthState } from './auth-context';

/**
 * Session : access token en mémoire ; au montage (et donc à chaque rechargement de page),
 * tentative de refresh via le cookie httpOnly pour restaurer la session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  const startSession = useCallback((session: Session) => {
    tokenStore.set(session.accessToken);
    setState({ status: 'authenticated', user: session.user });
  }, []);

  const endSession = useCallback(() => {
    tokenStore.set(null);
    queryClient.clear();
    setState({ status: 'anonymous', user: null });
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((session) => {
      if (cancelled) return;
      if (session) startSession(session);
      else setState({ status: 'anonymous', user: null });
    });
    onSessionExpired(endSession);
    return () => {
      cancelled = true;
      onSessionExpired(null);
    };
  }, [startSession, endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login: async (values) => startSession(await api.post<Session>('/auth/login', values)),
      register: async (values) => startSession(await api.post<Session>('/auth/register', values)),
      logout: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          endSession();
        }
      },
      logoutAll: async () => {
        try {
          await api.post('/auth/logout-all');
        } finally {
          endSession();
        }
      },
      setUser: (user: User) => setState({ status: 'authenticated', user }),
    }),
    [state, startSession, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
