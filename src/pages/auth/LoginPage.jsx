import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthShell from '../../components/layout/AuthShell'
import { useAuth } from '../../hooks/useAuth'
import { validateLoginForm } from '../../utils/validators'
import { ROLE_HOME } from '../../utils/constants'

const initial = { email: '', password: '' }

function AlertIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.4v.1" />
    </svg>
  )
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 6c.46-.07.92-.1 1.4-.1 6.2 0 9.8 6.1 9.8 6.1a16 16 0 0 1-3.2 3.8" />
          <path d="M6.5 7.9A15.6 15.6 0 0 0 2.2 12S5.8 18.5 12 18.5c1.5 0 2.8-.3 3.9-.8" />
          <path d="M9.9 9.9a3.1 3.1 0 0 0 4.3 4.3" />
        </>
      ) : (
        <>
          <path d="M2.2 12S5.8 5.5 12 5.5 21.8 12 21.8 12 18.2 18.5 12 18.5 2.2 12 2.2 12z" />
          <circle cx="12" cy="12" r="3.1" />
        </>
      )}
    </svg>
  )
}

export default function LoginPage() {
  const { login, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setSubmitError('')
  }

  const checkCaps = (event) => {
    if (typeof event.getModifierState === 'function') setCapsLock(event.getModifierState('CapsLock'))
  }

  const togglePassword = () => {
    setShowPassword((value) => !value)
    passwordRef.current?.focus()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')
    const validation = validateLoginForm(form)
    setErrors(validation)
    if (Object.keys(validation).length) {
      ;(validation.email ? emailRef : passwordRef).current?.focus()
      return
    }

    setLoading(true)
    try {
      const user = await login(form)
      // Navigate in the same tick as the login: PublicOnlyRoute sends any
      // signed-in user to their role home on the next render, which would
      // drop the page they were sent here from.
      navigate(location.state?.from?.pathname || ROLE_HOME[user?.role] || '/', { replace: true })
    } catch (err) {
      setSubmitError(err.message || 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="cza-title">Welcome back</h1>
      <p className="cza-lede">Sign in to continue to Challazo.</p>

      {/* Sessions last an hour and cannot be renewed, so say so plainly —
          otherwise being dropped here looks like the app losing your work. */}
      {sessionExpired && !submitError && (
        <div className="cza-notice is-warn" role="status">
          <AlertIcon />
          <span>
            <b>Your session expired</b>
            Sessions last one hour. Sign in again to pick up where you left off.
          </span>
        </div>
      )}
      {location.state?.passwordChanged && (
        <div className="cza-notice is-ok" role="status">
          <span>Password changed successfully. Sign in with your new password.</span>
        </div>
      )}
      {location.state?.passwordReset && (
        <div className="cza-notice is-ok" role="status">
          <span>{location.state.message || 'Password reset successfully. Please log in.'}</span>
        </div>
      )}

      <form className="cza-form" onSubmit={handleSubmit} noValidate>
        {submitError && (
          <div className="cza-notice is-bad" role="alert">
            <AlertIcon />
            <span>{submitError}</span>
          </div>
        )}

        <div className={`cza-field${errors.email ? ' is-bad' : ''}`}>
          <label htmlFor="login-email">
            Email
            <span className="cza-req" aria-hidden="true" />
          </label>
          <div className="cza-inwrap">
            <input
              ref={emailRef}
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={form.email}
              onChange={update('email')}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
            />
          </div>
          {errors.email && (
            <span className="cza-hint" id="login-email-error">
              {errors.email}
            </span>
          )}
        </div>

        <div className={`cza-field is-pwd${errors.password ? ' is-bad' : ''}`}>
          <label htmlFor="login-password">
            Password
            <span className="cza-req" aria-hidden="true" />
          </label>
          <div className="cza-inwrap">
            <input
              ref={passwordRef}
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={form.password}
              onChange={update('password')}
              onKeyDown={checkCaps}
              onKeyUp={checkCaps}
              onBlur={() => setCapsLock(false)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
            />
            <button
              type="button"
              className="cza-peek"
              onClick={togglePassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          {errors.password && (
            <span className="cza-hint" id="login-password-error">
              {errors.password}
            </span>
          )}
          {capsLock && (
            <span className="cza-caps">
              <i />
              Caps Lock is on
            </span>
          )}
        </div>

        <Link className="cza-forgot" to="/forgot-password">
          Forgot password?
        </Link>
        <button className="cza-btn" type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="cza-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <p className="cza-foot">
        Don&apos;t have an account? <Link to="/register">Create one</Link>
      </p>
    </AuthShell>
  )
}
