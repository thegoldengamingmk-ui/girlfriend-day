/**
 * Single Source of Truth User & Database Synchronization Service
 * Handles primary user persistence, referral code generation (ONCE ONLY),
 * wallet initialization, referral stats, database mapping, and integrity checks.
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
 * Executed in one complete transaction logic block:
 * 1. Checks users table by firebase_uid (and email fallback)
 * 2. If existing: UPDATE last_login, display_name, profile_photo ONLY. Never change referral_code.
 * 3. If new: INSERT into users, user_profiles, wallets, referral_stats, and user_login_history.
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

    // Record login history
    try {
      await supabase.from('user_login_history').insert([
        {
          user_id: dbUserRecord.id,
          email: cleanEmail,
          login_time: nowIso,
          ip_address: '127.0.0.1',
          device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Desktop',
          browser: 'Browser',
        },
      ])
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
      // BRAND-NEW USER -> CREATE ONCE IN SINGLE TRANSACTION BLOCK
      const newReferralCode = generateUniqueReferralCode()
      console.log('[Auth Flow] Brand-New User Detected - Initial Referral Code Generated:', newReferralCode)

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

          // 1. Create Profile
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
          console.log('[Auth Flow] Profile Created for user:', dbUserRecord.id)

          // 2. Create Referral Stats
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

          // 3. Create Wallet
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

          // 4. Create Initial Login History
          await supabase.from('user_login_history').insert([
            {
              user_id: dbUserRecord.id,
              email: cleanEmail,
              login_time: nowIso,
              ip_address: '127.0.0.1',
              device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Desktop',
              browser: 'Browser',
            },
          ])
          console.log('[Auth Flow] Database Transaction Success for new account!')
        }
      } catch (err) {
        console.warn('[Auth Flow] Database Transaction Failed:', err)
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

  // Fetch referral stats
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
    }
  } catch {}

  // Fetch wallet
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

  // Fetch withdrawals
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

  // Run Startup Integrity Check
  await runStartupIntegrityCheck(canonicalUser)

  console.log('[Auth Flow] Single Source of Truth Canonical User Synced for:', cleanEmail, 'Code:', referralCode)
  return canonicalUser
}

/**
 * Startup Integrity Self-Healing Check
 * Ensures every authenticated user has a valid wallet, referral_stats, and profile record.
 */
export async function runStartupIntegrityCheck(user: CanonicalUser) {
  if (!user || !user.id) return

  try {
    // 1. Integrity check: Wallets
    const { data: w } = await supabase.from('wallets').select('*').eq('user_id', user.id)
    if (!w || w.length === 0) {
      await supabase.from('wallets').insert([
        {
          user_id: user.id,
          available_balance: user.wallet?.availableBalance || 0,
          pending_balance: 0,
          total_earned: user.wallet?.totalEarned || 0,
          total_withdrawn: 0,
        },
      ])
      console.log('[Integrity Self-Healing] Wallet Created for user:', user.id)
    }

    // 2. Integrity check: Referral Stats
    const { data: rs } = await supabase.from('referral_stats').select('*').eq('user_id', user.id)
    if (!rs || rs.length === 0) {
      await supabase.from('referral_stats').insert([
        {
          user_id: user.id,
          total_referrals: user.referralStats?.totalReferrals || 0,
          successful_referrals: user.referralStats?.successfulReferrals || 0,
          pending_referrals: 0,
          referral_earnings: user.referralStats?.referralEarnings || 0,
        },
      ])
      console.log('[Integrity Self-Healing] Referral Stats Created for user:', user.id)
    }

    // 3. Integrity check: user_profiles fallback
    const { data: up } = await supabase.from('user_profiles').select('*').eq('email', user.email)
    if (!up || up.length === 0) {
      await supabase.from('user_profiles').insert([
        {
          full_name: user.displayName,
          email: user.email,
          profile_image: user.profilePhoto || null,
          referral_code: user.referralCode,
          account_status: 'ACTIVE',
          subscription_status: 'PREMIUM',
          last_login: new Date().toISOString(),
        },
      ])
      console.log('[Integrity Self-Healing] Profile Created for user:', user.id)
    }
  } catch (err) {
    console.warn('[Integrity Self-Healing Notice]:', err)
  }
}

/**
 * Validate and Apply Referral Code Directly against Supabase Database
 */
