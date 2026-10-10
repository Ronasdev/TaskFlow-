import { createContext, useContext } from 'react';
import type { User } from '@/types/api';
import type { LoginValues, RegisterValues } from './schemas';

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: User };

export interface AuthContextValue {
  state: AuthState;
  login: (values: LoginValues) => Promise<void>;
  register: (values: Omit<RegisterValues, 'confirmPassword'>) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  setUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return context;
}

/** Utilisateur connecté : à n'utiliser que sous <ProtectedRoute>. */
export function useCurrentUser(): User {
  const { state } = useAuth();
  if (state.status !== 'authenticated') throw new Error('Aucun utilisateur connecté');
  return state.user;
}
