import { useEffect, useRef, useState } from 'react'
import { RecaptchaVerifier, signInWithPhoneNumber, signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import Input, { PasswordInput } from '../ui/Input'
import OtpInput from './OtpInput'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import Icon from '../ui/Icon'
import { authApi } from '../../api/auth'
import { setCsrfToken } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { getFirebaseAuth } from '../../lib/firebase'
import { ROLE_HOME } from '../../utils/constants'
import {
  isE164,
  isEmail,
  passwordStrength,
  toE164,
  validateStudentForm,
} from '../../utils/validators'

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

const COUNTRY_CODES = [
  { value: '+91', label: '+91 IN' },
  { value: '+1', label: '+1 US' },
  { value: '+44', label: '+44 UK' },
  { value: '+971', label: '+971 AE' },
  { value: '+65', label: '+65 SG' },
  { value: '+61', label: '+61 AU' },
]

const IDLE = 'idle'
const SENDING = 'sending'
const AWAITING = 'awaiting_code'
const VERIFYING = 'verifying'
const VERIFIED = 'verified'
const ERROR = 'error'

/**
 * Turn a Firebase Auth error into something a user can act on.
 *
 * Phone Auth failures are nearly always configuration rather than user error,
 * and the raw strings ("Firebase: Error (auth/invalid-app-credential).") tell
 * the person filling in the form nothing.
 */
function firebasePhoneMessage(err) {
  switch (err?.code) {
    case 'auth/invalid-app-credential':
    case 'auth/captcha-check-failed':
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        return (
          'Phone verification does not work on localhost. Open http://127.0.0.1:5173 ' +
          '(not localhost), add 127.0.0.1 in Firebase → Authentication → Authorized domains, ' +
          'or test on staging (challzo.vercel.app).'
        )
      }
      return (
        'Phone verification could not start (reCAPTCHA). Refresh and try again. ' +
        'If it keeps failing, add this domain in Firebase → Authentication → Authorized domains, ' +
        'or use a test phone number under Sign-in method → Phone.'
      )
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised for phone sign-in in the Firebase project.'
    case 'auth/operation-not-allowed':
      return 'Phone sign-in is not enabled for this Firebase project.'
    case 'auth/invalid-phone-number':
      return 'That mobile number is not valid. Check the country code and try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts from this device. Wait a few minutes before trying again.'
    case 'auth/quota-exceeded':
      return 'The SMS quota for this project has been used up. Try again later.'
    default:
      return err?.message || 'Could not send SMS code'
  }
}

