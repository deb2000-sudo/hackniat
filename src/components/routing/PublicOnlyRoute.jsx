import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { LoadingBlock } from '../ui/Spinner'
import { ROLE_HOME } from '../../utils/constants'

/** Redirects already-authenticated users away from auth pages. */
export default function PublicOnlyRoute() {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) return <LoadingBlock label="Loading…" />
  if (isAuthenticated) return <Navigate to={ROLE_HOME[user.role] || '/'} replace />

  return <Outlet />
}
