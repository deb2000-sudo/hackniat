import { useCallback } from 'react'
import { adminPath } from '../utils/access'
import { useAuth } from './useAuth'

/**
 * Build admin-shell links for the signed-in user.
 *
 *   const toAdminPath = useAdminPath()
 *   <Link to={toAdminPath(`/admin/hackathons/${id}/edit`)} />
 *
 * Write paths with the /admin prefix; a Super Admin gets /super-admin, everyone
 * else gets the path unchanged. Linking straight to the right prefix saves the
 * redirect ProtectedRoute would otherwise do on every click.
 */
export function useAdminPath() {
  const { user } = useAuth()
  return useCallback((path) => adminPath(path, user), [user])
}
