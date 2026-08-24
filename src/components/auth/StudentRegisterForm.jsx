import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Input from '../ui/Input'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import MobileField from './MobileField'
import OtpRow from './OtpRow'
import PasswordFields from './PasswordFields'
import { authApi } from '../../api/auth'
import { authErrorField, authErrorMessage } from '../../api/authErrors'
import { setCsrfToken } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { VERIFY, useRegistrationVerification } from '../../hooks/useRegistrationVerification'
import { RECAPTCHA_CONTAINER_ID } from '../../lib/firebasePhone'
import { ROLE_HOME } from '../../utils/constants'
import { validateStudentForm } from '../../utils/validators'

const INITIAL = {
  first_name: '',
  last_name: '',
  email: '',
  university_name: '',
  niat_id: '',
  country_code: '+91',
  mobile_national: '',
  password: '',
  confirm_password: '',
}

export default function StudentRegisterForm() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  const verification = useRegistrationVerification({
    email: form.email,
    countryCode: form.country_code,
    mobileNational: form.mobile_national,
    onFieldError: (field, message) => setErrors((prev) => ({ ...prev, [field]: message })),
  })

  const fieldErrors = validateStudentForm(form)
  const canSubmit = verification.bothVerified && Object.keys(fieldErrors).length === 0

  const update = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError('')
    // Editing an identifier drops only ITS OWN verification. Do not touch the
    // session here: the hook compares the live pair against the bound one on
    // the next send and resets both channels if the pair actually moved.
    // Clearing the session id on every keystroke instead wiped the id out from
    // under an in-flight OTP — verify mobile, start typing while waiting for
    // the SMS, and the confirm posted an empty session_id — and it silently
    // dropped the other channel's badge.
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
    const validation = validateStudentForm(form)
    setErrors(validation)
    if (!canSubmit || Object.keys(validation).length) return
    setLoading(true)
    setSubmitError('')
    try {
      // Use the id this call returns: a rebind can rotate it, and the state
      // copy is still the previous value in this tick.
      const sessionId = await verification.ensureFullSession()
      const data = await authApi.registerComplete({
        session_id: sessionId,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: verification.email,
        university_name: form.university_name.trim(),
        niat_id: form.niat_id.trim(),
        mobile_number: verification.phoneE164,
        password: form.password,
        confirm_password: form.confirm_password,
      })
      if (data?.csrf_token) setCsrfToken(data.csrf_token)
      await refresh()
      navigate(ROLE_HOME.student, { replace: true })
    } catch (err) {
      const field = authErrorField(err)
      if (field) setErrors((prev) => ({ ...prev, [field]: authErrorMessage(err) }))
      else setSubmitError(authErrorMessage(err, 'Registration failed. Please try again.'))
    } finally {
      setLoading(false)
    }
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
            label="Email"
            type="email"
            required
            autoComplete="email"
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
        label="University name"
        required
        value={form.university_name}
        onChange={update('university_name')}
        error={errors.university_name}
      />
      <Input
        label="NIAT ID"
        required
        value={form.niat_id}
        onChange={update('niat_id')}
        error={errors.niat_id}
      />

      <PasswordFields
        password={form.password}
        confirmPassword={form.confirm_password}
        onPasswordChange={update('password')}
        onConfirmPasswordChange={update('confirm_password')}
        errors={errors}
      />

      <Button type="submit" variant="accent" block loading={loading} disabled={!canSubmit}>
        Create account
      </Button>
      {disabledReason && <p className="text-center text-sm text-muted">{disabledReason}</p>}
    </form>
  )
}
