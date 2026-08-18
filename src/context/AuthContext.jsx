import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api/auth'
import { ApiError, clearCsrfToken } from '../api/client'
import { clearQueryCache } from '../lib/queryCache'
import { prefetchForRole } from '../lib/prefetch'

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null)

/**
 * Provides authentication state. Because the backend uses an HttpOnly cookie,
 * we determine the session by calling /auth/me on mount rather than reading a
 * token from JS.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me()
      try {
        await authApi.csrf()
      } catch {
        // Session is valid; CSRF bootstrap is best-effort (login JSON still works).
      }
      setUser(me)
      return me
    } catch (err) {
      // 401/403 simply means "not logged in".
      if (!(err instanceof ApiError)) throw err
      clearCsrfToken()
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const me = await refresh()
      // Warm role dashboards in the background while the shell paints.
      if (me?.role) prefetchForRole(me.role)
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [refresh])

  const login = useCallback(
    async (credentials) => {
      await authApi.login(credentials)
      const me = await refresh()
      // Prefetch starts before navigation so the destination page often hits a warm cache.
      if (me?.role) prefetchForRole(me.role)
      return me
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      clearCsrfToken()
      clearQueryCache()
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: !!user, refresh, login, logout, setUser }),
    [user, loading, refresh, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
