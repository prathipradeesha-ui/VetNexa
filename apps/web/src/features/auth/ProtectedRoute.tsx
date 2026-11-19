import type { UserRole } from '@vetnexa/shared';
import { Navigate, Outlet, useLocation } from 'react-router';
import { PageLoader } from '../../components/ui/PageLoader';
import { useCurrentUser } from './useAuth';

/**
 * Guards a group of routes.
 * - Shows a loader while the session is being checked.
 * - Sends signed-out visitors to /login and remembers where they were going.
 * - Optionally restricts the routes to certain roles.
 *
 * This only controls what the browser shows; the API enforces the same rules on every
 * request, so hiding a page here is never the only protection.
 */
export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { data: user, isPending } = useCurrentUser();
  const location = useLocation();

  if (isPending) return <PageLoader label="Checking your session…" />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
