/**
 * Firebase Authentication Service (Google Sign-In Only)
 * Manages Google Sign-In authentication, automated profile synchronization,
 * referral code generation, and persistent 30-day session management.
 */

import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth'
import { firebaseAuth, googleProvider } from './firebase'
import { getOrCreateReferralProfile, recordUserLoginHistory, UserReferralProfile } from './referralService'

/**
 * Format auth errors into user-friendly messages
 */
export function formatAuthError(error: any): string {
  if (!error) return 'An unexpected error occurred during Google Sign-In.'

  const code = (error.code || error.message || '').toLowerCase()

  if (code.includes('auth/popup-closed-by-user')) {
    return 'Google Sign-In popup was closed. Please try again.'
  }
  if (code.includes('auth/popup-blocked')) {
    return 'Google Sign-In popup was blocked by your browser. Please allow popups for this site.'
  }
  if (code.includes('auth/cancelled-popup-request')) {
    return 'Authentication process was cancelled. Please try again.'
  }
  if (code.includes('auth/network-request-failed')) {
    return 'Network connection error. Please check your internet connection and try again.'
  }
  if (code.includes('auth/unauthorized-domain')) {
    return 'This domain is not authorized in Firebase Console. Please add it to Authorized Domains.'
  }

  return error.message || 'Failed to sign in with Google. Please try again.'
}

/**
 * Google Sign-In Authentication Flow
 * 1. Opens Google popup for account selection
 * 2. Authenticates with Firebase Auth
 * 3. Creates/fetches profile record in database (user_profiles)
 * 4. Generates unique referral code & link on first login
 * 5. Returns synchronized UserReferralProfile
 */
export async function signInWithGoogle(): Promise<UserReferralProfile> {
  try {
    const result = await signInWithPopup(firebaseAuth, googleProvider)
    const user: FirebaseUser = result.user

    if (!user || !user.email) {
      throw new Error('Google Sign-In failed to return a valid user email.')
    }

    const email = user.email.trim().toLowerCase()
    const name = user.displayName || email.split('@')[0]
    const photoUrl = user.photoURL || undefined
    const firebaseUid = user.uid

    // Record or fetch user referral profile from database
    const profile = await getOrCreateReferralProfile(firebaseUid, email, name, photoUrl)

    // Record login history
    await recordUserLoginHistory(profile.id, email)

    return profile
  } catch (err: any) {
    console.error('Google Sign-In Error:', err)
    throw new Error(formatAuthError(err))
  }
}

/**
 * Restore persistent Firebase user session on page load
 */
export async function getCurrentAuthUser(): Promise<UserReferralProfile | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user: FirebaseUser | null) => {
      unsubscribe()
      if (!user || !user.email) {
        resolve(null)
        return
      }

      try {
        const email = user.email.trim().toLowerCase()
        const name = user.displayName || email.split('@')[0]
        const photoUrl = user.photoURL || undefined
        const profile = await getOrCreateReferralProfile(user.uid, email, name, photoUrl)
        resolve(profile)
      } catch (err) {
        console.warn('Error fetching active Firebase session profile:', err)
        resolve(null)
      }
    })
  })
}

/**
 * Sign out from Firebase Authentication
 */
export async function signOutFirebase(): Promise<void> {
  try {
    await signOut(firebaseAuth)
  } catch (err) {
    console.warn('Firebase SignOut Error:', err)
  }
}

// Backward-compatible exports for referralService delegators
export async function signUpUser(fullName: string, email: string, password: string) {
  return signInWithGoogle()
}

export async function signInUser(email: string, password: string) {
  return signInWithGoogle()
}

export async function verifyEmailCode(email: string, token: string) {
  const current = await getCurrentAuthUser()
  if (current) return { profile: current }
  throw new Error('Session expired. Please sign in with Google again.')
}

export async function resendVerificationEmail(email: string) {
  return true
}

export async function signOutUser() {
  return signOutFirebase()
}

export async function getCurrentSession() {
  const profile = await getCurrentAuthUser()
  if (!profile) return null
  return { profile }
}

export function checkResendCooldown(email: string) {
  return { allowed: true, remainingSeconds: 0 }
}
