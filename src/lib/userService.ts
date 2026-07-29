/**
 * Single Source of Truth User & Database Synchronization Service
 * Handles primary user persistence, referral code generation (ONCE ONLY),
 * wallet initialization, referral stats, and database mapping.
 */

import { supabase } from './supabase'

export interface CanonicalUser {
  id: string
  firebaseUid: string
  email: string
  displayName: string
  firstName?: string
  lastName?: string
  profilePhoto?: string
  provider: string
  emailVerified: boolean
  referralCode: string
  referralLink: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
  lastLogin: string
  referralStats: {
    totalReferrals: number
    successfulReferrals: number
    pendingReferrals: number
    referralEarnings: number
  }
  wallet: {
    availableBalance: number
    pendingBalance: number
    totalEarned: number
    totalWithdrawn: number
  }
  withdrawals: any[]
}

/**
 * Generate unique referral code (e.g. GF-LOVE-8921)
 * MUST BE CALLED ONLY ONCE DURING INITIAL USER REGISTRATION.
 */
export function generateUniqueReferralCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `GF-LOVE-${digits}`
}

/**
 * Generate complete referral sharing link
 */
export function buildReferralLink(referralCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gift-surprise.com'
  return `${origin}/?ref=${referralCode}`
}

/**
 * Primary Database Synchronizer for Firebase Authenticated Users
 * 1. Checks users table by firebase_uid (or email fallback)
 * 2. If existing: UPDATE last_login, display_name, profile_photo ONLY. Never change referral_code.
 * 3. If new: INSERT into users table with newly generated referral_code, create referral_stats and wallet.
 */
