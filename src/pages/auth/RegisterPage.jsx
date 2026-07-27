import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../../components/layout/AuthShell'
import Input, { PasswordInput } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import { authApi } from '../../api/auth'
import { ROLES } from '../../utils/constants'
import { validateEvaluatorForm, validateStudentForm } from '../../utils/validators'

const STUDENT_INITIAL = {
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

const EVALUATOR_INITIAL = {
  first_name: '',
  last_name: '',
  employee_id: '',
  email: '',
  password: '',
  confirm_password: '',
}

export default function RegisterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const role = searchParams.get('role') === ROLES.EVALUATOR ? ROLES.EVALUATOR : ROLES.STUDENT

  const [studentForm, setStudentForm] = useState(STUDENT_INITIAL)
  const [evaluatorForm, setEvaluatorForm] = useState(EVALUATOR_INITIAL)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)

  const isEvaluator = role === ROLES.EVALUATOR
  const form = isEvaluator ? evaluatorForm : studentForm
  const setForm = isEvaluator ? setEvaluatorForm : setStudentForm

  const switchRole = (nextRole) => {
    setErrors({})
    setSubmitError('')
    setSuccess(null)
    setSearchParams(nextRole === ROLES.EVALUATOR ? { role: ROLES.EVALUATOR } : {})
  }

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    const validation = isEvaluator
      ? validateEvaluatorForm(evaluatorForm)
      : validateStudentForm(studentForm)
    setErrors(validation)
    if (Object.keys(validation).length) return

    setLoading(true)
    try {
      const res = isEvaluator
        ? await authApi.registerEvaluator(evaluatorForm)
        : await authApi.registerStudent(studentForm)
      setSuccess(res)
    } catch (err) {
      setSubmitError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthShell wide={!isEvaluator}>
        <div className="stack-md">
          <h1>Registration successful</h1>
          <Alert variant={isEvaluator ? 'warning' : 'success'} title={success.message}>
            {isEvaluator
              ? 'Your evaluator account is pending administrator approval. You will be able to sign in once approved.'
              : 'Your account is ready. You can sign in now.'}
          </Alert>
          <Button variant="accent" block onClick={() => navigate('/login')}>
            Go to sign in
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell wide={!isEvaluator}>
      <div className="stack-md">
        <div>
          <h1>Create your account</h1>
          <p className="text-muted">Join HackNIAT to submit or evaluate projects.</p>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isEvaluator}
            className={`auth-tab ${!isEvaluator ? 'active' : ''}`}
            onClick={() => switchRole(ROLES.STUDENT)}
          >
            Student
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isEvaluator}
            className={`auth-tab ${isEvaluator ? 'active' : ''}`}
            onClick={() => switchRole(ROLES.EVALUATOR)}
          >
            Evaluator
          </button>
        </div>

        {submitError && <Alert variant="danger">{submitError}</Alert>}

        <form className="stack-md" onSubmit={handleSubmit} noValidate>
          {isEvaluator ? (
            <>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <Input
                  label="First name"
                  required
                  value={evaluatorForm.first_name}
                  onChange={update('first_name')}
                  error={errors.first_name}
                />
                <Input
                  label="Last name"
                  required
                  value={evaluatorForm.last_name}
                  onChange={update('last_name')}
                  error={errors.last_name}
                />
              </div>
              <Input
                label="Employee ID"
                required
                value={evaluatorForm.employee_id}
                onChange={update('employee_id')}
                error={errors.employee_id}
              />
              <Input
                label="Nxtwave email"
                type="email"
                placeholder="you@nxtwave.tech"
                autoComplete="email"
                required
                value={evaluatorForm.email}
                onChange={update('email')}
                error={errors.email}
              />
            </>
          ) : (
            <>
              <div className="form-section-title">Team details</div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <Input
                  label="Team name"
                  required
                  maxLength={100}
                  value={studentForm.team_name}
                  onChange={update('team_name')}
                  error={errors.team_name}
                />
                <Input
                  label="University"
                  required
                  maxLength={200}
                  value={studentForm.university}
                  onChange={update('university')}
                  error={errors.university}
                />
                <Input
                  label="NIAT ID"
                  required
                  maxLength={50}
                  value={studentForm.niat_id}
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
                  value={studentForm.team_leader_name}
                  onChange={update('team_leader_name')}
                  error={errors.team_leader_name}
                />
                <Input
                  label="Team leader email"
                  type="email"
                  placeholder="leader@example.com"
                  autoComplete="email"
                  required
                  value={studentForm.email}
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
                  value={studentForm.mobile_no}
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
                      value={studentForm[nameKey]}
                      onChange={update(nameKey)}
                      error={errors[nameKey]}
                    />
                    <Input
                      label={`Team member ${number} email`}
                      type="email"
                      placeholder={`member${number}@example.com`}
                      required={memberRequired}
                      value={studentForm[emailKey]}
                      onChange={update(emailKey)}
                      error={errors[emailKey]}
                    />
                  </div>
                )
              })}
            </>
          )}

          {!isEvaluator && <div className="form-section-title">Account security</div>}
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
            Create {isEvaluator ? 'evaluator' : 'student'} account
          </Button>
        </form>

        <p className="text-sm text-center text-muted">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  )
}