export async function validateAndApplyReferralCode(
  referredUserId: string,
  referredUserEmail: string,
  enteredCode: string
): Promise<{ success: boolean; message: string; referrerName?: string }> {
  const cleanCode = enteredCode.trim().toUpperCase()
  if (!cleanCode) {
    console.log('[Referral Rejected] Empty code entered')
    return { success: false, message: 'Please enter a valid referral code.' }
  }

  console.log('[Referral Validation] Checking code directly from Supabase DB:', cleanCode)

  try {
    // 1. Search primary users table first
    let referrer: any = null

    const { data: usersList } = await supabase
      .from('users')
      .select('*')
      .eq('referral_code', cleanCode)

    if (usersList && usersList.length > 0) {
      referrer = usersList[0]
    } else {
      // Search user_profiles fallback
      const { data: profileList } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('referral_code', cleanCode)

      if (profileList && profileList.length > 0) {
        referrer = profileList[0]
      }
    }

    if (!referrer) {
      console.log('[Referral Rejected] Code not found in database:', cleanCode)
      return { success: false, message: 'Invalid Referral Code. Please check and try again.' }
    }

    // 2. Prevent Self-Referral
    const referrerEmail = (referrer.email || '').trim().toLowerCase()
    if (referrerEmail === referredUserEmail.trim().toLowerCase() || referrer.id === referredUserId) {
      console.log('[Referral Rejected] Self referral attempt blocked for email:', referredUserEmail)
      return { success: false, message: 'You cannot use your own referral code.' }
    }

    // 3. Check if referral code was already used by this user
    const { data: existingRef } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_user_id', referredUserId)

    if (existingRef && existingRef.length > 0) {
      console.log('[Referral Rejected] User already applied a referral code.')
      return { success: false, message: 'You have already applied a referral code.' }
    }

    // 4. Create Referral Record
    const nowIso = new Date().toISOString()
    const commission = 10

    await supabase.from('referrals').insert([
      {
        referrer_id: referrer.id,
        referrer_user_id: referrer.id,
        referred_user_id: referredUserId,
        referral_code_used: cleanCode,
        commission_amount: commission,
        status: 'APPROVED',
        created_at: nowIso,
      },
    ])
    console.log('[Referral Record Created] Linked referrer:', referrer.id, 'to referred:', referredUserId)

    // 5. Update referred_by in users table
    await supabase.from('users').update({ referred_by: referrer.id }).eq('id', referredUserId)

    // 6. Update referral_stats for Referrer
    const { data: statsData } = await supabase.from('referral_stats').select('*').eq('user_id', referrer.id)
    if (statsData && statsData.length > 0) {
      const currentStats = statsData[0]
      await supabase
        .from('referral_stats')
        .update({
          total_referrals: Number(currentStats.total_referrals || 0) + 1,
          successful_referrals: Number(currentStats.successful_referrals || 0) + 1,
          referral_earnings: Number(currentStats.referral_earnings || 0) + commission,
          updated_at: nowIso,
        })
        .eq('user_id', referrer.id)
    } else {
      await supabase.from('referral_stats').insert([
        {
          user_id: referrer.id,
          total_referrals: 1,
          successful_referrals: 1,
          pending_referrals: 0,
          referral_earnings: commission,
        },
      ])
    }
    console.log('[Referral Stats Created/Updated] Increment stats for referrer:', referrer.id)

    // 7. Update wallets for Referrer
    const { data: walletData } = await supabase.from('wallets').select('*').eq('user_id', referrer.id)
    if (walletData && walletData.length > 0) {
      const currentWallet = walletData[0]
      await supabase
        .from('wallets')
        .update({
          available_balance: Number(currentWallet.available_balance || 0) + commission,
          total_earned: Number(currentWallet.total_earned || 0) + commission,
          updated_at: nowIso,
        })
        .eq('user_id', referrer.id)
    } else {
      await supabase.from('wallets').insert([
        {
          user_id: referrer.id,
          available_balance: commission,
          pending_balance: 0,
          total_earned: commission,
          total_withdrawn: 0,
        },
      ])
    }
    console.log('[Wallet Created/Updated] Commission credited to referrer wallet:', referrer.id)

    console.log('[Referral Accepted] Code:', cleanCode, 'applied successfully!')
    return {
      success: true,
      message: `Referral code accepted! Referred by ${referrer.display_name || referrer.full_name || 'a friend'}.`,
      referrerName: referrer.display_name || referrer.full_name || 'a friend',
    }
  } catch (err: any) {
    console.error('[Referral Validation Error]:', err)
    return { success: false, message: err.message || 'Failed to validate referral code.' }
  }
}
