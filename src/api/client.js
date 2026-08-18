const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Read a browser-accessible cookie by its exact name. */
function getCookie(name) {
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
  }
}

/** Extract a readable message from a FastAPI / generic error payload. */
function extractMessage(data, fallback) {
  if (!data) return fallback
  if (typeof data === 'string') return data
  const { detail, message } = data
  if (typeof detail === 'string') return detail
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
  const { method = 'GET', body, formData, headers = {}, signal } = options
  const normalizedMethod = method.toUpperCase()

  const finalHeaders = { ...headers }
  let payload

  // Double-submit CSRF: when the backend sets a readable csrf_token cookie
  // (e.g. deployed API), mirror it on mutating requests. Local backends that
  // do not mint/require CSRF simply leave the cookie absent — do not block.
  if (
    MUTATING_METHODS.has(normalizedMethod) &&
    !Object.keys(finalHeaders).some(
      (name) => name.toLowerCase() === CSRF_HEADER_NAME.toLowerCase(),
    )
  ) {
    const csrfToken = getCookie(CSRF_COOKIE_NAME)
    if (csrfToken) {
      finalHeaders[CSRF_HEADER_NAME] = csrfToken
    } else if (import.meta.env.DEV) {
      // The request still goes out — a backend that does not mint CSRF must
      // keep working — but a missing token here is the single cause of the
      // "CSRF validation failed" 403, and it is otherwise invisible: the
      // browser still sends the cookie, so the Network tab looks correct.
      console.warn(
        `[api] ${normalizedMethod} ${path}: no readable "${CSRF_COOKIE_NAME}" cookie, ` +
          `so "${CSRF_HEADER_NAME}" was not set. If the backend requires CSRF this will 403. ` +
          'The cookie must be readable by JS (not HttpOnly) and set on this origin.',
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

    // A CSRF 403 is nearly always the double-submit token missing rather than
    // a real permission problem. Say so, so it is not mistaken for auth.
    if (res.status === 403 && /csrf/i.test(String(message))) {
      const sent = Boolean(finalHeaders[CSRF_HEADER_NAME])
      message = sent
        ? `${message} (sent ${CSRF_HEADER_NAME}, but it did not match the ${CSRF_COOKIE_NAME} cookie)`
        : `${message} (no ${CSRF_HEADER_NAME} sent: the ${CSRF_COOKIE_NAME} cookie was not readable by JS)`
    }

    throw new ApiError(message, { status: res.status, data })
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
