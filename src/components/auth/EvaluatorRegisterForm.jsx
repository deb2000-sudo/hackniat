import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Input from '../ui/Input'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import MobileField from './MobileField'
import OtpRow from './OtpRow'
import PasswordFields from './PasswordFields'
import { authApi } from '../../api/auth'
import { AUTH_ERROR, authErrorCode, authErrorField, authErrorMessage } from '../../api/authErrors'
import { VERIFY, useRegistrationVerification } from '../../hooks/useRegistrationVerification'
import { RECAPTCHA_CONTAINER_ID } from '../../lib/firebasePhone'
import { ROLES } from '../../utils/constants'
import { isNxtwaveEmail, validateEvaluatorForm } from '../../utils/validators'

const INITIAL = {
  first_name: '',
  last_name: '',
  employee_id: '',
  email: '',
  country_code: '+91',
  mobile_national: '',
  password: '',
  confirm_password: '',
}

/**
 * Evaluator self-registration — the student flow with an employee ID, a
 * corporate email domain, and an approval gate instead of a redirect to a
 * dashboard. Email and mobile verify independently against the same
 * registration session before the account can be created.
 */
export default function EvaluatorRegisterForm({ onSuccess }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const verification = useRegistrationVerification({
    role: ROLES.EVALUATOR,
    email: form.email,
    countryCode: form.country_code,
    mobileNational: form.mobile_national,
    onFieldError: (field, message) => setErrors((prev) => ({ ...prev, [field]: message })),
    isEmailValid: isNxtwaveEmail,
    invalidEmailMessage: 'Use your @nxtwave.co.in email address',
  })

  const fieldErrors = validateEvaluatorForm(form)
  const canSubmit = verification.bothVerified && Object.keys(fieldErrors).length === 0

  const update = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError('')
    // Editing an identifier drops only ITS OWN verification; the session is
    // left alone so an in-flight OTP on the other channel still resolves.
    if (key === 'email' && verification.emailState === VERIFY.VERIFIED) {
      verification.resetEmailVerification()
    }
    if (
      (key === 'mobile_national' || key === 'country_code') &&
      verification.phoneState === VERIFY.VERIFIED
    ) {
      verification.resetPhoneVerification()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validation = validateEvaluatorForm(form)
    setErrors(validation)
    if (!canSubmit || Object.keys(validation).length) return
    setLoading(true)
    setSubmitError('')
    try {
      // Use the id this call returns: a rebind can rotate it, and the state
      // copy is still the previous value in this tick.
      const sessionId = await verification.ensureFullSession()
      const data = await authApi.registerEvaluatorComplete({
        session_id: sessionId,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        employee_id: form.employee_id.trim(),
        email: verification.email,
        mobile_number: verification.phoneE164,
        password: form.password,
        confirm_password: form.confirm_password,
      })
      // Deliberately NOT refreshing AuthContext: the backend does set session
      // cookies, but a pending evaluator is 403 on every evaluator route, and
      // PublicOnlyRoute would bounce an authenticated user straight off this
      // page to that 403 — throwing away the message they need to read.
      setSubmitted(true)
      onSuccess?.(data)
    } catch (err) {
      const code = authErrorCode(err)
      const field = authErrorField(err)
      if (field) {
        setErrors((prev) => ({ ...prev, [field]: authErrorMessage(err) }))
      } else if (code === AUTH_ERROR.NOT_VERIFIED) {
        // The server disagrees that this session is verified, so the green
        // badges are stale. Drop both to re-block submit and force a re-verify.
        verification.resetEmailVerification()
        verification.resetPhoneVerification()
        setSubmitError(authErrorMessage(err))
      } else {
        setSubmitError(authErrorMessage(err, 'Registration failed. Please try again.'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="stack-md">
        <Alert variant="success" title="Evaluator registration submitted.">
          Your account is pending admin approval. Evaluator pages stay locked until an
          administrator approves you.
        </Alert>
        <Button variant="accent" block onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </div>
    )
  }

  const disabledReason = !canSubmit
    ? !verification.bothVerified
      ? 'Verify both email and mobile number to create your account.'
      : 'Fill every required field and match the password rules.'
    : ''

  return (
    <form className="stack-md" onSubmit={handleSubmit} noValidate>
      {submitError && <Alert variant="danger">{submitError}</Alert>}

      {/* Email and mobile verify independently; both required before submit. */}
      <OtpRow
        label="Mobile"
        state={verification.phoneState}
        code={verification.phoneCode}
        error={verification.phoneError}
        cooldown={verification.phoneCooldown}
        canStart={verification.phoneReady}
        onCodeChange={verification.setPhoneCode}
        sentTo={verification.phoneE164}
        onVerify={verification.sendPhoneOtp}
        onConfirm={verification.confirmPhoneOtp}
        onResend={verification.sendPhoneOtp}
        extra={
          <MobileField
            countryCode={form.country_code}
            mobileNational={form.mobile_national}
            onChange={update}
            error={errors.mobile_national}
            locked={verification.phoneState === VERIFY.VERIFIED}
          />
        }
      />
      <div id={RECAPTCHA_CONTAINER_ID} />

      <OtpRow
        label="Email"
        state={verification.emailState}
        code={verification.emailCode}
        error={verification.emailError}
        cooldown={verification.emailCooldown}
        canStart={verification.emailReady}
        onCodeChange={verification.setEmailCode}
        sentTo={verification.email}
        onVerify={verification.sendEmailOtp}
        onConfirm={verification.confirmEmailOtp}
        onResend={verification.sendEmailOtp}
        extra={
          <Input
            label="Nxtwave email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@nxtwave.co.in"
            value={form.email}
            onChange={update('email')}
            error={errors.email}
            disabled={verification.emailState === VERIFY.VERIFIED}
            readOnly={verification.emailState === VERIFY.VERIFIED}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="First name"
          required
          autoComplete="given-name"
          value={form.first_name}
          onChange={update('first_name')}
          error={errors.first_name}
        />
        <Input
          label="Last name"
          required
          autoComplete="family-name"
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

      <PasswordFields
        password={form.password}
        confirmPassword={form.confirm_password}
        onPasswordChange={update('password')}
        onConfirmPasswordChange={update('confirm_password')}
        errors={errors}
      />

      <Button type="submit" variant="accent" block loading={loading} disabled={!canSubmit}>
        Create evaluator account
      </Button>
      {disabledReason && <p className="text-center text-sm text-muted">{disabledReason}</p>}
    </form>
  )
}
