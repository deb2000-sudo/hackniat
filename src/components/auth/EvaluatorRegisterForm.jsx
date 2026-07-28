import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Input, { PasswordInput } from '../ui/Input'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import { authApi } from '../../api/auth'
import { validateEvaluatorForm } from '../../utils/validators'

const EVALUATOR_REGISTER_INITIAL = {
  first_name: '',
  last_name: '',
  employee_id: '',
  email: '',
  password: '',
  confirm_password: '',
}

/**
 * Evaluator self-registration form. Mounted on its own route so student and
 * evaluator registration stay isolated and lazy-loadable.
 */
export default function EvaluatorRegisterForm({ onSuccess }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(EVALUATOR_REGISTER_INITIAL)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    const validation = validateEvaluatorForm(form)
    setErrors(validation)
    if (Object.keys(validation).length) return

    setLoading(true)
    try {
      const res = await authApi.registerEvaluator(form)
      setSuccess(res)
      onSuccess?.(res)
    } catch (err) {
      setSubmitError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="stack-md">
        <Alert variant="warning" title={success.message}>
          Your evaluator account is pending administrator approval. You will be able to sign in
          once approved.
        </Alert>
        <Button variant="accent" block onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </div>
    )
  }

  return (
    <form className="stack-md" onSubmit={handleSubmit} noValidate>
      {submitError && <Alert variant="danger">{submitError}</Alert>}

      <div className="grid grid-2" style={{ gap: 12 }}>
        <Input
          label="First name"
          required
          value={form.first_name}
          onChange={update('first_name')}
          error={errors.first_name}
        />
        <Input
          label="Last name"
          required
          value={form.last_name}
          onChange={update('last_name')}
          error={errors.last_name}
        />
      </div>
      <Input
        label="Employee ID"
        required
        value={form.employee_id}
        onChange={update('employee_id')}
        error={errors.employee_id}
      />
      <Input
        label="Nxtwave email"
        type="email"
        placeholder="you@nxtwave.tech"
        autoComplete="email"
        required
        value={form.email}
        onChange={update('email')}
        error={errors.email}
      />
      <div className="grid grid-2" style={{ gap: 12 }}>
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={update('password')}
          error={errors.password}
          hint="At least 6 characters"
        />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          required
          value={form.confirm_password}
          onChange={update('confirm_password')}
          error={errors.confirm_password}
        />
      </div>

      <Button type="submit" variant="accent" block loading={loading}>
        Create evaluator account
      </Button>
    </form>
  )
}
