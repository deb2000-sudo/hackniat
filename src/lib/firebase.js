import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app

export function getFirebaseAuth() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
      'Firebase web config is missing. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID.',
    )
  }
  if (!app) {
    app = initializeApp(firebaseConfig)
    if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_PHONE_TEST_MODE === 'true') {
      // Allows fictional test numbers without real SMS (Firebase Console → Phone → testing).
      getAuth(app).settings.appVerificationDisabledForTesting = true
    }
  }
  return getAuth(app)
}
