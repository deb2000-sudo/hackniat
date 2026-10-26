import { useEffect, useRef, useState } from 'react'
import { authApi } from '../../api/auth'
import { AUTH_ERROR, authErrorCode, authErrorMessage } from '../../api/authErrors'
import { useAuth } from '../../hooks/useAuth'
import { VERIFY, useRegistrationVerification } from '../../hooks/useRegistrationVerification'
import { RECAPTCHA_CONTAINER_ID } from '../../lib/firebasePhone'
import { formatMobile } from '../../utils/format'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { LoadingBlock } from '../ui/Spinner'
import OtpRow from './OtpRow'

/** Codes meaning there is nothing left to verify: re-read the account and close. */
const NOTHING_TO_DO = [AUTH_ERROR.ALREADY_VERIFIED, AUTH_ERROR.VERIFICATION_NOT_REQUIRED]

/** The OTP steps for one verification session (the account's own email / mobile). */
function VerificationSteps({ session, onSignOut }) {
  const { setUser, refresh } = useAuth()
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const triedRef = useRef(false)

  const emailRequired = session.email_required === true
  const phoneRequired = session.mobile_required === true

  const verification = useRegistrationVerification({
    // The session already carries both identifiers: verify against it, never
    // re-bind. Neither value is editable here.
    sessionId: session.session_id,
    email: session.email || '',
    phoneNumber: session.mobile_number || '',
    emailRequired,
    phoneRequired,
    onFieldError: (_field, message) => setFieldError(message),
  })

  const complete = async () => {
    setCompleting(true)
    setCompleteError('')
    const profile = await authApi.verificationComplete(session.session_id).catch((err) => {
      const code = authErrorCode(err)
      if (NOTHING_TO_DO.includes(code)) {
        refresh()
        return null
      }
      setCompleteError(
        code === AUTH_ERROR.NOT_VERIFIED
          ? 'Finish the verification above first.'
          : authErrorMessage(err, 'Could not finish verification. Try again.'),
      )
      return null
    })
    setCompleting(false)
    // The profile replaces the signed-in user; the gate closes once both
    // verification_due flags are false.
    if (profile) setUser((current) => (current ? { ...current, ...profile } : profile))
  }

  // Finish on its own as soon as every required channel is green (once).
  const ready = verification.bothVerified
  useEffect(() => {
    if (!ready || triedRef.current) return undefined
    triedRef.current = true
    const timer = setTimeout(complete, 0)
    return () => clearTimeout(timer)
    // complete reads the latest session through closure; only `ready` matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return (
    <div className="stack-md">
      {fieldError && <Alert variant="danger">{fieldError}</Alert>}
      {completeError && <Alert variant="danger">{completeError}</Alert>}

      {emailRequired && (
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
          extra={<Input label="Email" type="email" value={session.email || ''} readOnly disabled />}
        />
      )}

      {phoneRequired && (
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
            <Input
              label="Mobile number"
              value={formatMobile(session.mobile_number || '')}
              readOnly
              disabled
            />
          }
        />
      )}
      <div id={RECAPTCHA_CONTAINER_ID} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <button type="button" className="link-btn text-sm" onClick={onSignOut}>
          Sign out
        </button>
        <Button
          variant="accent"
          loading={completing}
          disabled={!ready || completing}
          onClick={complete}
        >
          {ready ? 'Continue' : 'Verify to continue'}
        </Button>
      </div>

      {(verification.emailState === VERIFY.VERIFIED || verification.phoneState === VERIFY.VERIFIED) &&
        !ready && (
          <p className="text-center text-[12.5px] text-muted">One more to go.</p>
        )}
    </div>
  )
}

/**
 * The blocking verification popup. Opens a session for the account's own email
 * and mobile (POST /auth/verification/start), shows a Verify step only for the
 * channels that are required, and finishes with /auth/verification/complete.
 * It cannot be dismissed — only signing out leaves it.
 */
export default function VerificationDialog() {
  const { refresh, logout } = useAuth()
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  // Keep the page behind still while the popup is up.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    let active = true
    authApi
      .verificationStart()
      .then((payload) => {
        if (active) setSession(payload)
      })
      .catch((err) => {
        if (!active) return
        if (NOTHING_TO_DO.includes(authErrorCode(err))) {
          refresh()
          return
        }
        setError(authErrorMessage(err, 'Could not start verification.'))
      })
    return () => {
      active = false
    }
  }, [attempt, refresh])

  return (
    <div
      className="drop fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verification-title"
    >
      <div className="w-full max-w-lg rounded-drop border border-hairline bg-surface shadow-2xl">
        <div className="border-b border-hairline px-6 py-5">
          <h2 id="verification-title" className="text-[18px] font-semibold text-ink">
            Verify your account
          </h2>
          <p className="mt-1 text-[13.5px] text-muted">
            Confirm the contact details on your account to keep using Challazo. This takes a minute.
          </p>
        </div>
        <div className="px-6 py-5">
          {error ? (
            <div className="stack-md">
              <Alert variant="danger">{error}</Alert>
              <div className="flex items-center justify-between gap-3">
                <button type="button" className="link-btn text-sm" onClick={logout}>
                  Sign out
                </button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError('')
                    setAttempt((value) => value + 1)
                  }}
                >
                  Try again
                </Button>
              </div>
            </div>
          ) : !session ? (
            <LoadingBlock label="Preparing verification…" />
          ) : (
            <VerificationSteps session={session} onSignOut={logout} />
          )}
        </div>
      </div>
    </div>
  )
}
