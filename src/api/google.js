import { auth } from '../firebase'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

export function isGoogleConfigured() {
  return true // Firebase handles configuration internally — no manual Client ID needed
}

export function isGoogleConnected() {
  return auth.currentUser !== null
}

export function getGoogleEmail() {
  return auth.currentUser?.email || null
}

export function disconnectGoogle() {
  return signOut(auth)
}

/**
 * Initiates a Google sign-in popup.
 * Must be called from a user gesture (button click).
 */
export function connectGoogle({ onSuccess, onError }) {
  const provider = new GoogleAuthProvider()
  signInWithPopup(auth, provider)
    .then(result => onSuccess({ email: result.user.email }))
    .catch(err => {
      if (err.code !== 'auth/popup-closed-by-user') {
        onError(err.message)
      }
    })
}
