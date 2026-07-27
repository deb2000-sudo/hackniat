import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Generic polling hook. Repeatedly invokes `fetcher` until `isDone` returns
 * true (or an error occurs). Useful for polling evaluation session status.
 *
 * @param {() => Promise<any>} fetcher
 * @param {object} options
 * @param {(data:any) => boolean} options.isDone  stop when this returns true
 * @param {number} [options.interval=3000]
 * @param {boolean} [options.enabled=true]
 */
export function usePolling(fetcher, { isDone, interval = 3000, enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [nonce, setNonce] = useState(0)
  const timerRef = useRef(null)
  const stoppedRef = useRef(false)
  const fetcherRef = useRef(fetcher)
  const isDoneRef = useRef(isDone)

  // Keep the latest callbacks without restarting the polling effect.
  useEffect(() => {
    fetcherRef.current = fetcher
    isDoneRef.current = isDone
  }, [fetcher, isDone])

  const stop = useCallback(() => {
    stoppedRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const restart = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    stoppedRef.current = false
    setLoading(true)
    setNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    stoppedRef.current = false
    let active = true

    const tick = async () => {
      try {
        const result = await fetcherRef.current()
        if (!active || stoppedRef.current) return
        setData(result)
        setError(null)
        setLoading(false)
        if (isDoneRef.current?.(result)) {
          stoppedRef.current = true
          return
        }
      } catch (err) {
        if (!active || stoppedRef.current) return
        setError(err)
        setLoading(false)
        stoppedRef.current = true
        return
      }
      if (active && !stoppedRef.current) {
        timerRef.current = setTimeout(tick, interval)
      }
    }

    tick()

    return () => {
      active = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, interval, nonce])

  return { data, error, loading, stop, restart }
}
