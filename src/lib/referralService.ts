import { supabase } from './supabase'
import {
  signUpUser,
  signInUser,
  verifyEmailCode,
  resendVerificationEmail,
} from './authService'

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

/**
 * Generate unique personal referral code (e.g. GF-LOVE-8921)
 */
export function generateUserReferralCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `GF-LOVE-${digits}`
}

/**
 * Generate complete referral link for sharing
 */
export function generateReferralLink(referralCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gift-surprise.com'
  return `${origin}/?ref=${referralCode}`
}

/**
 * Record user login history in Supabase user_login_history table
 */
export async function recordUserLoginHistory(userId: string, email: string) {
  const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Device'
  const browser = deviceInfo.includes('Chrome')
    ? 'Chrome'
    : deviceInfo.includes('Safari')
    ? 'Safari'
    : deviceInfo.includes('Firefox')
    ? 'Firefox'
    : 'Mobile Browser'

  try {
    // 1. Update last_login in user_profiles
    await supabase
      .from('user_profiles')
      .update({
        last_login: new Date().toISOString(),
        last_login_ip: '127.0.0.1',
      })
      .eq('email', email)

    // 2. Insert into user_login_history table
    await supabase.from('user_login_history').insert([
      {
        user_id: userId.includes('-') ? userId : undefined,
        email,
        ip_address: '127.0.0.1',
        device: 'Desktop/Mobile',
        browser,
      },
    ])
  } catch (err) {
    console.warn('Supabase user_login_history notice:', err)
  }
}

/**
 * Prevent Referral Abuse: Check if user is attempting to use their own referral code
 */
export function isSelfReferral(userEmail: string, referrerCode: string, userProfileCode?: string): boolean {
  if (!referrerCode || !userProfileCode) return false
  return referrerCode.trim().toUpperCase() === userProfileCode.trim().toUpperCase()
}

/**
 * Fetch or create referral profile in Supabase database with full synchronized statistics
 */
export async function getOrCreateReferralProfile(
  userId: string,
  email: string,
  displayName?: string,
  photoUrl?: string
): Promise<UserReferralProfile> {
  const defaultCode = generateUserReferralCode()
  const cleanEmail = email.trim().toLowerCase()
  const cleanName = displayName || cleanEmail.split('@')[0]

  try {
    // 1. Query user profile from database
    let { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', cleanEmail)
      .single()

    // 2. If profile doesn't exist, create it safely
    if (!profile) {
      const newProfile = {
        full_name: cleanName,
        email: cleanEmail,
        profile_image: photoUrl || null,
        account_status: 'ACTIVE',
        subscription_status: 'PREMIUM',
        referral_code: defaultCode,
        last_login: new Date().toISOString(),
        last_login_ip: '127.0.0.1',
      }

      const { data: inserted } = await supabase
        .from('user_profiles')
        .insert([newProfile])
        .select()
        .single()

      if (inserted) {
        profile = inserted
      }
    } else if (photoUrl && !profile.profile_image) {
      // Update profile picture if missing
      await supabase
        .from('user_profiles')
        .update({ profile_image: photoUrl, full_name: cleanName })
        .eq('id', profile.id)
    }

    if (profile) {
      const code = profile.referral_code || defaultCode

      // 3. Fetch referrals for statistics
      const { data: referralsData } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', profile.id)

      let totalReferrals = 0
      let successfulReferrals = 0
      let pendingReferrals = 0
      let totalEarnings = 0

      if (referralsData && referralsData.length > 0) {
        totalReferrals = referralsData.length
        referralsData.forEach((ref) => {
          if (ref.status === 'APPROVED' || ref.status === 'SUCCESS') {
            successfulReferrals += 1
            totalEarnings += Number(ref.commission_amount || 10)
          } else if (ref.status === 'PENDING') {
            pendingReferrals += 1
          }
        })
      }

      // 4. Fetch withdrawals for wallet calculation
      const { data: withdrawalsData } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      let totalWithdrawnOrPending = 0
      let pendingWithdrawal = 0
      const withdrawHistory: any[] = []

      if (withdrawalsData && withdrawalsData.length > 0) {
        withdrawalsData.forEach((w) => {
          const amt = Number(w.amount || 0)
          if (w.status === 'APPROVED' || w.status === 'PAID' || w.status === 'PENDING') {
            totalWithdrawnOrPending += amt
          }
          if (w.status === 'PENDING') {
            pendingWithdrawal += amt
          }

          withdrawHistory.push({
            id: w.id,
            requestId: w.request_id || `REQ-${w.id.slice(0, 6)}`,
            amount: amt,
            paymentMethod: w.payment_method || 'UPI',
            upiId: w.upi_id || 'N/A',
            status: w.status || 'PENDING',
            date: w.created_at ? new Date(w.created_at).toLocaleString() : new Date().toLocaleString(),
          })
        })
      }

      const walletBalance = Math.max(0, totalEarnings - totalWithdrawnOrPending)

      return {
        id: profile.id,
        firebaseUid: userId,
        name: profile.full_name || cleanName,
        email: profile.email || cleanEmail,
        photoUrl: profile.profile_image || photoUrl || undefined,
        phone: profile.phone || '',
        referralCode: code,
        referralLink: generateReferralLink(code),
        walletBalance,
        successfulReferrals,
        pendingReferrals,
        totalReferrals,
        totalEarnings,
        pendingWithdrawal,
        createdAt: profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Today',
        lastLogin: profile.last_login ? new Date(profile.last_login).toLocaleString() : 'Just now',
        referralHistory: referralsData || [],
        withdrawHistory,
      }
    }
  } catch (err) {
    console.warn('Supabase user_profiles table notice:', err)
  }

  // Fallback state if database connection fails
  const localProfile: UserReferralProfile = {
    id: userId,
    firebaseUid: userId,
    name: cleanName,
    email: cleanEmail,
    photoUrl: photoUrl || undefined,
    referralCode: defaultCode,
    referralLink: generateReferralLink(defaultCode),
    walletBalance: 0,
    successfulReferrals: 0,
    pendingReferrals: 0,
    totalReferrals: 0,
    totalEarnings: 0,
    pendingWithdrawal: 0,
    createdAt: new Date().toLocaleDateString(),
    lastLogin: new Date().toLocaleString(),
    referralHistory: [],
    withdrawHistory: [],
  }

  return localProfile
}
