import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthShell from '../../components/layout/AuthShell'
import Input, { PasswordInput } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import { useAuth } from '../../hooks/useAuth'
import { validateLoginForm } from '../../utils/validators'
import { ROLE_HOME } from '../../utils/constants'
import { LINK_INLINE } from '../../components/drop/theme'

const initial = { email: '', password: '' }

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    const validation = validateLoginForm(form)
    setErrors(validation)
    if (Object.keys(validation).length) return

    setLoading(true)
    try {
      const user = await login(form)
      const from = location.state?.from?.pathname
      navigate(from || ROLE_HOME[user?.role] || '/', { replace: true })
    } catch (err) {
      setSubmitError(err.message || 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="stack-md">
        <div>
          <h1>Welcome back</h1>
          <p className="text-muted">Sign in to continue to Drop.</p>
        </div>

        {submitError && <Alert variant="danger">{submitError}</Alert>}
        {location.state?.passwordChanged && (
          <Alert variant="success">Password changed successfully. Sign in with your new password.</Alert>
        )}
        {location.state?.passwordReset && (
          <Alert variant="success">
            {location.state.message || 'Password reset successfully. Please log in.'}
          </Alert>
        )}

        <form className="stack-md" onSubmit={handleSubmit} noValidate>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            value={form.email}
            onChange={update('email')}
            error={errors.email}
          />
          <PasswordInput
            label="Password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={update('password')}
            error={errors.password}
          />
          <div className="-mt-1 text-right">
            <Link to="/forgot-password" className={LINK_INLINE}>
              Forgot password?
            </Link>
          </div>
          <Button type="submit" variant="accent" block loading={loading}>
            Sign in
          </Button>
        </form>

        <p className="text-sm text-center text-muted">
          Don&apos;t have an account? <Link to="/register" className={LINK_INLINE}>Create one</Link>
        </p>
      </div>
    </AuthShell>
  )
}
