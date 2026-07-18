import { useEffect, useRef, useState } from 'react'

function getConnection() {
  if (typeof navigator === 'undefined') return null
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null
}

function readConnection() {
  const c = getConnection()
  if (!c) return null
  return {
    downlink: typeof c.downlink === 'number' ? c.downlink : null,
    effectiveType: c.effectiveType || null,
    rtt: typeof c.rtt === 'number' ? c.rtt : null,
  }
}

function computeQuality({ online, latency, info }) {
  if (!online) return 'offline'
  const downlink = info?.downlink ?? null
  // Prefer a measured latency; fall back to the Network Information API rtt.
  const lat = latency ?? info?.rtt ?? null

  if (lat != null) {
    if (lat < 120 && (downlink == null || downlink >= 3)) return 'excellent'
    if (lat < 300) return 'good'
    if (lat < 800) return 'fair'
    return 'poor'
  }
  if (downlink != null) {
    if (downlink >= 5) return 'excellent'
    if (downlink >= 2) return 'good'
    if (downlink >= 0.5) return 'fair'
    return 'poor'
  }
  return 'unknown'
}

/**
 * Live network quality indicator. Combines the Network Information API (when
 * available) with an active latency probe (a tiny cache-busted request to a
 * same-origin asset) so it works across browsers.
 *
 * @param {object} options
 * @param {boolean} [options.enabled=true]
 * @param {string}  [options.pingUrl='/favicon.svg']
 * @param {number}  [options.interval=4000]
 */
export function useNetworkSpeed({ enabled = true, pingUrl = '/favicon.svg', interval = 4000 } = {}) {
  const [info, setInfo] = useState(() => readConnection())
  const [latency, setLatency] = useState(null)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const cancelledRef = useRef(false)

  // React to Network Information API changes + online/offline events.
  useEffect(() => {
    const c = getConnection()
    const onChange = () => setInfo(readConnection())
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)

    if (c?.addEventListener) c.addEventListener('change', onChange)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      if (c?.removeEventListener) c.removeEventListener('change', onChange)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Active latency probe.
  useEffect(() => {
    if (!enabled) return undefined
    cancelledRef.current = false
    let timer = null

    const probe = async () => {
      const started = performance.now()
      try {
        await fetch(`${pingUrl}?_=${Date.now()}`, { cache: 'no-store' })
        if (cancelledRef.current) return
        setLatency(Math.round(performance.now() - started))
        setOnline(true)
      } catch {
        if (cancelledRef.current) return
        setLatency(null)
        if (typeof navigator !== 'undefined') setOnline(navigator.onLine)
      }
      if (!cancelledRef.current) timer = setTimeout(probe, interval)
    }

    probe()
    return () => {
      cancelledRef.current = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled, pingUrl, interval])

  const quality = computeQuality({ online, latency, info })

  return {
    online,
    latency,
    downlink: info?.downlink ?? null,
    effectiveType: info?.effectiveType ?? null,
    quality,
  }
}
