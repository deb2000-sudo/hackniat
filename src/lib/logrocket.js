import * as logrocketModule from 'logrocket'
import * as logrocketReactModule from 'logrocket-react'

/**
 * LogRocket session recording.
 *
 * Off in local development so test sessions do not spend the recording quota;
 * on in production builds. Override either way with VITE_LOGROCKET_ENABLED
 * ("true" / "false"). The app id can be swapped with VITE_LOGROCKET_APP_ID.
 *
 * Every helper here is a no-op until init has run, so callers never need to
 * check whether recording is on.
 *
 * Privacy: this app handles passwords (with a show/hide toggle that turns them
 * into plain text inputs), OTP codes, Firebase phone tokens and a CSRF token.
 * So every input is masked in replays, auth request bodies and the CSRF header
 * are stripped, and Firebase / signed-upload traffic is not recorded at all.
 * Review https://docs.logrocket.com/reference/dom before relaxing any of it.
 */

const APP_ID = import.meta.env.VITE_LOGROCKET_APP_ID || '1fgx0o/challazo'

const flag = import.meta.env.VITE_LOGROCKET_ENABLED
const ENABLED = flag === 'true' || (flag !== 'false' && import.meta.env.PROD)

/** Set at build time in vite.config.js: CI release, git commit, or package version. */
// eslint-disable-next-line no-undef
const RELEASE = typeof __APP_RELEASE__ === 'string' && __APP_RELEASE__ ? __APP_RELEASE__ : undefined

/**
 * Both packages are CommonJS with an `exports.default`. Depending on how the
 * bundler wraps them, the real export sits zero, one or two `.default`s deep —
 * the production build unwraps logrocket-react once more than dev does, and a
 * plain default import came out undefined and crashed the app on load.
 *
 * The deepest `.default` is tried first: the namespace object itself also
 * exposes `init`, but as read-only getters, and LogRocket's init writes to
 * `this` — so calling it on the namespace throws. Only the real instance works.
 */
function unwrap(mod, isWanted) {
  const candidates = [mod?.default?.default, mod?.default, mod]
  return candidates.find((value) => value && isWanted(value)) || null
}

const LogRocket = unwrap(logrocketModule, (value) => typeof value.init === 'function')
const setupLogRocketReact = unwrap(logrocketReactModule, (value) => typeof value === 'function')

let started = false

/** Recording must never take the app down: report SDK failures to the console only. */
function safely(label, run) {
  try {
    run()
  } catch (error) {
    console.warn(`LogRocket ${label} failed`, error)
  }
}

/** Requests never recorded: Firebase phone auth, reCAPTCHA, and signed GCS uploads. */
const UNRECORDED_URL =
  /(identitytoolkit|securetoken|firebaseinstallations)\.googleapis\.com|google\.com\/recaptcha|gstatic\.com\/recaptcha|storage\.googleapis\.com|[?&]X-Goog-Signature=/i

/** Our own endpoints whose bodies carry passwords, OTP codes, phone tokens or the CSRF token. */
const AUTH_PATH = /\/auth\//i

const SENSITIVE_HEADERS = ['x-csrf-token', 'authorization', 'cookie']

function withoutSensitiveHeaders(headers) {
  if (!headers) return headers
  const next = { ...headers }
  Object.keys(next).forEach((name) => {
    if (SENSITIVE_HEADERS.includes(name.toLowerCase())) next[name] = null
  })
  return next
}

/**
 * Request ids of auth calls. A response may not carry its URL, so its body is
 * matched back to the request by reqId.
 */
const authRequestIds = new Set()

/** Exported for tests; LogRocket calls it for every recorded request. */
export function sanitizeRequest(request) {
  if (UNRECORDED_URL.test(request.url || '')) return null
  if (AUTH_PATH.test(request.url || '') && request.reqId != null) authRequestIds.add(request.reqId)
  return {
    ...request,
    headers: withoutSensitiveHeaders(request.headers),
    body: AUTH_PATH.test(request.url || '') ? null : request.body,
  }
}

/** Exported for tests; LogRocket calls it for every recorded response. */
export function sanitizeResponse(response) {
  // Login, /auth/csrf and registration answer with the CSRF token; /auth/me
  // with the profile. The status code and timing are still recorded.
  const isAuth =
    AUTH_PATH.test(response.url || '') ||
    (response.reqId != null && authRequestIds.has(response.reqId))
  if (response.reqId != null) authRequestIds.delete(response.reqId)
  return isAuth ? { ...response, body: undefined } : response
}

/** Start recording. Call once, as early as possible (before React renders). */
export function initLogRocket() {
  if (!ENABLED || started || typeof window === 'undefined' || !LogRocket) return
  safely('init', () => {
    LogRocket.init(APP_ID, {
      release: RELEASE,
      dom: {
        // Masks every typed value — passwords shown as text, OTP codes, mobile
        // numbers, IDs. Mark a field data-public to record it.
        inputSanitizer: true,
      },
      network: {
        requestSanitizer: sanitizeRequest,
        responseSanitizer: sanitizeResponse,
      },
    })
    started = true
  })
  // Labels recorded clicks with the React components under them. Must run
  // after init, once document.body exists (main.jsx runs at the end of body).
  if (started && setupLogRocketReact) safely('React plugin', () => setupLogRocketReact())
}

let identifiedAs = ''

/**
 * Tie the session to the signed-in account. Safe to call on every user
 * change: it only re-identifies when the id or the traits actually changed
 * (LogRocket allows ten identify calls per page).
 */
export function identifyUser(user) {
  if (!started || !user) return
  const uid = String(user.id || user.uid || user.email || '')
  if (!uid) return
  const traits = {
    name: user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || '',
    email: user.email || '',
    role: user.role || '',
  }
  if (user.custom_role_name) traits.customRole = user.custom_role_name
  const signature = JSON.stringify([uid, traits])
  if (signature === identifiedAs) return
  identifiedAs = signature
  safely('identify', () => LogRocket.identify(uid, traits))
}

/** A product event. Properties must be strings, numbers, booleans or arrays of them. */
export function trackEvent(name, properties) {
  if (!started) return
  safely('track', () => LogRocket.track(name, properties))
}

/** Report an error our code caught. `tags` and `extra` take scalar values only. */
export function captureError(error, { tags, extra } = {}) {
  if (!started) return
  safely('captureException', () =>
    LogRocket.captureException(error instanceof Error ? error : new Error(String(error)), {
      tags,
      extra,
    }),
  )
}
