import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../../components/layout/AuthShell'
import MobileField from '../../components/auth/MobileField'
import OtpRow from '../../components/auth/OtpRow'
import PasswordFields from '../../components/auth/PasswordFields'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Input from '../../components/ui/Input'
import { authApi } from '../../api/auth'
import {
  AUTH_ERROR,
  authErrorCode,
  isDeadSessionError,
  passwordResetErrorMessage,
} from '../../api/authErrors'
import { clearCsrfToken } from '../../api/client'
import { useRegistrationVerification } from '../../hooks/useRegistrationVerification'
import { RECAPTCHA_CONTAINER_ID } from '../../lib/firebasePhone'
import { LINK_INLINE } from '../../components/drop/theme'
import {
  validateForgotPasswordForm,
  validateNewPasswordForm,
} from '../../utils/validators'

const INITIAL = {
  email: '',
  country_code: '+91',
  mobile_national: '',
  password: '',
  confirm_password: '',
}

const STEP = { IDENTIFY: 0, VERIFY: 1, PASSWORD: 2 }

const STEP_LABELS = ['Your details', 'Verify', 'New password']

/** Progress rail across the three stages. */
function Stepper({ step }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Password reset progress">
      {STEP_LABELS.map((label, index) => {
        const done = index < step
        const current = index === step
        return (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1 rounded-full ${
                done || current ? 'bg-volt' : 'bg-hairline'
              }`}
              aria-hidden="true"
            />
            <span
              className={`text-[12px] ${current ? 'font-semibold text-ink' : 'text-muted'}`}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Reset a forgotten password without being signed in.
 *
 * The account is proven by re-verifying BOTH identifiers already on it — the
 * same email OTP and Firebase Phone Auth widgets registration uses — so the
 * middle step here is literally the middle of registration, minus the ability
 * to change what is being verified.
 *
 * Where it differs: the session is opened up front by
 * /auth/forgot-password/start, which needs both identifiers together and only
 * answers for an account that exists. It carries purpose "password_reset", so
 * the register endpoints would reject it; the verification hook is given the
 * id and told not to open one of its own.
 *
 * Works for every role. An evaluator awaiting approval can reset and sign in,
 * and stays pending afterwards — resetting a password is not approval.
 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(STEP.IDENTIFY)
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [loading, setLoading] = useState(false)

  const verification = useRegistrationVerification({
    // Opened by handleStart below. Passing it keeps the hook off
    // /auth/register/start, which a reset session is not valid for.
    sessionId,
    email: form.email,
    countryCode: form.country_code,
    mobileNational: form.mobile_national,
    onFieldError: (field, message) => setErrors((prev) => ({ ...prev, [field]: message })),
  })

  const update = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError('')
  }

  /**
   * Throw the session away and go back to step one.
   *
   * Reset sessions expire after 30 minutes and cannot be re-bound the way a
   * registration session can, so an expired or mismatched one has nothing left
   * to retry against — the identifiers have to be submitted again.
   */
  const restart = (message) => {
    setSessionId('')
    setStep(STEP.IDENTIFY)
    setSubmitError(message)
    // Both badges belong to the session being thrown away. Leaving them green
    // would let the next attempt walk straight past step two on a session that
    // has verified nothing, and fail at the reset with NOT_VERIFIED.
    verification.restartEmailVerification()
    verification.restartPhoneVerification()
    setForm((current) => ({ ...current, password: '', confirm_password: '' }))
  }

  /* --------------------------- 1. identifiers --------------------------- */

  const handleStart = async (event) => {
    event.preventDefault()
    const validation = validateForgotPasswordForm(form)
    setErrors(validation)
    if (Object.keys(validation).length) return

    setLoading(true)
    setSubmitError('')
    try {
      const { session_id: id } = await authApi.forgotPasswordStart({
        email: verification.email,
        // E.164 throughout — start, verify-phone-token and reset must all send
        // the identical string or the reset fails with IDENTIFIER_MISMATCH.
        mobile_number: verification.phoneE164,
      })
      setSessionId(id)
      setStep(STEP.VERIFY)
    } catch (err) {
      setSubmitError(
        passwordResetErrorMessage(err, 'Could not start the reset. Please try again.'),
      )
    } finally {
      setLoading(false)
    }
  }

  /* ---------------------------- 2. verify ------------------------------- */

  const goToPassword = () => {
    if (!verification.bothVerified) return
    setSubmitError('')
    setStep(STEP.PASSWORD)
  }

  /* --------------------------- 3. new password -------------------------- */

  const handleReset = async (event) => {
    event.preventDefault()
    const validation = validateNewPasswordForm(form)
    setErrors(validation)
    if (Object.keys(validation).length) return

    setLoading(true)
    setSubmitError('')
    try {
      const data = await authApi.forgotPasswordReset({
        session_id: sessionId,
        email: verification.email,
        mobile_number: verification.phoneE164,
        new_password: form.password,
        confirm_password: form.confirm_password,
      })
      // The reset sets no cookies and revokes existing sessions, so any token
      // left in this tab is already dead.
      clearCsrfToken()
      navigate('/login', {
        replace: true,
        state: {
          passwordReset: true,
          message: data?.message || 'Password reset successfully. Please log in.',
        },
      })
    } catch (err) {
      const message = passwordResetErrorMessage(err, 'Could not reset your password.')
      if (isDeadSessionError(err)) {
        restart(message)
        return
      }
      // NOT_VERIFIED means the session disagrees with the badges on screen —
      // so the badges are wrong. Clear them and send the user back to the one
      // step that can put it right, rather than leaving them on a dead button.
      if (authErrorCode(err) === AUTH_ERROR.NOT_VERIFIED) {
        verification.restartEmailVerification()
        verification.restartPhoneVerification()
        setStep(STEP.VERIFY)
      }
      setSubmitError(message)
    } finally {
      setLoading(false)
    }
  }

  const sentBothCodes = verification.bothVerified

  return (
    <AuthShell>
      <div className="stack-md">
        <div>
          <h1>Reset your password</h1>
          <p className="text-muted">
            {step === STEP.IDENTIFY &&
              'Enter the email and mobile number on your account. You will verify both before choosing a new password.'}
            {step === STEP.VERIFY &&
              'Send yourself a code on each channel and enter both. We check the email and the mobile number already on your account.'}
            {step === STEP.PASSWORD && 'Choose a new password for your Drop account.'}
          </p>
        </div>

        <Stepper step={step} />

        {submitError && <Alert variant="danger">{submitError}</Alert>}

        {step === STEP.IDENTIFY && (
          <form className="stack-md" onSubmit={handleStart} noValidate>
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
            <MobileField
              countryCode={form.country_code}
              mobileNational={form.mobile_national}
              onChange={update}
              error={errors.mobile_national}
            />
            <Button type="submit" variant="accent" block loading={loading}>
              Continue
            </Button>
          </form>
        )}

        {step === STEP.VERIFY && (
          <div className="stack-md">
            {/* Both identifiers are fixed to the session now, so the fields are
                read-only: changing one here could only ever produce a mismatch. */}
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
                  value={form.email}
                  onChange={update('email')}
                  disabled
                  readOnly
                />
              }
            />

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
                  locked
                />
              }
            />

            <Button
              type="button"
              variant="accent"
              block
              disabled={!sentBothCodes}
              onClick={goToPassword}
              rightIcon={<Icon name="arrowRight" size={17} />}
            >
              Continue
            </Button>
            {!sentBothCodes && (
              <p className="text-center text-sm text-muted">
                Verify both your email and your mobile number to continue.
              </p>
            )}
            <button
              type="button"
              className="text-center text-sm underline text-muted"
              onClick={() => restart('')}
            >
              Use a different email or mobile number
            </button>
          </div>
        )}

        {step === STEP.PASSWORD && (
          <form className="stack-md" onSubmit={handleReset} noValidate>
            <PasswordFields
              password={form.password}
              confirmPassword={form.confirm_password}
              onPasswordChange={update('password')}
              onConfirmPasswordChange={update('confirm_password')}
              errors={errors}
            />
            <Button type="submit" variant="accent" block loading={loading}>
              Reset password
            </Button>
            <p className="text-center text-sm text-muted">
              You will be signed out everywhere and asked to sign in again.
            </p>
          </form>
        )}

        {/* Invisible Firebase widget. Kept mounted for the whole page: the
            verifier is built against this element, and unmounting it between
            steps leaves a stale widget the next send cannot replace. */}
        <div id={RECAPTCHA_CONTAINER_ID} />

        <p className="text-sm text-center text-muted">
          Remembered it?{' '}
          <Link to="/login" className={LINK_INLINE}>
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
