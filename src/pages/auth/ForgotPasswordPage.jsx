import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../../components/layout/AuthShell'
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
  password: '',
  confirm_password: '',
}

const STEP = { IDENTIFY: 0, VERIFY: 1, PASSWORD: 2 }

const STEP_LABELS = ['Your email', 'Verify', 'New password']

/** Masked mobile for display. The full number never reaches the page. */
function maskedMobile(last4) {
  return `••••${last4 || '••••'}`
}

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
              className={`h-1 rounded-full ${done || current ? 'bg-volt' : 'bg-hairline'}`}
              aria-hidden="true"
            />
            <span className={`text-[12px] ${current ? 'font-semibold text-ink' : 'text-muted'}`}>
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
 * The account is proven by verifying BOTH channels already on it — the same
 * email OTP and Firebase Phone Auth widgets registration uses — so the middle
 * step here is the middle of registration, minus the ability to change what is
 * being verified.
 *
 * Only the email is typed. /auth/forgot-password/start looks the account up by
 * it, emails the code itself, and answers with the session plus the mobile
 * number already on file. Two things follow from that:
 *
 * - The email channel arrives ALREADY SENT. It adopts that code rather than
 *   calling send-otp, which would spend a second of the five-per-hour budget
 *   and invalidate the code sitting in the user's inbox. Resend still goes
 *   through send-otp.
 * - The SMS cannot come from the backend — Firebase Phone Auth runs in the
 *   browser — so it goes out on the Verify press, addressed to the number the
 *   start call returned. That number is used, never rendered: the page shows
 *   only the last four digits it was given.
 *
 * The session carries purpose "password_reset", which the register endpoints
 * reject, so the verification hook is handed the id and told not to open one.
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
  const [loading, setLoading] = useState(false)
  /** What /auth/forgot-password/start handed back, or null before it ran. */
  const [started, setStarted] = useState(null)

  const verification = useRegistrationVerification({
    // Both opened by handleStart below. Passing the session keeps the hook off
    // /auth/register/start, which a reset session is not valid for; passing the
    // number keeps it from deriving one from inputs this page does not have.
    sessionId: started?.session_id || '',
    phoneNumber: started?.mobile_number || '',
    email: form.email,
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
   * to retry against — the email has to be submitted again.
   */
  const restart = (message) => {
    setStarted(null)
    setStep(STEP.IDENTIFY)
    setSubmitError(message)
    // Both badges belong to the session being thrown away. Leaving them green
    // would let the next attempt walk past step two on a session that has
    // verified nothing, and fail at the reset with NOT_VERIFIED.
    verification.restartEmailVerification()
    verification.restartPhoneVerification()
    setForm((current) => ({ ...current, password: '', confirm_password: '' }))
  }

  /* ------------------------------ 1. email ------------------------------ */

  const handleStart = async (event) => {
    event.preventDefault()
    const validation = validateForgotPasswordForm(form)
    setErrors(validation)
    if (Object.keys(validation).length) return

    setLoading(true)
    setSubmitError('')
    try {
      const data = await authApi.forgotPasswordStart({ email: verification.email })
      setStarted(data)
      // The code is already in their inbox: open the entry box for it instead
      // of sending another, and run the resend timer from now.
      verification.adoptEmailCode()
      setStep(STEP.VERIFY)
    } catch (err) {
      setSubmitError(
        passwordResetErrorMessage(err, 'Could not start the reset. Please try again.'),
      )
    } finally {
      setLoading(false)
    }
  }

  /* ------------------------------ 2. verify ----------------------------- */

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

    if (!started) {
      restart('Your reset session is no longer available. Start again.')
      return
    }

    setLoading(true)
    setSubmitError('')
    try {
      const data = await authApi.forgotPasswordReset({
        session_id: started.session_id,
        email: verification.email,
        mobile_number: started.mobile_number,
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

  const mobileLabel = maskedMobile(started?.mobile_last4)

  return (
    <AuthShell>
      <div className="stack-md">
        <div>
          <h1>Reset your password</h1>
          <p className="text-muted">
            {step === STEP.IDENTIFY &&
              'Enter the email on your account. We will send a code to it, and to the mobile number registered with it.'}
            {step === STEP.VERIFY &&
              'Confirm both codes. We check the email and the mobile number already on your account.'}
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
              hint="The address you signed up with."
            />
            <Button type="submit" variant="accent" block loading={loading}>
              Continue
            </Button>
          </form>
        )}

        {step === STEP.VERIFY && (
          <div className="stack-md">
            {started?.message && <Alert variant="info">{started.message}</Alert>}

            {/* Email: the code was sent by the start call, so this row opens
                straight into the entry box. Resend goes through send-otp. */}
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
              autoSent
              extra={<Input label="Email" type="email" value={form.email} disabled readOnly />}
            />

            {/* Mobile: only the last four digits are known here. The SMS goes
                out on Verify, because Firebase Phone Auth runs in the browser. */}
            <OtpRow
              label="Mobile"
              state={verification.phoneState}
              code={verification.phoneCode}
              error={verification.phoneError}
              cooldown={verification.phoneCooldown}
              canStart={verification.phoneReady}
              onCodeChange={verification.setPhoneCode}
              sentTo={mobileLabel}
              onVerify={verification.sendPhoneOtp}
              onConfirm={verification.confirmPhoneOtp}
              onResend={verification.sendPhoneOtp}
              extra={
                <Input
                  label="Registered mobile"
                  value={mobileLabel}
                  disabled
                  readOnly
                  hint="Press Verify to text a code to this number."
                />
              }
            />

            <Button
              type="button"
              variant="accent"
              block
              disabled={!verification.bothVerified}
              onClick={goToPassword}
              rightIcon={<Icon name="arrowRight" size={17} />}
            >
              Continue
            </Button>
            {!verification.bothVerified && (
              <p className="text-center text-sm text-muted">
                Confirm both codes to continue.
              </p>
            )}
            <button
              type="button"
              className="text-center text-sm underline text-muted"
              onClick={() => restart('')}
            >
              Use a different email
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
