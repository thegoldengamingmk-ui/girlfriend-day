import { supabase } from './supabase'
import {
  signUpUser,
  signInUser,
  verifyEmailCode,
  resendVerificationEmail,
} from './authService'
import { syncFirebaseUserWithDatabase, buildReferralLink, generateUniqueReferralCode } from './userService'

export async function signUpUserWithEmail(email: string, password: string) {
  return signUpUser('', email, password)
}

export async function sendEmailOtp(email: string) {
  return resendVerificationEmail(email)
}

export async function verifyEmailOtpToken(email: string, token: string, type: any = 'signup') {
  return verifyEmailCode(email, token)
}

export async function signInUserWithPassword(email: string, password: string) {
  return signInUser(email, password)
}

export async function sendPasswordResetOtp(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim())
  if (error) throw error
  return data
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data
}

export interface UserReferralProfile {
  id: string
  firebaseUid?: string
  name: string
  email: string
  photoUrl?: string
  phone?: string
  referralCode: string
  referralLink: string
  walletBalance: number
  successfulReferrals: number
  pendingReferrals: number
  totalReferrals: number
  totalEarnings: number
  pendingWithdrawal: number
  createdAt: string
  lastLogin: string
  referralHistory: any[]
  withdrawHistory: any[]
}

export function generateUserReferralCode(): string {
  return generateUniqueReferralCode()
}

export function generateReferralLink(referralCode: string): string {
  return buildReferralLink(referralCode)
}

export async function recordUserLoginHistory(userId: string, email: string) {
  const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Device'
  const browser = deviceInfo.includes('Chrome')
    ? 'Chrome'
    : deviceInfo.includes('Safari')
    ? 'Safari'
    : deviceInfo.includes('Firefox')
    ? 'Firefox'
    : 'Mobile Browser'

  const nowIso = new Date().toISOString()

  try {
    await supabase
      .from('user_profiles')
      .update({
        last_login: nowIso,
        last_login_ip: '127.0.0.1',
      })
      .eq('email', email.trim().toLowerCase())

    await supabase.from('user_login_history').insert([
      {
        user_id: userId.includes('-') ? userId : undefined,
        email: email.trim().toLowerCase(),
        ip_address: '127.0.0.1',
        device: 'Desktop/Mobile',
        browser,
      },
    ])
  } catch (err) {
    console.warn('Supabase user_login_history notice:', err)
  }
}

export function isSelfReferral(userEmail: string, referrerCode: string, userProfileCode?: string): boolean {
  if (!referrerCode || !userProfileCode) return false
  return referrerCode.trim().toUpperCase() === userProfileCode.trim().toUpperCase()
}

/**
 * Delegate to single source of truth userService
 */
export async function getOrCreateReferralProfile(
  firebaseUid: string,
  email: string,
  displayName?: string,
  photoUrl?: string
): Promise<UserReferralProfile> {
  const canonical = await syncFirebaseUserWithDatabase({
    uid: firebaseUid,
    email,
    displayName,
    photoURL: photoUrl,
  })

  return {
    id: canonical.id,
    firebaseUid: canonical.firebaseUid,
    name: canonical.displayName,
    email: canonical.email,
    photoUrl: canonical.profilePhoto,
    phone: '',
    referralCode: canonical.referralCode,
    referralLink: canonical.referralLink,
    walletBalance: canonical.wallet.availableBalance,
    successfulReferrals: canonical.referralStats.successfulReferrals,
    pendingReferrals: canonical.referralStats.pendingReferrals,
    totalReferrals: canonical.referralStats.totalReferrals,
    totalEarnings: canonical.wallet.totalEarned,
    pendingWithdrawal: canonical.wallet.pendingBalance,
    createdAt: canonical.createdAt,
    lastLogin: canonical.lastLogin,
    referralHistory: [],
    withdrawHistory: canonical.withdrawals,
  }
}
