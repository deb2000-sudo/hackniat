const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const CSRF_STORAGE_KEY = 'csrf_token'
const CSRF_BOOTSTRAP_PATH = '/auth/csrf'
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** In-memory copy; sessionStorage survives a tab refresh (cross-origin cookie is unreadable). */
let csrfTokenMemory = null

function readSessionCsrf() {
  try {
    return sessionStorage.getItem(CSRF_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeSessionCsrf(token) {
  try {
    if (token) sessionStorage.setItem(CSRF_STORAGE_KEY, token)
    else sessionStorage.removeItem(CSRF_STORAGE_KEY)
  } catch {
    // Private mode / blocked storage — memory still works for this tab session.
  }
}

/** Read a browser-accessible cookie by its exact name (same-origin / localhost only). */
function getCookie(name) {
  if (typeof document === 'undefined') return null
  const prefix = `${encodeURIComponent(name)}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  if (!cookie) return null

  try {
    return decodeURIComponent(cookie.slice(prefix.length))
  } catch {
    return cookie.slice(prefix.length)
  }
}

/**
 * Persist the CSRF token from login JSON or GET /auth/csrf.
 * Cross-origin SPAs cannot read the API-domain csrf_token cookie via document.cookie.
 */
export function setCsrfToken(token) {
  const value = token ? String(token) : null
  csrfTokenMemory = value
  writeSessionCsrf(value)
}

export function clearCsrfToken() {
  setCsrfToken(null)
}

export function getCsrfToken() {
  if (csrfTokenMemory) return csrfTokenMemory
  const stored = readSessionCsrf()
  if (stored) {
    csrfTokenMemory = stored
    return stored
  }
  return getCookie(CSRF_COOKIE_NAME)
}

csrfTokenMemory = readSessionCsrf()

/**
 * Re-fetch a CSRF token after the stored one is rejected. The GET response is
 * captured by `request` itself, so this only reports whether a token landed.
 */
async function refreshCsrfToken(signal) {
  const previous = getCsrfToken()
  try {
    await request(CSRF_BOOTSTRAP_PATH, { method: 'GET', signal })
  } catch {
    return false
  }
  const current = getCsrfToken()
  return Boolean(current) && current !== previous
}

/** Resolve a backend-provided relative media URL against the configured API origin. */
export function resolveApiUrl(path) {
  if (!path || /^(https?:|blob:|data:)/i.test(path)) return path || ''
  const base = BASE_URL.replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

/**
 * Error thrown for any non-2xx API response. Carries the HTTP status and the
 * best available human-readable message parsed from the response body.
 */
export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.code =
      data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)
        ? data.detail.code
        : undefined
  }
}

/** Extract a readable message from a FastAPI / generic error payload. */
function extractMessage(data, fallback) {
  if (!data) return fallback
  if (typeof data === 'string') return data
  const { detail, message } = data
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && typeof detail.message === 'string') {
    return detail.message
  }
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{ loc, msg, type }]
    return detail
      .map((e) => {
        const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : ''
        return field ? `${field}: ${e.msg}` : e.msg
      })
      .filter(Boolean)
      .join(', ')
  }
  if (typeof message === 'string') return message
  return fallback
}

async function parseBody(res) {
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      return await res.json()
    } catch {
      return null
    }
  }
  const text = await res.text()
  return text || null
}

/**
 * Core request helper. Always sends cookies (credentials: 'include') so the
 * backend's HttpOnly session cookie is applied to authenticated requests.
 *
 * @param {string} path            API path beginning with '/'
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.body]  JSON body (ignored when `formData` is set)
 * @param {FormData} [options.formData]
 * @param {object} [options.headers]
 * @param {AbortSignal} [options.signal]
 */
export async function request(path, options = {}) {
  const { method = 'GET', body, formData, headers = {}, signal, isCsrfRetry = false } = options
  const normalizedMethod = method.toUpperCase()

  const finalHeaders = { ...headers }
  let csrfHeaderSetByClient = false
  let payload

  // Double-submit CSRF: send X-CSRF-Token from login JSON / GET /auth/csrf
  // (sessionStorage + memory). Cookie fallback only works same-origin.
  if (
    MUTATING_METHODS.has(normalizedMethod) &&
    !Object.keys(finalHeaders).some(
      (name) => name.toLowerCase() === CSRF_HEADER_NAME.toLowerCase(),
    )
  ) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      finalHeaders[CSRF_HEADER_NAME] = csrfToken
      csrfHeaderSetByClient = true
    } else if (import.meta.env.DEV) {
      console.warn(
        `[api] ${normalizedMethod} ${path}: no CSRF token in memory/sessionStorage, ` +
          `so "${CSRF_HEADER_NAME}" was not set. If the backend requires CSRF this will 403. ` +
          'Store csrf_token from POST /auth/login or GET /auth/csrf — document.cookie is empty cross-origin.',
      )
    }
  }

  if (formData) {
    // Let the browser set the multipart boundary automatically.
    payload = formData
  } else if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: normalizedMethod,
      headers: finalHeaders,
      body: payload,
      credentials: 'include',
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(
      'Unable to reach the server. Please check your connection and that the backend is running.',
      { status: 0 },
    )
  }

  const data = await parseBody(res)

  if (!res.ok) {
    let message = extractMessage(data, `Request failed (${res.status})`)

    // A stored token goes stale whenever the backend rotates its CSRF secret
    // — on staging, every redeploy. Re-bootstrap once and replay: a 403 means
    // the mutation never ran, so replaying cannot double-apply it. Only when
    // this client set the header; a caller-supplied one is left alone.
    if (
      res.status === 403 &&
      /csrf/i.test(String(message)) &&
      !isCsrfRetry &&
      csrfHeaderSetByClient &&
      !path.startsWith(CSRF_BOOTSTRAP_PATH) &&
      (await refreshCsrfToken(signal))
    ) {
      return request(path, { ...options, isCsrfRetry: true })
    }

    if (res.status === 403 && /csrf/i.test(String(message))) {
      const sent = Boolean(finalHeaders[CSRF_HEADER_NAME])
      message = sent
        ? `${message} (sent ${CSRF_HEADER_NAME}, but it did not match the ${CSRF_COOKIE_NAME} cookie)`
        : `${message} (no ${CSRF_HEADER_NAME} sent: save csrf_token from login or GET /auth/csrf)`
    }

    throw new ApiError(message, { status: res.status, data })
  }

  if (data && typeof data === 'object' && typeof data.csrf_token === 'string' && data.csrf_token) {
    setCsrfToken(data.csrf_token)
  }

  return data
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  upload: (path, formData, options) => request(path, { ...options, method: 'POST', formData }),
}
