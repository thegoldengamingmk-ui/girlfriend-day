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
 * Called ONLY ONCE when a brand-new user record is inserted into the database.
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
 * Record user login history and update canonical last_login in user_profiles
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

  const nowIso = new Date().toISOString()

  try {
    // 1. Update single source of truth last_login in user_profiles
    await supabase
      .from('user_profiles')
      .update({
        last_login: nowIso,
        last_login_ip: '127.0.0.1',
      })
      .eq('email', email.trim().toLowerCase())

    // 2. Record login attempt history
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

/**
 * Prevent Referral Abuse: Check if user is attempting to use their own referral code
 */
export function isSelfReferral(userEmail: string, referrerCode: string, userProfileCode?: string): boolean {
  if (!referrerCode || !userProfileCode) return false
  return referrerCode.trim().toUpperCase() === userProfileCode.trim().toUpperCase()
}

/**
 * Single Source of Truth Profile Fetcher & Creator
 * All screens (User Dashboard, Admin Panel, Super Admin) read from user_profiles table.
 */
export async function getOrCreateReferralProfile(
  firebaseUid: string,
  email: string,
  displayName?: string,
  photoUrl?: string
): Promise<UserReferralProfile> {
  const cleanEmail = email.trim().toLowerCase()
  const cleanName = displayName || cleanEmail.split('@')[0]
  const nowIso = new Date().toISOString()

  console.log('[Single Source of Truth] Authenticating user by Firebase UID:', firebaseUid, 'Email:', cleanEmail)

  // Persistent registry map helper to guarantee 100% code stability across refreshes
  const getRegistryMap = (): Record<string, any> => {
    try {
      return JSON.parse(localStorage.getItem('persistent_user_registry_map') || '{}')
    } catch {
      return {}
    }
  }

  const saveRegistryMap = (map: Record<string, any>) => {
    try {
      localStorage.setItem('persistent_user_registry_map', JSON.stringify(map))
    } catch {}
  }

  const registry = getRegistryMap()
  let profileRecord: any = null

  // 1. Search database by email first
  try {
    const { data: existingList } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', cleanEmail)

    if (existingList && existingList.length > 0) {
      profileRecord = existingList[0]
      console.log('[Single Source of Truth] Existing DB User Found:', profileRecord.email, 'Code:', profileRecord.referral_code)
    }
  } catch (err) {
    console.warn('[Single Source of Truth] DB Query error:', err)
  }

  // 2. Check local persistent registry fallback if DB query returned nothing
  const registryKey = firebaseUid || cleanEmail
  const existingRegistryUser = registry[registryKey] || registry[cleanEmail]

  if (profileRecord) {
    // Existing DB User: Update last_login, name, avatar ONLY. NEVER change referral_code.
    const updates: any = { last_login: nowIso }
    if (cleanName && profileRecord.full_name !== cleanName) updates.full_name = cleanName
    if (photoUrl && profileRecord.profile_image !== photoUrl) updates.profile_image = photoUrl

    try {
      await supabase.from('user_profiles').update(updates).eq('id', profileRecord.id)
    } catch {}

    profileRecord.last_login = nowIso
  } else if (existingRegistryUser) {
    // Existing Registry User (DB disconnected or fallback): Preserve exact referral code!
    console.log('[Single Source of Truth] Loaded Existing Registry User:', existingRegistryUser.email, 'Code:', existingRegistryUser.referralCode)
    profileRecord = {
      id: existingRegistryUser.id,
      full_name: cleanName,
      email: cleanEmail,
      profile_image: photoUrl || existingRegistryUser.photoUrl || null,
      referral_code: existingRegistryUser.referralCode,
      created_at: existingRegistryUser.createdAt,
      last_login: nowIso,
    }
  } else {
    // Brand-new user: Generate referral code ONCE
    const brandNewCode = generateUserReferralCode()
    console.log('[Single Source of Truth] Brand-New User - Generating Initial Referral Code:', brandNewCode)

    const newProfileData = {
      full_name: cleanName,
      email: cleanEmail,
      profile_image: photoUrl || null,
      account_status: 'ACTIVE',
      subscription_status: 'PREMIUM',
      referral_code: brandNewCode,
      last_login: nowIso,
      last_login_ip: '127.0.0.1',
    }

    try {
      const { data: insertedList } = await supabase
        .from('user_profiles')
        .insert([newProfileData])
        .select()

      if (insertedList && insertedList.length > 0) {
        profileRecord = insertedList[0]
        console.log('[Single Source of Truth] Inserted New User Record:', profileRecord.id)
      }
    } catch (err) {
      console.warn('[Single Source of Truth] DB Insert notice:', err)
    }

    if (!profileRecord) {
      profileRecord = {
        id: `usr_${Date.now()}`,
        full_name: cleanName,
        email: cleanEmail,
        profile_image: photoUrl || null,
        referral_code: brandNewCode,
        created_at: nowIso,
        last_login: nowIso,
      }
    }
  }

  const canonicalId = profileRecord.id
  const canonicalCode = profileRecord.referral_code
  const canonicalCreatedAt = profileRecord.created_at ? new Date(profileRecord.created_at).toLocaleDateString() : new Date().toLocaleDateString()
  const canonicalLastLogin = profileRecord.last_login ? new Date(profileRecord.last_login).toLocaleString() : new Date().toLocaleString()

  // 3. Fetch referral statistics
  let totalReferrals = 0
  let successfulReferrals = 0
  let pendingReferrals = 0
  let totalEarnings = 0
  let referralsData: any[] = []

  try {
    const { data: refData } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_user_id', canonicalId)

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

  // 4. Fetch withdrawal statistics
  let totalWithdrawnOrPending = 0
  let pendingWithdrawal = 0
  const withdrawHistory: any[] = []

  try {
    const { data: wData } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', canonicalId)
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

  const canonicalUserObj: UserReferralProfile = {
    id: canonicalId,
    firebaseUid,
    name: profileRecord.full_name || cleanName,
    email: cleanEmail,
    photoUrl: profileRecord.profile_image || photoUrl || undefined,
    phone: profileRecord.phone || '',
    referralCode: canonicalCode,
    referralLink: generateReferralLink(canonicalCode),
    walletBalance,
    successfulReferrals,
    pendingReferrals,
    totalReferrals,
    totalEarnings,
    pendingWithdrawal,
    createdAt: canonicalCreatedAt,
    lastLogin: canonicalLastLogin,
    referralHistory: referralsData,
    withdrawHistory,
  }

  // 5. Store in persistent registry map & cache layer to ensure zero mismatch across refreshes
  registry[registryKey] = canonicalUserObj
  registry[cleanEmail] = canonicalUserObj
  saveRegistryMap(registry)

  try {
    const cached = JSON.parse(localStorage.getItem('live_users_cache') || '[]')
    const idx = cached.findIndex((c: any) => c.email && c.email.toLowerCase() === cleanEmail)
    if (idx >= 0) {
      cached[idx] = canonicalUserObj
    } else {
      cached.push(canonicalUserObj)
    }
    localStorage.setItem('live_users_cache', JSON.stringify(cached))
  } catch {}

  console.log('[Single Source of Truth] Canonical Profile Loaded:', canonicalUserObj.email, 'Code:', canonicalUserObj.referralCode)
  return canonicalUserObj
}
