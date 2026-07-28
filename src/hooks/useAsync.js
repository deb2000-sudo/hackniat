import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  fetchQuery,
  getQueryEntry,
  setQueryData,
  subscribeQuery,
} from '../lib/queryCache'

/**
 * Data-fetching hook with optional shared cache (stale-while-revalidate).
 *
 *   useAsync(() => api.list())
 *   useAsync(() => api.list(), { key: 'x', staleTime: 30_000 })
 *   useAsync(fn, [])   // legacy second arg ignored for compatibility
 *
 * When `key` is set: cached data paints immediately, in-flight requests are
 * deduped across mounts, and a background revalidate runs after staleTime.
 */
export function useAsync(asyncFn, options) {
  const opts = Array.isArray(options) || options == null ? {} : options
  const {
    key = null,
    staleTime = 30_000,
    enabled = true,
  } = opts

  const fnRef = useRef(asyncFn)
  useEffect(() => {
    fnRef.current = asyncFn
  })

  const [nonce, setNonce] = useState(0)
  const forceRef = useRef(false)
  const [local, setLocal] = useState(() => {
    if (key) {
      const cached = getQueryEntry(key)
      if (cached?.data !== undefined) {
        return { data: cached.data, error: cached.error || null, loading: false }
      }
    }
    return { data: null, error: null, loading: enabled }
  })

  const cacheEntry = useSyncExternalStore(
    useCallback((onStoreChange) => (key ? subscribeQuery(key, onStoreChange) : () => {}), [key]),
    useCallback(() => (key ? getQueryEntry(key) : null), [key]),
    () => null,
  )

  const reload = useCallback((reloadOpts = {}) => {
    forceRef.current = !!reloadOpts.force
    setNonce((n) => n + 1)
  }, [])

  const setData = useCallback(
    (updater) => {
      setLocal((s) => {
        const next = typeof updater === 'function' ? updater(s.data) : updater
        if (key) setQueryData(key, next)
        return { ...s, data: next }
      })
    },
    [key],
  )

  useEffect(() => {
    if (!enabled) {
      setLocal((s) => ({ ...s, loading: false }))
      return undefined
    }

    let active = true
    // Only abort uncached fetches. Shared (keyed) requests must outlive a single
    // subscriber so one unmount does not cancel work another screen still needs.
    const controller =
      !key && typeof AbortController !== 'undefined' ? new AbortController() : null
    const force = forceRef.current
    forceRef.current = false

    const run = async () => {
      if (key) {
        const cached = getQueryEntry(key)
        if (cached?.data !== undefined && !force) {
          if (active) {
            setLocal({ data: cached.data, error: cached.error || null, loading: false })
          }
          const age = cached.updatedAt ? Date.now() - cached.updatedAt : Infinity
          if (age < staleTime) return
        } else if (active) {
          setLocal((s) => ({ ...s, loading: s.data == null, error: null }))
        }
      } else if (active) {
        setLocal((s) => ({ ...s, loading: true, error: null }))
      }

      try {
        const fetcher = () =>
          fnRef.current(controller ? { signal: controller.signal } : undefined)

        const result = key
          ? await fetchQuery(key, fetcher, { staleTime, force })
          : await fetcher()

        if (!active) return
        setLocal({ data: result, error: null, loading: false })
        if (key) setQueryData(key, result)
      } catch (err) {
        if (!active || err?.name === 'AbortError') return
        setLocal((s) => ({ data: s.data, error: err, loading: false }))
      }
    }

    run()

    return () => {
      active = false
      controller?.abort()
    }
  }, [enabled, key, staleTime, nonce])

  // Mirror external cache writes (mutations via setQueryData / setData).
  useEffect(() => {
    if (!key || !cacheEntry || cacheEntry.data === undefined) return
    setLocal((s) => {
      if (s.data === cacheEntry.data && s.error === (cacheEntry.error || null)) return s
      return {
        data: cacheEntry.data,
        error: cacheEntry.error || null,
        loading: s.loading && cacheEntry.data == null,
      }
    })
  }, [key, cacheEntry])

  return {
    data: local.data,
    loading: local.loading,
    error: local.error,
    reload,
    setData,
  }
}
