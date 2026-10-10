import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/ui/spinner';
import { useAuth } from './auth-context';

/**
 * Zone authentifiée. Ergonomie uniquement : la sécurité est assurée par l'API.
 */
export function ProtectedRoute() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <FullPageSpinner />;
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Pages de connexion / inscription : un utilisateur connecté est renvoyé vers l'application. */
export function PublicOnlyRoute() {
  const { state } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  if (state.status === 'loading') return <FullPageSpinner />;
  if (state.status === 'authenticated') return <Navigate to={from ?? '/'} replace />;
  return <Outlet />;
}
