import { RecaptchaVerifier } from 'firebase/auth'
import { getFirebaseAuth } from './firebase'

/** Element id both registration forms render for the invisible widget. */
export const RECAPTCHA_CONTAINER_ID = 'recaptcha-container'

/**
 * Turn a Firebase Auth error into something a user can act on.
 *
 * Phone Auth failures are nearly always configuration rather than user error,
 * and the raw strings ("Firebase: Error (auth/invalid-app-credential).") tell
 * the person filling in the form nothing.
 */
export function firebasePhoneMessage(err) {
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

/** Message for a code the user typed wrong, or one that aged out. */
export function firebaseCodeMessage(err) {
  if (err?.code === 'auth/invalid-verification-code') {
    return 'That code is not correct. Check the SMS and try again.'
  }
  if (err?.code === 'auth/code-expired') {
    return 'That code expired. Request a new one.'
  }
  return firebasePhoneMessage(err)
}

/**
 * Tear down an existing reCAPTCHA widget.
 *
 * `clear()` unregisters it with grecaptcha; dropping the reference alone leaves
 * the rendered widget in the container, and the next verifier built on the same
 * element then produces a token Firebase rejects.
 */
export function clearRecaptcha(verifier) {
  if (verifier) {
    try {
      verifier.clear()
    } catch {
      // Already torn down (e.g. the container unmounted) — nothing to undo.
    }
  }
  const host = document.getElementById(RECAPTCHA_CONTAINER_ID)
  if (host) host.innerHTML = ''
}

/**
 * Build a FRESH verifier for every send, replacing `previous`.
 *
 * An invisible reCAPTCHA token is single-use: signInWithPhoneNumber consumes
 * it, so reusing the same verifier for "Resend code" (or after a failed
 * attempt) fails with auth/invalid-app-credential.
 */
export async function createRecaptcha(previous) {
  const auth = getFirebaseAuth()
  clearRecaptcha(previous)
  const verifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, { size: 'invisible' })
  await verifier.render()
  return verifier
}
