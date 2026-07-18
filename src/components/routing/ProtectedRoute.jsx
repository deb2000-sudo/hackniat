import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { LoadingBlock } from '../ui/Spinner'
import { ROLE_HOME } from '../../utils/constants'

/**
 * Guards nested routes. Redirects unauthenticated users to /login and, when
 * `roles` is provided, users without an allowed role to their own home.
 */
export default function ProtectedRoute({ roles }) {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingBlock label="Checking your session…" />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/'} replace />
  }

  return <Outlet />
}
