import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Input, { PasswordInput } from '../ui/Input'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import Icon from '../ui/Icon'
import { authApi } from '../../api/auth'
import {
  validateStudentSecurity,
  validateStudentTeamDetails,
  validateStudentTeamLeader,
  validateStudentTeamMembers,
} from '../../utils/validators'

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

const STEPS = [
  { id: 'team', label: 'Team', validate: validateStudentTeamDetails },
  { id: 'leader', label: 'Leader', validate: validateStudentTeamLeader },
  { id: 'members', label: 'Members', validate: validateStudentTeamMembers },
  { id: 'security', label: 'Security', validate: validateStudentSecurity },
]

/**
 * Section-wise student registration wizard. One step visible at a time so the
 * accordion panel stays compact (no scrollbar).
 */
export default function StudentRegisterForm({ onSuccess }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(STUDENT_REGISTER_INITIAL)
  const [step, setStep] = useState(0)
  const [completed, setCompleted] = useState(() => STEPS.map(() => false))
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)
  const [direction, setDirection] = useState(1)

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const goToStep = (next) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
    setErrors({})
    setSubmitError('')
  }

  const validateCurrent = () => {
    const validation = STEPS[step].validate(form)
    setErrors(validation)
    return Object.keys(validation).length === 0
  }

  const handleNext = (e) => {
    e.preventDefault()
    if (!validateCurrent()) return
    setCompleted((prev) => prev.map((done, i) => (i === step ? true : done)))
    if (step < STEPS.length - 1) goToStep(step + 1)
  }

  const handleBack = () => {
    if (step === 0) return
    goToStep(step - 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    if (!validateCurrent()) return

    setLoading(true)
    try {
      const res = await authApi.registerStudent(form)
      setCompleted(STEPS.map(() => true))
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
      <div className="stack-md student-register-success">
        <div className="student-register-success__mark" aria-hidden="true">
          <Icon name="check" size={28} />
        </div>
        <Alert variant="success" title={success.message}>
          Your account is ready. You can sign in now.
        </Alert>
        <Button variant="accent" block onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </div>
    )
  }

  const isLast = step === STEPS.length - 1

  return (
    <div className="student-register-wizard">
      <ol className="student-register-steps" aria-label="Registration progress">
        {STEPS.map((item, index) => {
          const isActive = index === step
          const isDone = completed[index] || index < step
          return (
            <li
              key={item.id}
              className={[
                'student-register-steps__item',
                isActive ? 'is-active' : '',
                isDone ? 'is-done' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="student-register-steps__mark" aria-hidden="true">
                {isDone ? <Icon name="check" size={14} /> : index + 1}
              </span>
              <span className="student-register-steps__label">{item.label}</span>
              {index < STEPS.length - 1 && (
                <span className="student-register-steps__connector" aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>

      <form
        className="student-register-panel"
        onSubmit={isLast ? handleSubmit : handleNext}
        noValidate
      >
        {submitError && <Alert variant="danger">{submitError}</Alert>}

        <div
          key={STEPS[step].id}
          className={`student-register-section student-register-section--${direction > 0 ? 'forward' : 'back'}`}
        >
          {step === 0 && (
            <>
              <div className="student-register-section__head">
                <h3>Team details</h3>
                <p>Basic information about your hackathon team.</p>
              </div>
              <div className="stack-md">
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
            </>
          )}

          {step === 1 && (
            <>
              <div className="student-register-section__head">
                <h3>Team leader</h3>
                <p>Contact details for the team lead.</p>
              </div>
              <div className="stack-md">
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
            </>
          )}

          {step === 2 && (
            <>
              <div className="student-register-section__head">
                <h3>Team members</h3>
                <p>Members 1 and 2 are required. 3 and 4 are optional.</p>
              </div>
              <div className="stack-md student-register-members">
                {[1, 2, 3, 4].map((number) => {
                  const nameKey = `team_member_${number}_name`
                  const emailKey = `team_member_${number}_email`
                  const memberRequired = number <= 2
                  return (
                    <div className="student-register-member-row" key={number}>
                      <Input
                        label={`Member ${number} name`}
                        required={memberRequired}
                        maxLength={100}
                        value={form[nameKey]}
                        onChange={update(nameKey)}
                        error={errors[nameKey]}
                      />
                      <Input
                        label={`Member ${number} email`}
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
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="student-register-section__head">
                <h3>Account security</h3>
                <p>Choose a password for your HackNIAT account.</p>
              </div>
              <div className="stack-md">
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
            </>
          )}
        </div>

        <div className="student-register-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            disabled={step === 0 || loading}
            leftIcon={<Icon name="arrowLeft" size={16} />}
          >
            Back
          </Button>
          <Button
            type="submit"
            variant="accent"
            loading={loading}
            rightIcon={!isLast && !loading ? <Icon name="arrowRight" size={16} /> : undefined}
          >
            {isLast ? 'Create account' : 'Continue'}
          </Button>
        </div>
      </form>
    </div>
  )
}
