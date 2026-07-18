import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'

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
      setUser(me)
      return me
    } catch (err) {
      // 401/403 simply means "not logged in".
      if (!(err instanceof ApiError)) throw err
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      await refresh()
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [refresh])

  const login = useCallback(
    async (credentials) => {
      await authApi.login(credentials)
      return refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: !!user, refresh, login, logout, setUser }),
    [user, loading, refresh, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
