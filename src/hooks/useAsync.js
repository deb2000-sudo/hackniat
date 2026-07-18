import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Runs an async function on mount and exposes { data, loading, error, reload }.
 * The latest `asyncFn` is captured via a ref, so callers may pass an inline
 * function without causing re-fetch loops. Call `reload()` to run it again.
 *
 * @param {() => Promise<any>} asyncFn
 */
export function useAsync(asyncFn) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nonce, setNonce] = useState(0)

  const fnRef = useRef(asyncFn)
  useEffect(() => {
    fnRef.current = asyncFn
  })

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fnRef.current()
        if (active) setData(result)
      } catch (err) {
        if (active) setError(err)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [nonce])

  return { data, loading, error, reload, setData }
}
