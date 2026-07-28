import { supabase } from './supabase'

export interface UserReferralProfile {
  id: string
  name?: string
  email: string
  phone?: string
  referralCode: string
  walletBalance: number
  successfulReferrals: number
  totalEarnings: number
  pendingWithdrawal: number
  referralHistory: any[]
}

/**
 * Generate unique personal referral code (e.g. GF-LOVE-8921)
 */
export function generateUserReferralCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `GF-LOVE-${digits}`
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
    : 'Mobile Browser'

  try {
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
 * Verify 6-digit OTP token
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

  if (data?.user) {
    await recordUserLoginHistory(data.user.id, email)
  }
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
 * Update user password after verifying OTP
 */
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  if (error) throw error
  return data
}

/**
 * Fetch or create referral profile in Supabase database / local state
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
      .eq('email', email)
      .single()

    if (!error && profile) {
      return {
        id: profile.id,
        name: profile.full_name || email.split('@')[0],
        email: profile.email || email,
        phone: profile.phone || '',
        referralCode: profile.referral_code || defaultCode,
        walletBalance: 0,
        successfulReferrals: 0,
        totalEarnings: 0,
        pendingWithdrawal: 0,
        referralHistory: [],
      }
    }

    const newProfile = {
      full_name: email.split('@')[0],
      email,
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
      await recordUserLoginHistory(inserted.id, email)
      return {
        id: inserted.id,
        name: inserted.full_name,
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
    console.warn('Supabase user_profiles table notice:', err)
  }

  // Local state fallback
  const localProfile: UserReferralProfile = {
    id: userId,
    name: email.split('@')[0],
    email,
    referralCode: defaultCode,
    walletBalance: 0,
    successfulReferrals: 0,
    totalEarnings: 0,
    pendingWithdrawal: 0,
    referralHistory: [],
  }

  try {
    const usersList = JSON.parse(localStorage.getItem('live_users_cache') || '[]')
    if (!usersList.some((u: any) => u.email === email)) {
      usersList.push(localProfile)
      localStorage.setItem('live_users_cache', JSON.stringify(usersList))
    }
  } catch {}

  return localProfile
}
