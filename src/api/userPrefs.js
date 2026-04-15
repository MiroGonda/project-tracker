import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export async function fetchUserPrefs(email) {
  if (!email) return {}
  const snap = await getDoc(doc(db, 'userPrefs', email))
  return snap.exists() ? snap.data() : {}
}

export async function saveUserPrefs(email, prefs) {
  if (!email) return
  await setDoc(doc(db, 'userPrefs', email), prefs, { merge: true })
}
