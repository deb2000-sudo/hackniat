import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { LoadingBlock } from '../ui/Spinner'
import { crossAdminRedirect, hasPermission, homePath } from '../../utils/access'

/**
 * Guards nested routes. Redirects unauthenticated users to /login and, when
 * `roles` is provided, users without an allowed role to their own home.
 *
 * An admin-shell user on the other role's prefix is first moved to their own
 * (/admin ↔ /super-admin) with the rest of the URL kept.
 *
 * `permission` additionally requires that admin screen key. A custom-role user
 * who opens a screen their role does not include is sent to the first screen
 * it does — the API would only answer that page with 403s.
 */
export default function ProtectedRoute({ roles, permission }) {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="drop min-h-[40vh]">
        <LoadingBlock label="Checking your session…" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Same screen, other prefix: Super Admin uses /super-admin…, everyone else
  // in the admin shell uses /admin…. Keep the rest of the URL as it was.
  const moved = crossAdminRedirect(location.pathname, user)
  if (moved) {
    return <Navigate to={`${moved}${location.search}${location.hash}`} replace />
  }

  if (
    (roles && !roles.includes(user.role)) ||
    (permission && !hasPermission(user, permission))
  ) {
    return <Navigate to={homePath(user)} replace />
  }

  return <Outlet />
}
