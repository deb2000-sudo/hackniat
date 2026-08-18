import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { clearCsrfToken } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import PageHeader from '../../components/layout/PageHeader'
import Card, { CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Icon from '../../components/ui/Icon'
import { PasswordInput } from '../../components/ui/Input'

const INITIAL_FORM = {
  current_password: '',
  new_password: '',
  confirm_new_password: '',
}

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const redirectTimerRef = useRef(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [submitError, setSubmitError] = useState('')

  useEffect(
    () => () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    },
    [],
  )

  const passwordsMatch =
    form.new_password.length >= 6 &&
    form.confirm_new_password.length >= 6 &&
    form.new_password === form.confirm_new_password
  const canSubmit = form.current_password.length > 0 && passwordsMatch
  const confirmError =
    form.confirm_new_password && form.new_password !== form.confirm_new_password
      ? 'New password and confirm new password do not match'
      : ''

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    setSubmitError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canSubmit || loading) return

    setLoading(true)
    setSubmitError('')
    try {
      const response = await authApi.changePassword(form)
      clearCsrfToken()
      setSuccess(response?.message || 'Password changed successfully. Redirecting to sign in…')
      redirectTimerRef.current = setTimeout(() => {
        setUser(null)
        navigate('/login', { replace: true, state: { passwordChanged: true } })
      }, 1500)
    } catch (error) {
      setSubmitError(error.message || 'Unable to change your password. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="container container--narrow page">
      <PageHeader
        eyebrow="Settings"
        title="Change password"
        description="Choose a new password for your Drop account. You will need to sign in again afterward."
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            leftIcon={<Icon name="arrowLeft" size={18} />}
          >
            Back
          </Button>
        }
      />

      <Card>
        <CardBody>
          <form className="stack-md" onSubmit={handleSubmit} noValidate>
            {success && <Alert variant="success">{success}</Alert>}
            {submitError && <Alert variant="danger">{submitError}</Alert>}

            <PasswordInput
              label="Current password"
              autoComplete="current-password"
              required
              value={form.current_password}
              onChange={update('current_password')}
              disabled={loading || !!success}
            />

            <PasswordInput
              label="New password"
              autoComplete="new-password"
              minLength={6}
              required
              value={form.new_password}
              onChange={update('new_password')}
              hint="At least 6 characters"
              disabled={loading || !!success}
            />

            <PasswordInput
              label="Confirm new password"
              autoComplete="new-password"
              minLength={6}
              required
              value={form.confirm_new_password}
              onChange={update('confirm_new_password')}
              error={confirmError}
              disabled={loading || !!success}
            />

            <Button
              type="submit"
              variant="accent"
              block
              loading={loading}
              disabled={!canSubmit || !!success}
            >
              Change password
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
