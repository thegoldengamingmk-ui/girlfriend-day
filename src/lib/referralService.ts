import { supabase } from './supabase'

export interface UserReferralProfile {
  id: string
  email: string
  referralCode: string
  walletBalance: number
  successfulReferrals: number
  totalEarnings: number
  pendingWithdrawal: number
  referralHistory: any[]
}

/**
 * Generate a unique personal referral code (e.g. GF-LOVE-8921)
 */
export function generateUserReferralCode(length = 4): string {
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `GF-LOVE-${digits}`
}

/**
 * Sign up a new user with email and password in Supabase Auth
 */
export async function signUpUserWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  if (error) throw error
  return data
}

/**
 * Send Email OTP verification code
 */
export async function sendEmailOtp(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  })
  if (error) throw error
  return data
}

/**
 * Verify 6-digit OTP token for signup or login
 */
export async function verifyEmailOtpToken(
  email: string,
  token: string,
  type: 'signup' | 'email' | 'recovery' | 'magiclink' = 'signup'
) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type,
  })

  // Fallback for signup/email OTP types
  if (error) {
    const fallback = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })
    if (fallback.error) throw error
    return fallback.data
  }

  return data
}

/**
 * Sign in existing user with email & password
 */
export async function signInUserWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

/**
 * Trigger password reset OTP email
 */
export async function sendPasswordResetOtp(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) throw error
  return data
}

/**
 * Update user password after verifying password reset OTP
 */
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  if (error) throw error
  return data
}

/**
 * Fetch or create referral profile in Supabase database / local storage
 */
export async function getOrCreateReferralProfile(
  userId: string,
  email: string
): Promise<UserReferralProfile> {
  const defaultCode = generateUserReferralCode()

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && profile) {
      return {
        id: profile.id,
        email: profile.email || email,
        referralCode: profile.referral_code || defaultCode,
        walletBalance: profile.wallet_balance || 0,
        successfulReferrals: profile.successful_referrals || 0,
        totalEarnings: profile.total_earnings || 0,
        pendingWithdrawal: profile.pending_withdrawal || 0,
        referralHistory: profile.referral_history || [],
      }
    }

    // Try inserting into Supabase DB table if available
    const newProfile = {
      id: userId,
      email,
      referral_code: defaultCode,
      wallet_balance: 0,
      successful_referrals: 0,
      total_earnings: 0,
      pending_withdrawal: 0,
    }

    const { data: inserted } = await supabase
      .from('user_profiles')
      .insert([newProfile])
      .select()
      .single()

    if (inserted) {
      return {
        id: inserted.id,
        email: inserted.email,
        referralCode: inserted.referral_code,
        walletBalance: 0,
        successfulReferrals: 0,
        totalEarnings: 0,
        pendingWithdrawal: 0,
        referralHistory: [],
      }
    }
  } catch (err) {
    console.warn('Supabase DB table fallback to local state:', err)
  }

  return {
    id: userId,
    email,
    referralCode: defaultCode,
    walletBalance: 0,
    successfulReferrals: 0,
    totalEarnings: 0,
    pendingWithdrawal: 0,
    referralHistory: [],
  }
}