export async function syncFirebaseUserWithDatabase(firebaseUser: {
  uid: string
  email: string
  displayName?: string | null
  photoURL?: string | null
}): Promise<CanonicalUser> {
  const firebaseUid = firebaseUser.uid
  const cleanEmail = firebaseUser.email.trim().toLowerCase()
  const displayName = firebaseUser.displayName || cleanEmail.split('@')[0]
  const profilePhoto = firebaseUser.photoURL || undefined
  const nowIso = new Date().toISOString()

  console.log('[Auth Flow] Firebase Login Success for UID:', firebaseUid, 'Email:', cleanEmail)

  // Local persistent backup registry map to prevent duplicate code generation across offline reloads
  const getBackupRegistry = (): Record<string, any> => {
    try {
      return JSON.parse(localStorage.getItem('canonical_users_backup_registry') || '{}')
    } catch {
      return {}
    }
  }

  const saveBackupRegistry = (registry: Record<string, any>) => {
    try {
      localStorage.setItem('canonical_users_backup_registry', JSON.stringify(registry))
    } catch {}
  }

  const backupRegistry = getBackupRegistry()
  let dbUserRecord: any = null

  try {
    // 1. Search users table by firebase_uid
    const { data: byUid } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', firebaseUid)

    if (byUid && byUid.length > 0) {
      dbUserRecord = byUid[0]
      console.log('[Auth Flow] Database User Found by Firebase UID:', dbUserRecord.id)
    } else {
      // 2. Search users table by email
      const { data: byEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)

      if (byEmail && byEmail.length > 0) {
        dbUserRecord = byEmail[0]
        console.log('[Auth Flow] Database User Found by Email:', dbUserRecord.id)

        // Bind firebase_uid if missing
        if (!dbUserRecord.firebase_uid) {
          await supabase
            .from('users')
            .update({ firebase_uid: firebaseUid })
            .eq('id', dbUserRecord.id)
          dbUserRecord.firebase_uid = firebaseUid
        }
      }
    }
  } catch (err) {
    console.warn('[Auth Flow] Supabase user query notice:', err)
  }

  // 3. Handle Existing vs New User
  if (dbUserRecord) {
    // EXISTING USER -> UPDATE ONLY (NEVER REGENERATE REFERRAL CODE)
    console.log('[Auth Flow] Existing User - Updating last_login & profile info...')
    const updatePayload: any = {
      last_login: nowIso,
      updated_at: nowIso,
    }
    if (displayName && dbUserRecord.display_name !== displayName) {
      updatePayload.display_name = displayName
    }
    if (profilePhoto && dbUserRecord.profile_photo !== profilePhoto) {
      updatePayload.profile_photo = profilePhoto
    }

    try {
      await supabase.from('users').update(updatePayload).eq('id', dbUserRecord.id)
    } catch {}

    dbUserRecord.last_login = nowIso
    if (updatePayload.display_name) dbUserRecord.display_name = updatePayload.display_name
    if (updatePayload.profile_photo) dbUserRecord.profile_photo = updatePayload.profile_photo

    // Also update backward-compatible user_profiles table if present
    try {
      await supabase
        .from('user_profiles')
        .update({
          last_login: nowIso,
          full_name: displayName,
          profile_image: profilePhoto || null,
        })
        .eq('email', cleanEmail)
    } catch {}
  } else {
    // Check backup registry before generating a new code
    const existingBackup = backupRegistry[firebaseUid] || backupRegistry[cleanEmail]

    if (existingBackup) {
      console.log('[Auth Flow] Loaded existing user from backup registry. Preserving referral code:', existingBackup.referralCode)
      dbUserRecord = {
        id: existingBackup.id,
        firebase_uid: firebaseUid,
        email: cleanEmail,
        display_name: displayName,
        profile_photo: profilePhoto || null,
        referral_code: existingBackup.referralCode,
        created_at: existingBackup.createdAt || nowIso,
        last_login: nowIso,
        role: 'user',
        status: 'active',
      }
    } else {
      // BRAND-NEW USER -> CREATE ONCE
      const newReferralCode = generateUniqueReferralCode()
      console.log('[Auth Flow] Brand-New User Detected - Referral Code Generated:', newReferralCode)

      const newUserPayload = {
        firebase_uid: firebaseUid,
        email: cleanEmail,
        display_name: displayName,
        first_name: displayName.split(' ')[0] || displayName,
        last_name: displayName.split(' ').slice(1).join(' ') || '',
        profile_photo: profilePhoto || null,
        provider: 'google',
        email_verified: true,
        referral_code: newReferralCode,
        referral_link: buildReferralLink(newReferralCode),
        role: 'user',
        status: 'active',
        created_at: nowIso,
        updated_at: nowIso,
        last_login: nowIso,
      }

      try {
        const { data: insertedUsers } = await supabase
          .from('users')
          .insert([newUserPayload])
          .select()

        if (insertedUsers && insertedUsers.length > 0) {
          dbUserRecord = insertedUsers[0]
          console.log('[Auth Flow] Database User Created:', dbUserRecord.id)

          // Create initial referral_stats record
          await supabase.from('referral_stats').insert([
            {
              user_id: dbUserRecord.id,
              total_referrals: 0,
              successful_referrals: 0,
              pending_referrals: 0,
              referral_earnings: 0,
            },
          ])
          console.log('[Auth Flow] Referral Stats Created for user:', dbUserRecord.id)

          // Create initial wallet record
          await supabase.from('wallets').insert([
            {
              user_id: dbUserRecord.id,
              available_balance: 0,
              pending_balance: 0,
              total_earned: 0,
              total_withdrawn: 0,
            },
          ])
          console.log('[Auth Flow] Wallet Created for user:', dbUserRecord.id)

          // Create backward-compatible user_profiles row
          await supabase.from('user_profiles').insert([
            {
              full_name: displayName,
              email: cleanEmail,
              profile_image: profilePhoto || null,
              referral_code: newReferralCode,
              account_status: 'ACTIVE',
              subscription_status: 'PREMIUM',
              last_login: nowIso,
            },
          ])
        }
      } catch (err) {
        console.warn('[Auth Flow] Insert user notice:', err)
      }

      if (!dbUserRecord) {
        dbUserRecord = {
          id: `usr_${Date.now()}`,
          firebase_uid: firebaseUid,
          email: cleanEmail,
          display_name: displayName,
          profile_photo: profilePhoto || null,
          referral_code: newReferralCode,
          created_at: nowIso,
          last_login: nowIso,
          role: 'user',
          status: 'active',
        }
      }
    }
  }

  // Extract canonical fields
  const userId = dbUserRecord.id
  const referralCode = dbUserRecord.referral_code
  const referralLink = dbUserRecord.referral_link || buildReferralLink(referralCode)
  const createdAtFormatted = dbUserRecord.created_at
    ? new Date(dbUserRecord.created_at).toLocaleDateString()
    : new Date().toLocaleDateString()
  const lastLoginFormatted = dbUserRecord.last_login
    ? new Date(dbUserRecord.last_login).toLocaleString()
    : new Date().toLocaleString()

  // 4. Fetch live referral stats
  let referralStats = {
    totalReferrals: 0,
    successfulReferrals: 0,
    pendingReferrals: 0,
    referralEarnings: 0,
  }

  try {
    const { data: refStats } = await supabase
      .from('referral_stats')
      .select('*')
      .eq('user_id', userId)

    if (refStats && refStats.length > 0) {
      const s = refStats[0]
      referralStats = {
        totalReferrals: Number(s.total_referrals || 0),
        successfulReferrals: Number(s.successful_referrals || 0),
        pendingReferrals: Number(s.pending_referrals || 0),
        referralEarnings: Number(s.referral_earnings || 0),
      }
    } else {
      // Aggregate directly from referrals table if referral_stats record is empty
      const { data: rawRefs } = await supabase
        .from('referrals')
        .select('*')
        .or(`referrer_id.eq.${userId},referrer_user_id.eq.${userId}`)

      if (rawRefs && rawRefs.length > 0) {
        let total = rawRefs.length
        let success = 0
        let pending = 0
        let earnings = 0

        rawRefs.forEach((r) => {
          if (r.status === 'APPROVED' || r.status === 'SUCCESS') {
            success += 1
            earnings += Number(r.commission_amount || 10)
          } else if (r.status === 'PENDING') {
            pending += 1
          }
        })

        referralStats = {
          totalReferrals: total,
          successfulReferrals: success,
          pendingReferrals: pending,
          referralEarnings: earnings,
        }
      }
    }
  } catch {}

  // 5. Fetch live wallet details
  let wallet = {
    availableBalance: referralStats.referralEarnings,
    pendingBalance: 0,
    totalEarned: referralStats.referralEarnings,
    totalWithdrawn: 0,
  }

  try {
    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)

    if (walletData && walletData.length > 0) {
      const w = walletData[0]
      wallet = {
        availableBalance: Number(w.available_balance || referralStats.referralEarnings),
        pendingBalance: Number(w.pending_balance || 0),
        totalEarned: Number(w.total_earned || referralStats.referralEarnings),
        totalWithdrawn: Number(w.total_withdrawn || 0),
      }
    }
  } catch {}

  // 6. Fetch live withdrawal history
  const withdrawals: any[] = []
  try {
    const { data: wList } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (wList && wList.length > 0) {
      wList.forEach((w) => {
        withdrawals.push({
          id: w.id,
          requestId: w.request_id || `REQ-${w.id.slice(0, 6)}`,
          amount: Number(w.amount || 0),
          paymentMethod: w.payment_method || 'UPI',
          upiId: w.upi_id || 'N/A',
          status: w.status || 'PENDING',
          date: w.created_at ? new Date(w.created_at).toLocaleString() : new Date().toLocaleString(),
        })
      })
    }
  } catch {}

  const canonicalUser: CanonicalUser = {
    id: userId,
    firebaseUid,
    email: cleanEmail,
    displayName: dbUserRecord.display_name || displayName,
    firstName: dbUserRecord.first_name || displayName.split(' ')[0],
    lastName: dbUserRecord.last_name || displayName.split(' ').slice(1).join(' '),
    profilePhoto: dbUserRecord.profile_photo || profilePhoto,
    provider: dbUserRecord.provider || 'google',
    emailVerified: dbUserRecord.email_verified !== false,
    referralCode,
    referralLink,
    role: dbUserRecord.role || 'user',
    status: dbUserRecord.status || 'active',
    createdAt: createdAtFormatted,
    updatedAt: dbUserRecord.updated_at || nowIso,
    lastLogin: lastLoginFormatted,
    referralStats,
    wallet,
    withdrawals,
  }

  // Backup in persistent registry
  backupRegistry[firebaseUid] = canonicalUser
  backupRegistry[cleanEmail] = canonicalUser
  saveBackupRegistry(backupRegistry)

  console.log('[Auth Flow] Single Source of Truth Canonical User Synced for:', cleanEmail, 'Code:', referralCode)
  return canonicalUser
}
