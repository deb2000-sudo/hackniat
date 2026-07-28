import { useCallback, useEffect, useRef, useState } from 'react'

/** Compare the fields that actually drive UI updates during polling. */
function isSamePollSnapshot(prev, next) {
  if (prev === next) return true
  if (!prev || !next) return false
  return (
    prev.id === next.id &&
    prev.status === next.status &&
    prev.report_published === next.report_published &&
    prev.updated_at === next.updated_at &&
    prev.error === next.error &&
    prev.overall_score === next.overall_score &&
    prev.final_score === next.final_score &&
    prev.review_status === next.review_status
  )
}

/**
 * Generic polling hook. Repeatedly invokes `fetcher` until `isDone` returns
 * true. Skips state updates when the payload is unchanged, retries transient
 * failures with backoff, and aborts in-flight work on unmount.
 *
 * @param {(opts?: { signal?: AbortSignal }) => Promise<any>} fetcher
 * @param {object} options
 * @param {(data:any) => boolean} options.isDone
 * @param {number} [options.interval=3000]
 * @param {number} [options.maxInterval]  optional cap for exponential backoff
 * @param {boolean} [options.enabled=true]
 */
export function usePolling(
  fetcher,
  { isDone, interval = 3000, maxInterval, enabled = true } = {},
) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [nonce, setNonce] = useState(0)
  const timerRef = useRef(null)
  const stoppedRef = useRef(false)
  const fetcherRef = useRef(fetcher)
  const isDoneRef = useRef(isDone)
  const dataRef = useRef(null)
  const delayRef = useRef(interval)
  const failuresRef = useRef(0)

  useEffect(() => {
    fetcherRef.current = fetcher
    isDoneRef.current = isDone
  }, [fetcher, isDone])

  useEffect(() => {
    delayRef.current = interval
  }, [interval])

  const stop = useCallback(() => {
    stoppedRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const restart = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    stoppedRef.current = false
    failuresRef.current = 0
    delayRef.current = interval
    setLoading(true)
    setNonce((value) => value + 1)
  }, [interval])

  useEffect(() => {
    if (!enabled) return undefined
    stoppedRef.current = false
    failuresRef.current = 0
    delayRef.current = interval
    let active = true
    let controller = null

    const schedule = (ms) => {
      if (!active || stoppedRef.current) return
      timerRef.current = setTimeout(tick, ms)
    }

    const tick = async () => {
      controller?.abort()
      controller = typeof AbortController !== 'undefined' ? new AbortController() : null

      try {
        const result = await fetcherRef.current(
          controller ? { signal: controller.signal } : undefined,
        )
        if (!active || stoppedRef.current) return

        failuresRef.current = 0
        delayRef.current = interval

        if (!isSamePollSnapshot(dataRef.current, result)) {
          dataRef.current = result
          setData(result)
        }
        setError(null)
        setLoading(false)

        if (isDoneRef.current?.(result)) {
          stoppedRef.current = true
          return
        }
      } catch (err) {
        if (!active || stoppedRef.current || err?.name === 'AbortError') return

        // Keep last good data; retry transient failures instead of dying forever.
        failuresRef.current += 1
        setError(err)
        setLoading(false)

        if (failuresRef.current >= 5) {
          stoppedRef.current = true
          return
        }

        const cap = maxInterval ?? Math.max(interval * 4, interval)
        delayRef.current = Math.min(delayRef.current * 2, cap)
        schedule(delayRef.current)
        return
      }

      if (active && !stoppedRef.current) {
        // Gentle backoff while waiting on long-lived conditions (e.g. publish).
        const cap = maxInterval ?? interval
        if (maxInterval && delayRef.current < cap) {
          delayRef.current = Math.min(delayRef.current + 1000, cap)
        }
        schedule(delayRef.current)
      }
    }

    tick()

    return () => {
      active = false
      stoppedRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      controller?.abort()
    }
  }, [enabled, interval, maxInterval, nonce])

  return { data, error, loading, stop, restart }
}
