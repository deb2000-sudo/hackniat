import { useEffect, useRef, useState } from 'react'
import { signInWithPhoneNumber, signOut } from 'firebase/auth'
import { authApi } from '../api/auth'
import {
  AUTH_ERROR,
  authErrorCode,
  authErrorMessage,
  resendCooldownSeconds,
} from '../api/authErrors'
import { getFirebaseAuth } from '../lib/firebase'
import {
  clearRecaptcha,
  createRecaptcha,
  firebaseCodeMessage,
  firebasePhoneMessage,
} from '../lib/firebasePhone'
import { isE164, isEmail, toE164 } from '../utils/validators'

/** Per-channel verification states. */
export const VERIFY = {
  IDLE: 'idle',
  SENDING: 'sending',
  AWAITING: 'awaiting_code',
  VERIFYING: 'verifying',
  VERIFIED: 'verified',
  ERROR: 'error',
}

const { IDLE, SENDING, AWAITING, VERIFYING, VERIFIED, ERROR } = VERIFY

const RESEND_WINDOW = 60

/**
 * Email + mobile verification for the registration flows.
 *
 * Owns the registration session (POST /auth/register/start) and both OTP
 * channels, which verify independently. Student and evaluator registration
 * differ only in the role they bind and the fields they submit afterwards, so
 * everything up to "both channels are green" lives here.
 *
 * @param {object}   options
 * @param {string}   [options.role]                  Role bound on the session (omitted for students).
 * @param {string}   options.email                   Raw email field value.
 * @param {string}   options.countryCode             Dialling code, e.g. '+91'.
 * @param {string}   options.mobileNational          National-format mobile digits.
 * @param {Function} [options.onFieldError]          (field, message) => void for field-level failures.
 * @param {Function} [options.isEmailValid]          Overrides the accepted email shape.
 * @param {string}   [options.invalidEmailMessage]   Shown when `isEmailValid` rejects the value.
 */
