import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { LoadingBlock } from '../ui/Spinner'
import { homePath } from '../../utils/access'

/** Redirects already-authenticated users away from auth pages. */
export default function PublicOnlyRoute() {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="drop min-h-screen bg-canvas">
        <LoadingBlock label="Loading…" />
      </div>
    )
  }
  if (isAuthenticated) return <Navigate to={homePath(user)} replace />

  return <Outlet />
}
