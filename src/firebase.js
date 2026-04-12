import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// Paste your Firebase config here:
// Firebase console → Project Settings → Your apps → SDK setup and configuration
const firebaseConfig = {
  apiKey:            "AIzaSyB0ANMdlg4SbxylHySB4oQuRempieaAevw",
  authDomain:        "phobos-9246e.firebaseapp.com",
  projectId:         "phobos-9246e",
  storageBucket:     "phobos-9246e.firebasestorage.app",
  messagingSenderId: "670126055561",
  appId:             "1:670126055561:web:cf08c8618e251c177c2658",
}

const app = initializeApp(firebaseConfig)
export const db   = getFirestore(app)
export const auth = getAuth(app)
