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

  console.log('[Auth Sync] Firebase Authentication Success:', cleanEmail)
  console.log('[Auth Sync] Checking Database User:', cleanEmail)

  let profileRecord: any = null

  try {
    // 1. Query user profiles from Supabase database
    const { data: existingList, error: fetchErr } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', cleanEmail)

    if (!fetchErr && existingList && existingList.length > 0) {
      profileRecord = existingList[0]
      console.log('[Auth Sync] Database User Found:', profileRecord.id)

      // Update name and avatar if changed
      if (photoUrl || cleanName) {
        await supabase
          .from('user_profiles')
          .update({
            full_name: cleanName,
            profile_image: photoUrl || profileRecord.profile_image,
            last_login: new Date().toISOString(),
          })
          .eq('id', profileRecord.id)
      }
    } else {
      // 2. Create new user profile in database
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

      const { data: insertedList, error: insertErr } = await supabase
        .from('user_profiles')
        .insert([newProfile])
        .select()

      if (!insertErr && insertedList && insertedList.length > 0) {
        profileRecord = insertedList[0]
        console.log('[Auth Sync] Database User Created:', profileRecord.id)
      } else if (insertErr) {
        console.warn('[Auth Sync] Supabase Insert Notice:', insertErr)
      }
    }
  } catch (err) {
    console.warn('[Auth Sync] Database query error:', err)
  }

  // Determine final profile fields
  const finalId = profileRecord?.id || userId
  const finalCode = profileRecord?.referral_code || defaultCode
  console.log('[Auth Sync] Referral Code Generated / Loaded:', finalCode)

  // 3. Fetch referrals for statistics
  let totalReferrals = 0
  let successfulReferrals = 0
  let pendingReferrals = 0
  let totalEarnings = 0
  let referralsData: any[] = []

  try {
    const { data: refData } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_user_id', finalId)

    if (refData && refData.length > 0) {
      referralsData = refData
      totalReferrals = refData.length
      refData.forEach((ref) => {
        if (ref.status === 'APPROVED' || ref.status === 'SUCCESS') {
          successfulReferrals += 1
          totalEarnings += Number(ref.commission_amount || 10)
        } else if (ref.status === 'PENDING') {
          pendingReferrals += 1
        }
      })
    }
  } catch {}

  // 4. Fetch withdrawals for wallet calculation
  let totalWithdrawnOrPending = 0
  let pendingWithdrawal = 0
  const withdrawHistory: any[] = []

  try {
    const { data: wData } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', finalId)
      .order('created_at', { ascending: false })

    if (wData && wData.length > 0) {
      wData.forEach((w) => {
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
  } catch {}

  const walletBalance = Math.max(0, totalEarnings - totalWithdrawnOrPending)

  const resultProfile: UserReferralProfile = {
    id: finalId,
    firebaseUid: userId,
    name: profileRecord?.full_name || cleanName,
    email: profileRecord?.email || cleanEmail,
    photoUrl: profileRecord?.profile_image || photoUrl || undefined,
    phone: profileRecord?.phone || '',
    referralCode: finalCode,
    referralLink: generateReferralLink(finalCode),
    walletBalance,
    successfulReferrals,
    pendingReferrals,
    totalReferrals,
    totalEarnings,
    pendingWithdrawal,
    createdAt: profileRecord?.created_at ? new Date(profileRecord.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
    lastLogin: profileRecord?.last_login ? new Date(profileRecord.last_login).toLocaleString() : new Date().toLocaleString(),
    referralHistory: referralsData,
    withdrawHistory,
  }

  // 5. Update local cache for Admin Panel sync fallback
  try {
    const cached = JSON.parse(localStorage.getItem('live_users_cache') || '[]')
    const idx = cached.findIndex((c: any) => c.email && c.email.toLowerCase() === cleanEmail)
    if (idx >= 0) {
      cached[idx] = { ...cached[idx], ...resultProfile }
    } else {
      cached.push(resultProfile)
    }
    localStorage.setItem('live_users_cache', JSON.stringify(cached))
  } catch {}

  console.log('[Auth Sync] Admin Sync Completed for:', cleanEmail)
  return resultProfile
}
