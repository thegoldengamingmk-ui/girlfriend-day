import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth'

// Environment variable helper with user's exact production Firebase config fallbacks
const getEnvVar = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env?.[key]) {
      return import.meta.env[key] as string
    }
  } catch {}

  try {
    if (typeof process !== 'undefined' && process?.env?.[key]) {
      return process.env[key] as string
    }
  } catch {}

  return ''
}

const firebaseConfig = {
  apiKey:
    getEnvVar('VITE_FIREBASE_API_KEY') ||
    getEnvVar('NEXT_PUBLIC_FIREBASE_API_KEY') ||
    'AIzaSyD8ymsRNlKKG8on7dIrWvsMJ6B0ie3AJeI',
  authDomain:
    getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') ||
    getEnvVar('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN') ||
    'girlfriend-day.firebaseapp.com',
  projectId:
    getEnvVar('VITE_FIREBASE_PROJECT_ID') ||
    getEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID') ||
    'girlfriend-day',
  storageBucket:
    getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') ||
    getEnvVar('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET') ||
    'girlfriend-day.firebasestorage.app',
  messagingSenderId:
    getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') ||
    getEnvVar('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID') ||
    '887577165163',
  appId:
    getEnvVar('VITE_FIREBASE_APP_ID') ||
    getEnvVar('NEXT_PUBLIC_FIREBASE_APP_ID') ||
    '1:887577165163:web:3f685f7657965954a4202e',
  measurementId:
    getEnvVar('VITE_FIREBASE_MEASUREMENT_ID') ||
    getEnvVar('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID') ||
    'G-4NRR17QD12',
}

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

// Firebase Auth & Google Auth Provider
export const firebaseAuth = getAuth(app)
setPersistence(firebaseAuth, browserLocalPersistence).catch((err) => {
  console.warn('[Firebase Auth] Persistence configuration notice:', err)
})

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({
  prompt: 'select_account',
})
