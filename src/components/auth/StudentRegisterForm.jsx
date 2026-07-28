import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Input, { PasswordInput } from '../ui/Input'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import { authApi } from '../../api/auth'
import { validateStudentForm } from '../../utils/validators'

const STUDENT_REGISTER_INITIAL = {
  team_name: '',
  university: '',
  team_leader_name: '',
  niat_id: '',
  email: '',
  mobile_no: '',
  team_member_1_name: '',
  team_member_1_email: '',
  team_member_2_name: '',
  team_member_2_email: '',
  team_member_3_name: '',
  team_member_3_email: '',
  team_member_4_name: '',
  team_member_4_email: '',
  password: '',
  confirm_password: '',
}

/**
 * Student / learner registration form. Owns its own state so it only mounts
 * when the parent expands the "Learner from Nxtwave" panel.
 */
export default function StudentRegisterForm({ onSuccess }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(STUDENT_REGISTER_INITIAL)
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
    const validation = validateStudentForm(form)
    setErrors(validation)
    if (Object.keys(validation).length) return

    setLoading(true)
    try {
      const res = await authApi.registerStudent(form)
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
        <Alert variant="success" title={success.message}>
          Your account is ready. You can sign in now.
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

      <div className="form-section-title">Team details</div>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <Input
          label="Team name"
          required
          maxLength={100}
          value={form.team_name}
          onChange={update('team_name')}
          error={errors.team_name}
        />
        <Input
          label="University"
          required
          maxLength={200}
          value={form.university}
          onChange={update('university')}
          error={errors.university}
        />
        <Input
          label="NIAT ID"
          required
          maxLength={50}
          value={form.niat_id}
          onChange={update('niat_id')}
          error={errors.niat_id}
        />
      </div>

      <div className="form-section-title">Team leader</div>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <Input
          label="Team leader name"
          required
          maxLength={100}
          autoComplete="name"
          value={form.team_leader_name}
          onChange={update('team_leader_name')}
          error={errors.team_leader_name}
        />
        <Input
          label="Team leader email"
          type="email"
          placeholder="leader@example.com"
          autoComplete="email"
          required
          value={form.email}
          onChange={update('email')}
          error={errors.email}
        />
        <Input
          label="Mobile number"
          type="tel"
          autoComplete="tel"
          required
          minLength={10}
          maxLength={15}
          value={form.mobile_no}
          onChange={update('mobile_no')}
          error={errors.mobile_no}
        />
      </div>

      <div className="form-section-title">Team members</div>
      <p className="text-sm text-muted">
        Members 1 and 2 are required. Members 3 and 4 are optional.
      </p>
      {[1, 2, 3, 4].map((number) => {
        const nameKey = `team_member_${number}_name`
        const emailKey = `team_member_${number}_email`
        const memberRequired = number <= 2
        return (
          <div className="grid grid-2" style={{ gap: 12 }} key={number}>
            <Input
              label={`Team member ${number} name`}
              required={memberRequired}
              maxLength={100}
              value={form[nameKey]}
              onChange={update(nameKey)}
              error={errors[nameKey]}
            />
            <Input
              label={`Team member ${number} email`}
              type="email"
              placeholder={`member${number}@example.com`}
              required={memberRequired}
              value={form[emailKey]}
              onChange={update(emailKey)}
              error={errors[emailKey]}
            />
          </div>
        )
      })}

      <div className="form-section-title">Account security</div>
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
        Create student account
      </Button>
    </form>
  )
}