export function useRegistrationVerification({
  role,
  email: rawEmail,
  countryCode,
  mobileNational,
  onFieldError,
  isEmailValid = isEmail,
  invalidEmailMessage = 'Enter a valid email',
}) {
  const [sessionId, setSessionId] = useState('')
  // Mirrors sessionId for the async send → confirm handoff. The confirm step
  // runs in a later tick than the send that bound the session, so reading
  // state there risks posting a stale (or empty) session_id.
  const sessionIdRef = useRef('')
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

  // Held in a ref so callers need not memoise the callback.
  const fieldErrorRef = useRef(onFieldError)
  useEffect(() => {
    fieldErrorRef.current = onFieldError
  })

  const email = String(rawEmail || '').trim().toLowerCase()
  const phoneE164 = toE164(countryCode, mobileNational)
  const emailReady = isEmailValid(email)
  const phoneReady = isE164(phoneE164)
  const bothVerified = emailState === VERIFIED && phoneState === VERIFIED

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

  // Drop the widget when the form unmounts so a remount starts clean.
  useEffect(
    () => () => {
      clearRecaptcha(recaptchaRef.current)
      recaptchaRef.current = null
    },
    [],
  )

  const resetEmailVerification = () => {
    setEmailState(IDLE)
    setEmailCode('')
    setEmailError('')
  }

  const resetPhoneVerification = () => {
    setPhoneState(IDLE)
    setPhoneCode('')
    setPhoneError('')
  }

  const bindSession = async ({ email: nextEmail, mobile }) => {
    const payload = {}
    if (role) payload.role = role
    if (sessionId) payload.session_id = sessionId
    if (nextEmail) payload.email = nextEmail
    if (mobile) payload.mobile_number = mobile
    const { session_id: nextId } = await authApi.registerStart(payload)
    sessionIdRef.current = nextId
    setSessionId(nextId)
    if (nextEmail) setSessionEmail(nextEmail)
    if (mobile) setSessionPhone(mobile)
    return nextId
  }

  const ensureEmailSession = async () => {
    if (!emailReady) {
      fieldErrorRef.current?.('email', invalidEmailMessage)
      throw new Error(`${invalidEmailMessage} to receive a verification code.`)
    }
    if (sessionId && sessionEmail === email) {
      return sessionId
    }
    if (sessionId && sessionEmail && sessionEmail !== email) {
      setEmailState(IDLE)
      setEmailCode('')
    }
    const mobile = phoneReady ? phoneE164 : undefined
    return bindSession({ email, mobile })
  }

  const ensurePhoneSession = async () => {
    if (!phoneReady) {
      fieldErrorRef.current?.('mobile_national', 'Enter a valid mobile number')
      throw new Error('Enter a valid mobile number to receive an SMS code.')
    }
    if (sessionId && sessionPhone === phoneE164) {
      return sessionId
    }
    if (sessionId && sessionPhone && sessionPhone !== phoneE164) {
      setPhoneState(IDLE)
      setPhoneCode('')
    }
    return bindSession({ email: emailReady ? email : undefined, mobile: phoneE164 })
  }

  /** Re-bind both identifiers before the final submit; returns the live id. */
  const ensureFullSession = async () => {
    if (!emailReady || !phoneReady) {
      throw new Error('Enter a valid email and mobile number before creating your account.')
    }
    return bindSession({ email, mobile: phoneE164 })
  }

  const sendEmailOtp = async () => {
    setEmailError('')
    setEmailState(SENDING)
    try {
      const id = await ensureEmailSession()
      await authApi.sendEmailOtp({ session_id: id, email })
      setEmailState(AWAITING)
      setEmailCooldown(RESEND_WINDOW)
    } catch (err) {
      const code = authErrorCode(err)
      if (code === AUTH_ERROR.RESEND_COOLDOWN) {
        // A code is already in flight — keep the entry box open and count the
        // window down rather than pushing the row into an error state.
        setEmailCooldown(resendCooldownSeconds(err, RESEND_WINDOW))
        setEmailState(AWAITING)
        return
      }
      if (code === AUTH_ERROR.EMAIL_TAKEN) {
        fieldErrorRef.current?.('email', authErrorMessage(err))
        setEmailState(IDLE)
        return
      }
      setEmailState(ERROR)
      setEmailError(authErrorMessage(err, 'Could not send email code'))
    }
  }

  const confirmEmailOtp = async () => {
    setEmailError('')
    setEmailState(VERIFYING)
    try {
      await authApi.verifyEmailOtp({ session_id: sessionIdRef.current || sessionId, code: emailCode })
      setEmailState(VERIFIED)
    } catch (err) {
      setEmailState(ERROR)
      setEmailError(authErrorMessage(err, 'Invalid code'))
    }
  }

  const sendPhoneOtp = async () => {
    setPhoneError('')
    setPhoneState(SENDING)
    try {
      await ensurePhoneSession()
      const auth = getFirebaseAuth()
      const verifier = await createRecaptcha(recaptchaRef.current)
      recaptchaRef.current = verifier
      confirmationRef.current = await signInWithPhoneNumber(auth, phoneE164, verifier)
      setPhoneState(AWAITING)
      setPhoneCooldown(RESEND_WINDOW)
    } catch (err) {
      clearRecaptcha(recaptchaRef.current)
      recaptchaRef.current = null
      const code = authErrorCode(err)
      if (code === AUTH_ERROR.RESEND_COOLDOWN) {
        setPhoneCooldown(resendCooldownSeconds(err, RESEND_WINDOW))
        // A live confirmation means an SMS really is outstanding, so keep the
        // code box open. Without one, nothing was sent — say so beside the timer.
        if (confirmationRef.current) {
          setPhoneState(AWAITING)
        } else {
          setPhoneState(ERROR)
          setPhoneError(authErrorMessage(err))
        }
        return
      }
      if (code === AUTH_ERROR.PHONE_TAKEN) {
        fieldErrorRef.current?.('mobile_national', authErrorMessage(err))
        setPhoneState(IDLE)
        return
      }
      setPhoneState(ERROR)
      // Backend failures carry a code; anything else came from Firebase.
      setPhoneError(code ? authErrorMessage(err) : firebasePhoneMessage(err))
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
        session_id: sessionIdRef.current || sessionId,
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
      const code = authErrorCode(err)
      if (code === AUTH_ERROR.PHONE_TAKEN) {
        fieldErrorRef.current?.('mobile_national', authErrorMessage(err))
        setPhoneState(IDLE)
        return
      }
      setPhoneState(ERROR)
      setPhoneError(code ? authErrorMessage(err) : firebaseCodeMessage(err))
    }
  }

  return {
    email,
    phoneE164,
    emailReady,
    phoneReady,
    bothVerified,

    emailState,
    emailError,
    emailCode,
    emailCooldown,
    setEmailCode,
    sendEmailOtp,
    confirmEmailOtp,
    resetEmailVerification,

    phoneState,
    phoneError,
    phoneCode,
    phoneCooldown,
    setPhoneCode,
    sendPhoneOtp,
    confirmPhoneOtp,
    resetPhoneVerification,

    ensureFullSession,
  }
}
