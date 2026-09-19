import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authApi } from '../api/auth'
import { ApiError, clearCsrfToken, onSessionExpired } from '../api/client'
import { clearQueryCache } from '../lib/queryCache'
import { prefetchForRole } from '../lib/prefetch'

/**
 * How often a visible tab re-checks that its session is still alive. The token
 * lasts an hour, so this is about noticing the expiry when the user comes back
 * to the tab — not about polling it down to the second.
 */
const REVALIDATE_MS = 60_000

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

  // Distinguishes "signed out because the hour ran out" from "signed out
  // because you asked to be", so the login screen can explain itself.
  const [sessionExpired, setSessionExpired] = useState(false)

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

  /**
   * Tear down a session that died under the user.
   *
   * Deliberately does not navigate: ProtectedRoute already redirects the
   * moment `user` goes null, and it captures the current location as `from`.
   * A second redirect from here would race it and lose that return path.
   */
  const expireSession = useCallback(() => {
    clearCsrfToken()
    clearQueryCache()
    setUser(null)
    setSessionExpired(true)
  }, [])

  // Only a session we believed was alive can expire. Subscribing while logged
  // out would catch the landing page's own /auth/me probe and bounce every
  // visitor to the login screen.
  const expiredRef = useRef(false)

  useEffect(() => {
    if (!user) return undefined

    // Fresh session — re-arm the once-only guard.
    expiredRef.current = false

    return onSessionExpired(() => {
      // A dashboard fires several requests at once and they all 401 together;
      // the first one is the one that means anything.
      if (expiredRef.current) return
      expiredRef.current = true
      expireSession()
    })
  }, [user, expireSession])

  // Nothing pushes an expiry, so a tab left open goes stale with no outward
  // sign. Re-check when the user comes back, so they land on the login screen
  // rather than discovering it through a save that fails.
  useEffect(() => {
    if (!user) return undefined

    let lastCheckedAt = Date.now()

    const revalidate = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastCheckedAt < REVALIDATE_MS) return
      lastCheckedAt = Date.now()
      // A 401 reaches onSessionExpired on its own; there is nothing to do with
      // the rejection here beyond not letting it surface as unhandled.
      authApi.me().catch(() => {})
    }

    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)

    return () => {
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', revalidate)
    }
  }, [user])

  const login = useCallback(
    async (credentials) => {
      setSessionExpired(false)
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
      // Leaving on purpose is not an expiry — don't explain it as one.
      setSessionExpired(false)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      sessionExpired,
      refresh,
      login,
      logout,
      setUser,
    }),
    [user, loading, sessionExpired, refresh, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