function OtpRow({
  label,
  code,
  onCodeChange,
  onVerify,
  onConfirm,
  onResend,
  state,
  error,
  cooldown,
  canStart,
  extra,
  sentTo,
}) {
  const showOtp = state === AWAITING || state === VERIFYING || state === ERROR || state === SENDING
  return (
    <div className="stack-sm">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">{extra}</div>
        {state === VERIFIED ? (
          <span className="mb-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-3 py-1.5 text-sm font-semibold text-emerald-600">
            <Icon name="checkCircle" size={17} />
            Verified
          </span>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="mb-2 shrink-0"
            loading={state === SENDING}
            disabled={state === SENDING || state === VERIFYING || !canStart}
            onClick={onVerify}
          >
            Verify
          </Button>
        )}
      </div>
      {showOtp && state !== VERIFIED && (
        <div className="stack-sm rounded-drop border border-hairline bg-surface p-3">
          <span className="label">{label} code</span>
          {(state === AWAITING || state === VERIFYING) && sentTo && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <Icon name="checkCircle" size={15} />
              Code sent to {sentTo}
            </p>
          )}
          <OtpInput
            label={`${label} code`}
            value={code}
            onChange={onCodeChange}
            disabled={state === VERIFYING}
            invalid={Boolean(error)}
          />
          {error && <p className="text-sm text-missing">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="accent"
              loading={state === VERIFYING}
              disabled={String(code || '').length !== 6 || state === VERIFYING}
              onClick={onConfirm}
            >
              Confirm code
            </Button>
            {cooldown > 0 ? (
              <span className="text-sm text-muted">Resend in {cooldown}s</span>
            ) : (
              <button type="button" className="text-sm underline" onClick={onResend}>
                Resend code
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function StudentRegisterForm() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  const [sessionId, setSessionId] = useState('')
  const [sessionEmail, setSessionEmail] = useState('')
  const [sessionPhone, setSessionPhone] = useState('')

  const [emailState, setEmailState] = useState(IDLE)
  const [emailError, setEmailError] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailCooldown, setEmailCooldown] = useState(0)

  const [phoneState, setPhoneState] = useState(IDLE)
  const [phoneError, setPhoneError] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneCooldown, setPhoneCooldown] = useState(0)
  const confirmationRef = useRef(null)
  const recaptchaRef = useRef(null)

  const phoneE164 = toE164(form.country_code, form.mobile_national)
  const strength = passwordStrength(form.password)
  const fieldErrors = validateStudentForm(form)
  const canSubmit =
    emailState === VERIFIED &&
    phoneState === VERIFIED &&
    Object.keys(fieldErrors).length === 0

  useEffect(() => {
    if (emailCooldown <= 0) return undefined
    const id = setTimeout(() => setEmailCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [emailCooldown])

  useEffect(() => {
    if (phoneCooldown <= 0) return undefined
    const id = setTimeout(() => setPhoneCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [phoneCooldown])

  const update = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError('')
    // The session is bound to the (email, mobile) pair, so editing either one
    // invalidates it — and with it BOTH verifications, not just the edited
    // channel. Resetting only one left the other showing a stale "Verified"
    // badge against a session the backend had already discarded, so submit
    // sailed through the client gate and came back NOT_VERIFIED.
    const identifierKeys = ['email', 'mobile_national', 'country_code']
    if (identifierKeys.includes(key) && (sessionId || emailState === VERIFIED || phoneState === VERIFIED)) {
      setSessionId('')
      setSessionEmail('')
      setSessionPhone('')
      setEmailState(IDLE)
      setEmailCode('')
      setEmailError('')
      setPhoneState(IDLE)
      setPhoneCode('')
      setPhoneError('')
    }
  }

  const ensureSession = async () => {
    const email = form.email.trim().toLowerCase()
    if (!isEmail(email)) {
      setErrors((prev) => ({ ...prev, email: 'Enter a valid email' }))
      throw new Error('Enter a valid email first — one session covers both email and mobile.')
    }
    if (!phoneE164.startsWith('+') || phoneE164.length < 10) {
      setErrors((prev) => ({ ...prev, mobile_national: 'Enter a valid mobile number' }))
      throw new Error('Add your mobile number first — one session covers both email and mobile.')
    }
    if (sessionId && sessionEmail === email && sessionPhone === phoneE164) {
      return sessionId
    }
    if (sessionId && (sessionEmail !== email || sessionPhone !== phoneE164)) {
      setEmailState(IDLE)
      setPhoneState(IDLE)
    }
    const { session_id: nextId } = await authApi.registerStart({
      email,
      mobile_number: phoneE164,
    })
    setSessionId(nextId)
    setSessionEmail(email)
    setSessionPhone(phoneE164)
    return nextId
  }

  const sendEmailOtp = async () => {
    setEmailError('')
    setEmailState(SENDING)
    try {
      const id = await ensureSession()
      await authApi.sendEmailOtp({ session_id: id, email: form.email.trim().toLowerCase() })
      setEmailState(AWAITING)
      setEmailCooldown(60)
    } catch (err) {
      setEmailState(ERROR)
      setEmailError(err.message || 'Could not send email code')
    }
  }

  const confirmEmailOtp = async () => {
    setEmailError('')
    setEmailState(VERIFYING)
    try {
      await authApi.verifyEmailOtp({ session_id: sessionId, code: emailCode })
      setEmailState(VERIFIED)
    } catch (err) {
      setEmailState(ERROR)
      setEmailError(err.message || 'Invalid code')
    }
  }

  /**
   * Tear down any existing reCAPTCHA widget.
   *
   * `clear()` unregisters it with grecaptcha; dropping the ref alone leaves the
   * rendered widget in the container, and the next verifier built on the same
   * element then produces a token Firebase rejects.
   */
  const resetRecaptcha = () => {
    if (recaptchaRef.current) {
      try {
        recaptchaRef.current.clear()
      } catch {
        // Already torn down (e.g. the container unmounted) — nothing to undo.
      }
      recaptchaRef.current = null
    }
    const host = document.getElementById('recaptcha-container')
    if (host) host.innerHTML = ''
  }

  /**
   * Build a FRESH verifier for every send.
   *
   * An invisible reCAPTCHA token is single-use: signInWithPhoneNumber consumes
   * it, so reusing the same verifier for "Resend code" (or after a failed
   * attempt) fails with auth/invalid-app-credential.
   */
  const prepareRecaptcha = async () => {
    const auth = getFirebaseAuth()
    resetRecaptcha()
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    })
    await verifier.render()
    recaptchaRef.current = verifier
    return verifier
  }

  // Drop the widget when the form unmounts so a remount starts clean.
  useEffect(() => () => resetRecaptcha(), [])

  const sendPhoneOtp = async () => {
    setPhoneError('')
    setPhoneState(SENDING)
    try {
      await ensureSession()
      const auth = getFirebaseAuth()
      const verifier = await prepareRecaptcha()
      confirmationRef.current = await signInWithPhoneNumber(auth, phoneE164, verifier)
      setPhoneState(AWAITING)
      setPhoneCooldown(60)
    } catch (err) {
      resetRecaptcha()
      setPhoneState(ERROR)
      setPhoneError(firebasePhoneMessage(err))
    }
  }

  const confirmPhoneOtp = async () => {
    setPhoneError('')
    setPhoneState(VERIFYING)
    try {
      const confirmation = confirmationRef.current
      if (!confirmation) {
        throw new Error('Request a new mobile code')
      }
      const credential = await confirmation.confirm(phoneCode)
      const firebaseIdToken = await credential.user.getIdToken()
      await authApi.verifyPhoneToken({
        session_id: sessionId,
        firebase_id_token: firebaseIdToken,
        mobile_number: phoneE164,
      })
      try {
        await signOut(getFirebaseAuth())
      } catch {
        /* temp Phone Auth session is discarded server-side */
      }
      setPhoneState(VERIFIED)
    } catch (err) {
      setPhoneState(ERROR)
      setPhoneError(
        err?.code === 'auth/invalid-verification-code'
          ? 'That code is not correct. Check the SMS and try again.'
          : err?.code === 'auth/code-expired'
            ? 'That code expired. Request a new one.'
            : firebasePhoneMessage(err),
      )
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
      const data = await authApi.registerComplete({
        session_id: sessionId,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        university_name: form.university_name.trim(),
        niat_id: form.niat_id.trim(),
        mobile_number: phoneE164,
        password: form.password,
        confirm_password: form.confirm_password,
      })
      if (data?.csrf_token) setCsrfToken(data.csrf_token)
      await refresh()
      navigate(ROLE_HOME.student, { replace: true })
    } catch (err) {
      setSubmitError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const disabledReason = !canSubmit
    ? emailState !== VERIFIED || phoneState !== VERIFIED
      ? 'Verify both email and mobile number to create your account.'
      : 'Fill every required field and match the password rules.'
    : ''

  return (
    <form className="stack-md" onSubmit={handleSubmit} noValidate>
      {submitError && <Alert variant="danger">{submitError}</Alert>}

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

      <OtpRow
        label="Email"
        state={emailState}
        code={emailCode}
        error={emailError}
        cooldown={emailCooldown}
        canStart={isEmail(form.email) && isE164(phoneE164)}
        onCodeChange={setEmailCode}
        sentTo={form.email.trim().toLowerCase()}
        onVerify={sendEmailOtp}
        onConfirm={confirmEmailOtp}
        onResend={sendEmailOtp}
        extra={
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            error={errors.email}
            disabled={emailState === VERIFIED}
            readOnly={emailState === VERIFIED}
          />
        }
      />

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

      <OtpRow
        label="Mobile"
        state={phoneState}
        code={phoneCode}
        error={phoneError}
        cooldown={phoneCooldown}
        canStart={isE164(phoneE164)}
        onCodeChange={setPhoneCode}
        sentTo={phoneE164}
        onVerify={sendPhoneOtp}
        onConfirm={confirmPhoneOtp}
        onResend={sendPhoneOtp}
        extra={
          <div className="field">
            <label className="label">
              Mobile number
              <span className="req">*</span>
            </label>
            <div className="flex gap-2">
              <select
                className="input w-[7.5rem] shrink-0"
                value={form.country_code}
                disabled={phoneState === VERIFIED}
                onChange={update('country_code')}
                aria-label="Country code"
              >
                {COUNTRY_CODES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                className={`input ${errors.mobile_national ? 'input--error' : ''}`}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="9876543210"
                value={form.mobile_national}
                disabled={phoneState === VERIFIED}
                readOnly={phoneState === VERIFIED}
                onChange={update('mobile_national')}
              />
            </div>
            {errors.mobile_national && (
              <span className="field__error">{errors.mobile_national}</span>
            )}
          </div>
        }
      />
      <div id="recaptcha-container" />

      <PasswordInput
        label="Password"
        required
        autoComplete="new-password"
        value={form.password}
        onChange={update('password')}
        error={errors.password}
        hint={
          form.password
            ? `Must include 8+ characters${strength.hasLetter ? '' : ', a letter'}${
                strength.hasNumber ? '' : ', a number'
              }`
            : 'At least 8 characters, with a letter and a number'
        }
      />
      <PasswordInput
        label="Confirm password"
        required
        autoComplete="new-password"
        value={form.confirm_password}
        onChange={update('confirm_password')}
        error={errors.confirm_password}
        hint={
          form.confirm_password && form.password === form.confirm_password
            ? 'Passwords match'
            : undefined
        }
      />

      <Button type="submit" variant="accent" block loading={loading} disabled={!canSubmit}>
        Create account
      </Button>
      {disabledReason && <p className="text-center text-sm text-muted">{disabledReason}</p>}
    </form>
  )
}
