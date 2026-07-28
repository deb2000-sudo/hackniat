/**
 * Tiny shared query cache with stale-while-revalidate semantics.
 *
 * Why this exists: every dashboard was re-fetching the same endpoints on every
 * navigation (hackathons, submissions, users…). A shared cache lets multiple
 * screens share one result, show cached data instantly, and refresh in the
 * background — without pulling in a heavy data library.
 */

const entries = new Map()
const listeners = new Map()

function notify(key) {
  const set = listeners.get(key)
  if (!set) return
  const entry = entries.get(key)
  set.forEach((cb) => {
    try {
      cb(entry)
    } catch {
      // subscriber errors must not break other listeners
    }
  })
}

export function getQueryEntry(key) {
  if (!key) return null
  return entries.get(key) || null
}

export function setQueryData(key, data) {
  if (!key) return
  const prev = entries.get(key) || {}
  entries.set(key, {
    ...prev,
    data,
    error: null,
    updatedAt: Date.now(),
    promise: null,
  })
  notify(key)
}

export function invalidateQueries(match) {
  const keys = [...entries.keys()]
  keys.forEach((key) => {
    const hit =
      typeof match === 'function'
        ? match(key)
        : typeof match === 'string'
          ? key === match || key.startsWith(`${match}:`)
          : key === match
    if (!hit) return
    entries.delete(key)
    notify(key)
  })
}

export function clearQueryCache() {
  entries.clear()
}

export function subscribeQuery(key, callback) {
  if (!key) return () => {}
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(callback)
  return () => {
    set.delete(callback)
    if (set.size === 0) listeners.delete(key)
  }
}

/**
 * Deduplicated fetch. Concurrent callers with the same key share one promise.
 * Fresh cache (within staleTime) is returned without hitting the network.
 */
export async function fetchQuery(key, fetcher, { staleTime = 30_000, force = false } = {}) {
  const existing = entries.get(key)

  if (!force && existing?.data !== undefined && existing.updatedAt) {
    const age = Date.now() - existing.updatedAt
    if (age < staleTime) return existing.data
  }

  if (!force && existing?.promise) return existing.promise

  const promise = Promise.resolve()
    .then(() => fetcher())
    .then((data) => {
      entries.set(key, {
        data,
        error: null,
        updatedAt: Date.now(),
        promise: null,
      })
      notify(key)
      return data
    })
    .catch((error) => {
      const prev = entries.get(key)
      entries.set(key, {
        data: prev?.data,
        error,
        updatedAt: prev?.updatedAt || 0,
        promise: null,
      })
      notify(key)
      throw error
    })

  entries.set(key, {
    data: existing?.data,
    error: existing?.error || null,
    updatedAt: existing?.updatedAt || 0,
    promise,
  })

  return promise
}

/** Fire-and-forget warm of the cache (used after login / on nav hover). */
export function prefetchQuery(key, fetcher, options) {
  return fetchQuery(key, fetcher, options).catch(() => null)
}
