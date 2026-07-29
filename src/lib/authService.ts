/**
 * Centralized Supabase Authentication Service
 * Implements signup, email verification, password login, rate-limiting, and 30-day session handling.
 */

import { supabase } from './supabase'
import { recordUserLoginHistory, getOrCreateReferralProfile } from './referralService'

// Cooldown & Abuse Protection Constants
const RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds cooldown between resends
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000 // 5 minutes lockout

export interface AuthStateUser {
  id: string
  email: string
  fullName?: string
  isEmailVerified: boolean
  referralCode?: string
  createdAt?: string
}

/**
 * Format raw error messages into clean, user-friendly natural language.
 */
export function formatAuthError(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.'

  const message = (typeof error === 'string' ? error : error.message || '').toLowerCase()

  if (message.includes('invalid login credentials') || message.includes('invalid_credentials')) {
    return 'Incorrect email or password. Please check your credentials and try again.'
  }
  if (message.includes('user not found') || message.includes('email not found')) {
    return 'Account not found. Please check your email address or create a new account.'
  }
  if (message.includes('email not confirmed') || message.includes('unverified')) {
    return 'Please verify your email before logging in.'
  }
  if (message.includes('user already registered') || message.includes('already exists')) {
    return 'An account with this email address already exists. Please log in instead.'
  }
  if (message.includes('password should be at least') || message.includes('weak password')) {
    return 'Password must be at least 6 characters long.'
  }
  if (message.includes('rate limit') || message.includes('too many requests') || message.includes('over_email_send_rate_limit')) {
    return 'Too many attempts. Please wait a few minutes before requesting another email.'
  }
  if (message.includes('invalid token') || message.includes('token expired') || message.includes('otp_expired')) {
    return 'Invalid or expired verification code. Please request a new code.'
  }
  if (message.includes('network') || message.includes('failed to fetch')) {
    return 'Network error. Please check your internet connection.'
  }

  return error.message || 'An error occurred during authentication. Please try again.'
}

/**
 * Check and enforce resend email cooldown
 */
export function checkResendCooldown(email: string): { allowed: boolean; remainingSeconds: number } {
  const key = `resend_ts_${email.trim().toLowerCase()}`
  const lastSent = localStorage.getItem(key)

  if (!lastSent) {
    return { allowed: true, remainingSeconds: 0 }
  }

  const elapsed = Date.now() - parseInt(lastSent, 10)
  if (elapsed >= RESEND_COOLDOWN_MS) {
    return { allowed: true, remainingSeconds: 0 }
  }

  const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
  return { allowed: false, remainingSeconds }
}

export function recordResendTimestamp(email: string): void {
  const key = `resend_ts_${email.trim().toLowerCase()}`
  localStorage.setItem(key, Date.now().toString())
}

/**
 * Check login rate limiting / abuse protection
 */
export function checkLoginAttempts(email: string): { allowed: boolean; waitMinutes: number } {
  const key = `login_attempts_${email.trim().toLowerCase()}`
  const dataStr = localStorage.getItem(key)

  if (!dataStr) return { allowed: true, waitMinutes: 0 }

  try {
    const data = JSON.parse(dataStr)
    if (data.lockoutUntil && Date.now() < data.lockoutUntil) {
      const waitMinutes = Math.ceil((data.lockoutUntil - Date.now()) / (60 * 1000))
      return { allowed: false, waitMinutes }
    }
  } catch {}

  return { allowed: true, waitMinutes: 0 }
}

export function recordFailedLoginAttempt(email: string): void {
  const key = `login_attempts_${email.trim().toLowerCase()}`
  const dataStr = localStorage.getItem(key)
  let attempts = 1
  let lockoutUntil = 0

  if (dataStr) {
    try {
      const data = JSON.parse(dataStr)
      attempts = (data.attempts || 0) + 1
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        lockoutUntil = Date.now() + LOGIN_LOCKOUT_MS
      }
    } catch {}
  }

  localStorage.setItem(key, JSON.stringify({ attempts, lockoutUntil }))
}

