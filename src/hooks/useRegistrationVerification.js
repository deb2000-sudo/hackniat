import { useEffect, useRef, useState } from 'react'
import { signInWithPhoneNumber, signOut } from 'firebase/auth'
import { authApi, registerStartPayload } from '../api/auth'
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
 * Email + mobile verification, shared by registration and password reset.
 *
 * Both OTP channels verify independently against one session, using the same
 * three endpoints (email/send-otp, email/verify-otp, verify-phone-token).
 * Student and evaluator registration differ only in the role they bind and the
 * fields they submit afterwards, so everything up to "both channels are green"
 * lives here.
 *
 * Two ways the session gets there:
 *
 * - Registration opens it here. /auth/register/start requires AT LEAST ONE of
 *   email or mobile_number, and must never carry an identifier the user has
 *   not entered, so each channel binds only its own field and merges into the
 *   existing session by id; the backend keeps what the other call bound.
 * - Password reset opens it before this hook is mounted, because
 *   /auth/forgot-password/start binds both identifiers at once against an
 *   existing account. Pass that id as `sessionId` and the hook verifies
 *   against it without ever calling register/start — which would be rejected
 *   with PURPOSE_MISMATCH anyway, reset sessions being a different purpose.
 *
 * @param {object}   options
 * @param {string}   [options.sessionId]             Session opened by the caller; when set the hook never opens one.
 * @param {string}   [options.role]                  Role bound on the session (omitted for students).
 * @param {string}   options.email                   Raw email field value.
 * @param {string}   options.countryCode             Dialling code, e.g. '+91'.
 * @param {string}   options.mobileNational          National-format mobile digits.
 * @param {Function} [options.onFieldError]          (field, message) => void for field-level failures.
 * @param {Function} [options.isEmailValid]          Overrides the accepted email shape.
 * @param {string}   [options.invalidEmailMessage]   Shown when `isEmailValid` rejects the value.
 */
export function useRegistrationVerification({
  sessionId: externalSessionId = '',
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

  /** The id to post right now — the ref leads state during an async handoff. */
  const getSessionId = () => externalSessionId || sessionIdRef.current || sessionId

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

  /**
   * The session no longer agrees about this identifier (EMAIL/PHONE_MISMATCH).
   * Forgetting what we bound makes the next send re-bind before it sends,
   * rather than posting a code against a session that will reject it again.
   */
  const restartEmailVerification = () => {
    setSessionEmail('')
    setEmailCooldown(0)
    resetEmailVerification()
  }

  const restartPhoneVerification = () => {
    setSessionPhone('')
    confirmationRef.current = null
    setPhoneCooldown(0)
    resetPhoneVerification()
  }

  /**
   * Merge ONE identifier into the session. Passing only the field being
   * verified is deliberate: register/start rejects a call carrying neither,
   * and sending a value the user has not entered yet binds a placeholder.
   */
  const bindSession = async ({ email: nextEmail, mobile }) => {
    const payload = registerStartPayload({
      role,
      // Read through the ref: two channels verified in quick succession would
      // otherwise both post without a session_id and open two sessions.
      sessionId: getSessionId(),
      email: nextEmail,
      mobile,
    })
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
    // The caller's session already carries both identifiers; re-binding is
    // neither needed nor allowed.
    if (externalSessionId) return externalSessionId
    if (sessionId && sessionEmail === email) {
      return sessionId
    }
    if (sessionId && sessionEmail && sessionEmail !== email) {
      setEmailState(IDLE)
      setEmailCode('')
    }
    return bindSession({ email })
  }

  const ensurePhoneSession = async () => {
    if (!phoneReady) {
      fieldErrorRef.current?.('mobile_national', 'Enter a valid mobile number')
      throw new Error('Enter a valid mobile number to receive an SMS code.')
    }
    if (externalSessionId) return externalSessionId
    if (sessionId && sessionPhone === phoneE164) {
      return sessionId
    }
    if (sessionId && sessionPhone && sessionPhone !== phoneE164) {
      setPhoneState(IDLE)
      setPhoneCode('')
    }
    return bindSession({ mobile: phoneE164 })
  }

  /** Re-bind both identifiers before the final submit; returns the live id. */
  const ensureFullSession = async () => {
    if (!emailReady || !phoneReady) {
      throw new Error('Enter a valid email and mobile number before creating your account.')
    }
    if (externalSessionId) return externalSessionId
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
      if (code === AUTH_ERROR.EMAIL_MISMATCH) {
        restartEmailVerification()
        fieldErrorRef.current?.('email', authErrorMessage(err))
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
      await authApi.verifyEmailOtp({ session_id: getSessionId(), code: emailCode })
      setEmailState(VERIFIED)
    } catch (err) {
      const code = authErrorCode(err)
      if (code === AUTH_ERROR.EMAIL_MISMATCH) {
        restartEmailVerification()
        fieldErrorRef.current?.('email', authErrorMessage(err))
        return
      }
      if (code === AUTH_ERROR.TOO_MANY_ATTEMPTS) {
        // This code is spent; clear it and open the resend immediately.
        setEmailCode('')
        setEmailCooldown(0)
        setEmailState(ERROR)
        setEmailError(authErrorMessage(err))
        return
      }
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
      if (code === AUTH_ERROR.PHONE_MISMATCH) {
        restartPhoneVerification()
        fieldErrorRef.current?.('mobile_national', authErrorMessage(err))
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
        session_id: getSessionId(),
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
      if (code === AUTH_ERROR.PHONE_MISMATCH) {
        restartPhoneVerification()
        fieldErrorRef.current?.('mobile_national', authErrorMessage(err))
        return
      }
      if (code === AUTH_ERROR.TOO_MANY_ATTEMPTS) {
        setPhoneCode('')
        setPhoneCooldown(0)
        confirmationRef.current = null
        setPhoneState(ERROR)
        setPhoneError(authErrorMessage(err))
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
    getSessionId,

    emailState,
    emailError,
    emailCode,
    emailCooldown,
    setEmailCode,
    sendEmailOtp,
    confirmEmailOtp,
    resetEmailVerification,
    restartEmailVerification,

    phoneState,
    phoneError,
    phoneCode,
    phoneCooldown,
    setPhoneCode,
    sendPhoneOtp,
    confirmPhoneOtp,
    resetPhoneVerification,
    restartPhoneVerification,

    ensureFullSession,
  }
}
