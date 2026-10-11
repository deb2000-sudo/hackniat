import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { homePath, needsProfileCompletion } from '../../utils/access'

/**
 * Guards /complete-profile. Mounted inside ProtectedRoute, so the user is
 * signed in here; anyone whose profile is already complete (including every
 * student and evaluator) is sent to their real first screen instead.
 */
export default function CompleteProfileRoute() {
  const { user } = useAuth()
  if (!needsProfileCompletion(user)) return <Navigate to={homePath(user)} replace />
  return <Outlet />
}