export function clearLoginAttempts(email: string): void {
  const key = `login_attempts_${email.trim().toLowerCase()}`
  localStorage.removeItem(key)
}

/**
 * Signup Flow:
 * Creates account, triggers verification OTP, and returns verification pending state.
 */
export async function signUpUser(fullName: string, email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase()
  const cleanName = fullName.trim()

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        full_name: cleanName,
      },
    },
  })

  if (error) throw new Error(formatAuthError(error))

  // Mark resend timestamp
  recordResendTimestamp(cleanEmail)

  return {
    user: data.user,
    session: data.session,
    needsVerification: !data.user?.email_confirmed_at,
  }
}

/**
 * Send / Resend Email OTP or Signup Verification Email
 */
export async function resendVerificationEmail(email: string) {
  const cleanEmail = email.trim().toLowerCase()

  const cooldown = checkResendCooldown(cleanEmail)
  if (!cooldown.allowed) {
    throw new Error(`Please wait ${cooldown.remainingSeconds} seconds before requesting another email.`)
  }

  // 1. Try sending OTP first
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      shouldCreateUser: false,
    },
  })

  if (otpError) {
    // 2. Fall back to resend signup type
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
    })

    if (resendError) {
      throw new Error(formatAuthError(resendError))
    }
  }

  recordResendTimestamp(cleanEmail)
  return true
}

/**
 * Verify Email OTP code
 */
export async function verifyEmailCode(email: string, token: string) {
  const cleanEmail = email.trim().toLowerCase()
  const cleanToken = token.trim()

  let result = null

  // Try signup type first, then fallback to email type
  const { data: signupData, error: signupError } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: 'signup',
  })

  if (!signupError && signupData?.user) {
    result = signupData
  } else {
    const { data: emailData, error: emailError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    })

    if (emailError) {
      throw new Error(formatAuthError(emailError || signupError))
    }

    result = emailData
  }

  if (result?.user) {
    // Create / fetch user profile record upon successful verification
    const profile = await getOrCreateReferralProfile(result.user.id, cleanEmail)
    return {
      user: result.user,
      session: result.session,
      profile,
    }
  }

  throw new Error('Verification failed. Please check the code and try again.')
}

/**
 * Login Flow:
 * Fast login with email & password. Requires email to be confirmed.
 */
export async function signInUser(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase()

  const lockout = checkLoginAttempts(cleanEmail)
  if (!lockout.allowed) {
    throw new Error(`Too many failed attempts. Please wait ${lockout.waitMinutes} minutes before trying again.`)
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  })

  if (error) {
    recordFailedLoginAttempt(cleanEmail)
    throw new Error(formatAuthError(error))
  }

  clearLoginAttempts(cleanEmail)

  if (data?.user) {
    // Check if email is verified
    const isVerified = Boolean(data.user.email_confirmed_at || data.user.user_metadata?.email_verified)
    if (!isVerified) {
      // Sign out temporary unverified session
      await supabase.auth.signOut()
      throw new Error('UNVERIFIED_EMAIL')
    }

    // Record login history
    await recordUserLoginHistory(data.user.id, cleanEmail)

    // Ensure referral profile exists
    const profile = await getOrCreateReferralProfile(data.user.id, cleanEmail)

    return {
      user: data.user,
      session: data.session,
      profile,
    }
  }

  throw new Error('Login failed. Please try again.')
}

/**
 * Get active Supabase session (30 day persistence)
 */
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return null

  const user = data.session.user
  if (!user) return null

  const isVerified = Boolean(user.email_confirmed_at || user.user_metadata?.email_verified)
  if (!isVerified) return null

  const profile = await getOrCreateReferralProfile(user.id, user.email || '')

  return {
    session: data.session,
    user,
    profile,
  }
}

/**
 * User Logout
 */
export async function signOutUser() {
  await supabase.auth.signOut()
}
