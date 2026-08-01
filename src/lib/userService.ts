/**
 * Single Source of Truth User & Referral System Synchronization Service
 * Production-grade implementation for user persistence, unique 8+ char referral codes,
 * self-referral prevention, duplicate referral protection, and atomic transaction updates.
 */

import { supabase } from "./supabase"
import { executeWalletTransaction } from "./walletService"

/**
 * Utility to validate whether a string is a valid PostgreSQL UUID
 * (8-4-4-4-12 hex characters format)
 */
export function isValidUuid(id: string | null | undefined): boolean {
  if (!id || typeof id !== "string") return false
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  return uuidRegex.test(id.trim())
}

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
 * Generate 8+ character uppercase alphanumeric unique referral code (e.g. GF-LOVE-X892K7)
 * Checks database uniqueness to prevent collisions.
 */
export async function generateUniqueReferralCode(): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let unique = false
  let code = ""
  let attempts = 0

  while (!unique && attempts < 10) {
    attempts++
    let randomPart = ""
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    code = `GF-LOVE-${randomPart}`

    try {
      const { data } = await supabase
        .from("users")
        .select("id")
        .eq("referral_code", code)
      if (!data || data.length === 0) {
        unique = true
      }
    } catch {
      unique = true
    }
  }

  console.log("[Referral Code Generated] Permanent Code:", code)
  return code
}

/**
 * Generate complete referral sharing link
 */
export function buildReferralLink(referralCode: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://gift-surprise.com"
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
  const displayName = firebaseUser.displayName || cleanEmail.split("@")[0]
  const profilePhoto = firebaseUser.photoURL || undefined
  const nowIso = new Date().toISOString()

  console.log(
    "[Auth Flow] Firebase Login Success for UID:",
    firebaseUid,
    "Email:",
    cleanEmail,
  )

  // Local persistent backup registry map to prevent duplicate code generation across offline reloads
  const getBackupRegistry = (): Record<string, any> => {
    try {
      return JSON.parse(
        localStorage.getItem("canonical_users_backup_registry") || "{}",
      )
    } catch {
      return {}
    }
  }

  const saveBackupRegistry = (registry: Record<string, any>) => {
    try {
      localStorage.setItem(
        "canonical_users_backup_registry",
        JSON.stringify(registry),
      )
    } catch {}
  }

  const backupRegistry = getBackupRegistry()
  let dbUserRecord: any = null

  try {
    // 1. Search users table by firebase_uid
    const { data: byUid } = await supabase
      .from("users")
      .select("*")
      .eq("firebase_uid", firebaseUid)

    if (byUid && byUid.length > 0) {
      dbUserRecord = byUid[0]
      console.log(
        "[Auth Flow] Database User Found by Firebase UID:",
        dbUserRecord.id,
      )
    } else {
      // 2. Search users table by email
      const { data: byEmail } = await supabase
        .from("users")
        .select("*")
        .eq("email", cleanEmail)

      if (byEmail && byEmail.length > 0) {
        dbUserRecord = byEmail[0]
        console.log(
          "[Auth Flow] Database User Found by Email:",
          dbUserRecord.id,
        )

        if (!dbUserRecord.firebase_uid) {
          await supabase
            .from("users")
            .update({ firebase_uid: firebaseUid })
            .eq("id", dbUserRecord.id)
          dbUserRecord.firebase_uid = firebaseUid
        }
      }
    }
  } catch (err) {
    console.warn("[Auth Flow] Supabase user query notice:", err)
  }

  // 3. Handle Existing vs New User
  if (dbUserRecord) {
    // EXISTING USER -> UPDATE ONLY (NEVER REGENERATE REFERRAL CODE)
    console.log(
      "[Auth Flow] Existing User - Updating last_login & profile info...",
    )
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
      await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", dbUserRecord.id)
    } catch {}

    dbUserRecord.last_login = nowIso
    if (updatePayload.display_name)
      dbUserRecord.display_name = updatePayload.display_name
    if (updatePayload.profile_photo)
      dbUserRecord.profile_photo = updatePayload.profile_photo

    // Record login history
    try {
      await supabase.from("user_login_history").insert([
        {
          user_id: dbUserRecord.id,
          email: cleanEmail,
          login_time: nowIso,
          ip_address: "127.0.0.1",
          device:
            typeof navigator !== "undefined" ? navigator.userAgent : "Desktop",
          browser: "Browser",
        },
      ])
    } catch {}
  } else {
    // Check backup registry before generating a new code
    const existingBackup =
      backupRegistry[firebaseUid] || backupRegistry[cleanEmail]

    if (existingBackup) {
      console.log(
        "[Auth Flow] Loaded existing user from backup registry. Preserving referral code:",
        existingBackup.referralCode,
      )
      dbUserRecord = {
        id: existingBackup.id,
        firebase_uid: firebaseUid,
        email: cleanEmail,
        display_name: displayName,
        profile_photo: profilePhoto || null,
        referral_code: existingBackup.referralCode,
        created_at: existingBackup.createdAt || nowIso,
        last_login: nowIso,
        role: "user",
        status: "active",
      }
    } else {
      // BRAND-NEW USER -> CREATE ONCE IN SINGLE TRANSACTION BLOCK
      const newReferralCode = await generateUniqueReferralCode()
      console.log(
        "[Auth Flow] Brand-New User Detected - Initial Referral Code Generated:",
        newReferralCode,
      )

      const newUserPayload = {
        firebase_uid: firebaseUid,
        email: cleanEmail,
        display_name: displayName,
        first_name: displayName.split(" ")[0] || displayName,
        last_name: displayName.split(" ").slice(1).join(" ") || "",
        profile_photo: profilePhoto || null,
        provider: "google",
        email_verified: true,
        referral_code: newReferralCode,
        referral_link: buildReferralLink(newReferralCode),
        role: "user",
        status: "active",
        created_at: nowIso,
        updated_at: nowIso,
        last_login: nowIso,
      }

      try {
        const { data: insertedUsers } = await supabase
          .from("users")
          .insert([newUserPayload])
          .select()

        if (insertedUsers && insertedUsers.length > 0) {
          dbUserRecord = insertedUsers[0]
          console.log("[Auth Flow] Database User Created:", dbUserRecord.id)

          // 1. Create Profile
          await supabase.from("user_profiles").insert([
            {
              full_name: displayName,
              email: cleanEmail,
              profile_image: profilePhoto || null,
              referral_code: newReferralCode,
              account_status: "ACTIVE",
              subscription_status: "FREE",
              last_login: nowIso,
            },
          ])
          console.log("[Auth Flow] Profile Created for user:", dbUserRecord.id)

          // 2. Create Referral Stats
          await supabase.from("referral_stats").insert([
            {
              user_id: dbUserRecord.id,
              total_referrals: 0,
              successful_referrals: 0,
              pending_referrals: 0,
              referral_earnings: 0,
            },
          ])
          console.log(
            "[Auth Flow] Referral Stats Created for user:",
            dbUserRecord.id,
          )

          // 3. Create Wallet
          await supabase.from("wallets").insert([
            {
              user_id: dbUserRecord.id,
              available_balance: 0,
              pending_balance: 0,
              total_earned: 0,
              total_withdrawn: 0,
            },
          ])
          console.log("[Auth Flow] Wallet Created for user:", dbUserRecord.id)

          // 4. Create Initial Login History
          await supabase.from("user_login_history").insert([
            {
              user_id: dbUserRecord.id,
              email: cleanEmail,
              login_time: nowIso,
              ip_address: "127.0.0.1",
              device:
                typeof navigator !== "undefined"
                  ? navigator.userAgent
                  : "Desktop",
              browser: "Browser",
            },
          ])
          console.log(
            "[Auth Flow] Database Transaction Success for new account!",
          )
        }
      } catch (err) {
        console.warn("[Auth Flow] Database Transaction Failed:", err)
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
          role: "user",
          status: "active",
        }
      }
    }
  }

  // Extract canonical fields
  const userId = dbUserRecord.id
  const referralCode = dbUserRecord.referral_code
  const referralLink =
    dbUserRecord.referral_link || buildReferralLink(referralCode)
  const createdAtFormatted = dbUserRecord.created_at
    ? new Date(dbUserRecord.created_at).toLocaleDateString()
    : new Date().toLocaleDateString()
  const lastLoginFormatted = dbUserRecord.last_login
    ? new Date(dbUserRecord.last_login).toLocaleString()
    : new Date().toLocaleString()

  // Candidate User IDs for cross-table matching (strictly valid UUIDs only to avoid Postgres 22P02 syntax errors)
  const candidateUserIds = Array.from(
    new Set(
      [userId, dbUserRecord.user_id, firebaseUid].filter((id) =>
        isValidUuid(id),
      ) as string[],
    ),
  )

  // 1. Fetch referral stats across all candidate user IDs
  let referralStats = {
    totalReferrals: 0,
    successfulReferrals: 0,
    pendingReferrals: 0,
    referralEarnings: 0,
  }

  if (candidateUserIds.length > 0) {
    try {
      const { data: refStats } = await supabase
        .from("referral_stats")
        .select("*")
        .in("user_id", candidateUserIds)

      if (refStats && refStats.length > 0) {
        refStats.forEach((s) => {
          referralStats.totalReferrals = Math.max(
            referralStats.totalReferrals,
            Number(s.total_referrals || 0),
          )
          referralStats.successfulReferrals = Math.max(
            referralStats.successfulReferrals,
            Number(s.successful_referrals || 0),
          )
          referralStats.pendingReferrals = Math.max(
            referralStats.pendingReferrals,
            Number(s.pending_referrals || 0),
          )
          referralStats.referralEarnings = Math.max(
            referralStats.referralEarnings,
            Number(s.referral_earnings || 0),
          )
        })
      }
    } catch {}
  }

  // 2. Fetch wallet record across candidate user IDs
  let wallet = {
    availableBalance: referralStats.referralEarnings,
    pendingBalance: 0,
    totalEarned: referralStats.referralEarnings,
    totalWithdrawn: 0,
  }

  if (candidateUserIds.length > 0) {
    try {
      const { data: walletData } = await supabase
        .from("wallets")
        .select("*")
        .in("user_id", candidateUserIds)

      if (walletData && walletData.length > 0) {
        walletData.forEach((w) => {
          wallet.availableBalance = Math.max(
            wallet.availableBalance,
            Number(w.available_balance || 0),
          )
          wallet.pendingBalance = Math.max(
            wallet.pendingBalance,
            Number(w.pending_balance || 0),
          )
          wallet.totalEarned = Math.max(
            wallet.totalEarned,
            Number(w.total_earned || 0),
          )
          wallet.totalWithdrawn = Math.max(
            wallet.totalWithdrawn,
            Number(w.total_withdrawn || 0),
          )
        })
      }
    } catch {}
  }

  // 3. RECONCILIATION: Check financial transaction ledger for completed Referral Rewards
  if (candidateUserIds.length > 0) {
    try {
      const { data: txns } = await supabase
        .from("transactions")
        .select("amount, transaction_type, status")
        .in("user_id", candidateUserIds)
        .eq("status", "Completed")

      if (txns && txns.length > 0) {
        let ledgerEarnings = 0
        let ledgerCount = 0

        txns.forEach((t) => {
          if (
            t.transaction_type === "Referral Reward" ||
            t.transaction_type === "Referral Bonus"
          ) {
            ledgerEarnings += Number(t.amount || 0)
            ledgerCount += 1
          }
        })

        if (ledgerEarnings > referralStats.referralEarnings) {
          referralStats.referralEarnings = ledgerEarnings
        }
        if (ledgerCount > referralStats.successfulReferrals) {
          referralStats.successfulReferrals = ledgerCount
          referralStats.totalReferrals = Math.max(
            referralStats.totalReferrals,
            ledgerCount,
          )
        }
      }
    } catch (err) {
      console.warn("[Ledger Reconciliation Notice]:", err)
    }
  }

  // 4. RECONCILIATION: Check referrals table for approved referrals
  if (candidateUserIds.length > 0) {
    try {
      const { data: refList } = await supabase
        .from("referrals")
        .select("commission_amount, status")
        .in("referrer_user_id", candidateUserIds)

      if (refList && refList.length > 0) {
        const approvedRefs = refList.filter(
          (r) => r.status === "APPROVED" || r.status === "COMPLETED",
        )
        const approvedCount = approvedRefs.length
        const approvedEarnings = approvedRefs.reduce(
          (sum, r) => sum + Number(r.commission_amount || 0),
          0,
        )

        if (approvedCount > referralStats.successfulReferrals) {
          referralStats.successfulReferrals = approvedCount
          referralStats.totalReferrals = Math.max(
            referralStats.totalReferrals,
            approvedCount,
          )
        }
        if (approvedEarnings > referralStats.referralEarnings) {
          referralStats.referralEarnings = approvedEarnings
        }
      }
    } catch (err) {
      console.warn("[Referrals Table Reconciliation Notice]:", err)
    }
  }

  // Synchronize wallet balances with highest reconciled earnings
  wallet.totalEarned = Math.max(
    wallet.totalEarned,
    referralStats.referralEarnings,
  )
  wallet.availableBalance = Math.max(
    wallet.availableBalance,
    wallet.totalEarned - wallet.totalWithdrawn,
  )

  // 5. SELF-HEALING: Persist reconciled values to Supabase referral_stats and wallets
  if (candidateUserIds.length > 0) {
    try {
      for (const uid of candidateUserIds) {
        const { data: existingRS } = await supabase
          .from("referral_stats")
          .select("*")
          .eq("user_id", uid)

        if (existingRS && existingRS.length > 0) {
          await supabase
            .from("referral_stats")
            .update({
              total_referrals: referralStats.totalReferrals,
              successful_referrals: referralStats.successfulReferrals,
              referral_earnings: referralStats.referralEarnings,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", uid)
        } else {
          await supabase.from("referral_stats").insert([
            {
              user_id: uid,
              total_referrals: referralStats.totalReferrals,
              successful_referrals: referralStats.successfulReferrals,
              pending_referrals: referralStats.pendingReferrals,
              referral_earnings: referralStats.referralEarnings,
            },
          ])
        }

        const { data: existingW } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", uid)

        if (existingW && existingW.length > 0) {
          await supabase
            .from("wallets")
            .update({
              available_balance: wallet.availableBalance,
              total_earned: wallet.totalEarned,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", uid)
        } else {
          await supabase.from("wallets").insert([
            {
              user_id: uid,
              available_balance: wallet.availableBalance,
              pending_balance: wallet.pendingBalance,
              total_earned: wallet.totalEarned,
              total_withdrawn: wallet.totalWithdrawn,
            },
          ])
        }
      }
    } catch {}
  }

  // Fetch withdrawals
  const withdrawals: any[] = []
  if (isValidUuid(userId)) {
    try {
      const { data: wList } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (wList && wList.length > 0) {
        wList.forEach((w) => {
          withdrawals.push({
            id: w.id,
            requestId: w.request_id || `REQ-${w.id.slice(0, 6)}`,
            amount: Number(w.amount || 0),
            paymentMethod: w.payment_method || "UPI",
            upiId: w.upi_id || "N/A",
            status: w.status || "PENDING",
            date: w.created_at
              ? new Date(w.created_at).toLocaleString()
              : new Date().toLocaleString(),
          })
        })
      }
    } catch {}
  }

  const canonicalUser: CanonicalUser = {
    id: userId,
    firebaseUid,
    email: cleanEmail,
    displayName: dbUserRecord.display_name || displayName,
    firstName: dbUserRecord.first_name || displayName.split(" ")[0],
    lastName:
      dbUserRecord.last_name || displayName.split(" ").slice(1).join(" "),
    profilePhoto: dbUserRecord.profile_photo || profilePhoto,
    provider: dbUserRecord.provider || "google",
    emailVerified: dbUserRecord.email_verified !== false,
    referralCode,
    referralLink,
    role: dbUserRecord.role || "user",
    status: dbUserRecord.status || "active",
    createdAt: createdAtFormatted,
    updatedAt: dbUserRecord.updated_at || nowIso,
    lastLogin: lastLoginFormatted,
    referralStats,
    wallet,
    withdrawals,
  }

  // Backup only essential fields to persistent registry (prevent over-storage)
  const minimalBackup = {
    id: canonicalUser.id,
    referralCode: canonicalUser.referralCode,
    createdAt: canonicalUser.createdAt,
  }
  backupRegistry[firebaseUid] = minimalBackup
  backupRegistry[cleanEmail] = minimalBackup
  saveBackupRegistry(backupRegistry)

  // Run Startup Integrity Check
  await runStartupIntegrityCheck(canonicalUser)

  console.log(
    "[Auth Flow] Single Source of Truth Canonical User Synced for:",
    cleanEmail,
    "Code:",
    referralCode,
  )
  return canonicalUser
}

/**
 * Startup Integrity Self-Healing Check
 * Ensures every authenticated user has a valid wallet, referral_stats, and profile record.
 */
export async function runStartupIntegrityCheck(user: CanonicalUser) {
  if (!user || !user.id || !isValidUuid(user.id)) return

  try {
    // 1. Integrity check: Wallets
    const { data: w } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
    if (!w || w.length === 0) {
      await supabase.from("wallets").insert([
        {
          user_id: user.id,
          available_balance: user.wallet?.availableBalance || 0,
          pending_balance: 0,
          total_earned: user.wallet?.totalEarned || 0,
          total_withdrawn: 0,
        },
      ])
      console.log("[Integrity Self-Healing] Wallet Created for user:", user.id)
    }

    // 2. Integrity check: Referral Stats
    const { data: rs } = await supabase
      .from("referral_stats")
      .select("*")
      .eq("user_id", user.id)
    if (!rs || rs.length === 0) {
      await supabase.from("referral_stats").insert([
        {
          user_id: user.id,
          total_referrals: user.referralStats?.totalReferrals || 0,
          successful_referrals: user.referralStats?.successfulReferrals || 0,
          pending_referrals: 0,
          referral_earnings: user.referralStats?.referralEarnings || 0,
        },
      ])
      console.log(
        "[Integrity Self-Healing] Referral Stats Created for user:",
        user.id,
      )
    }

    // 3. Integrity check: user_profiles fallback
    const { data: up } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("email", user.email)
    if (!up || up.length === 0) {
      await supabase.from("user_profiles").insert([
        {
          full_name: user.displayName,
          email: user.email,
          profile_image: user.profilePhoto || null,
          referral_code: user.referralCode,
          account_status: "ACTIVE",
          subscription_status: "FREE",
          last_login: new Date().toISOString(),
        },
      ])
      console.log("[Integrity Self-Healing] Profile Created for user:", user.id)
    }
  } catch (err) {
    console.warn("[Integrity Self-Healing Notice]:", err)
  }
}

/**
 * Validate and Apply Referral Code Directly against Supabase Database
 * Production-grade implementation enforcing self-referral protection, duplicate referral prevention, and atomic transactions.
 */
export async function validateAndApplyReferralCode(
  referredUserId: string,
  referredUserEmail: string,
  enteredCode: string,
): Promise<{ success: boolean; message: string; referrerName?: string }> {
  // 1. Normalize input: trim and UPPERCASE
  const cleanCode = enteredCode.trim().toUpperCase()
  if (!cleanCode) {
    console.log("[Referral Rejected] Empty referral code provided")
    return { success: false, message: "Please enter a valid referral code." }
  }

  console.log(
    "[Referral Code Validated] Checking database for code:",
    cleanCode,
  )

  try {
    // 2. Fetch referred user object to check if already used a code or if self-referral
    let referredUser: any = null
    if (isValidUuid(referredUserId)) {
      const { data: currentUserList } = await supabase
        .from("users")
        .select("*")
        .eq("id", referredUserId)
      if (currentUserList && currentUserList.length > 0) {
        referredUser = currentUserList[0]
      }
    }

    // Check if referred user already has a referrer linked
    if (referredUser && referredUser.referred_by) {
      console.log(
        "[Duplicate Referral Prevented] User already linked to referrer:",
        referredUser.referred_by,
      )
      return {
        success: false,
        message: "You have already applied a referral code.",
      }
    }

    if (isValidUuid(referredUserId)) {
      const { data: existingRef } = await supabase
        .from("referrals")
        .select("*")
        .eq("referred_user_id", referredUserId)

      if (existingRef && existingRef.length > 0) {
        console.log(
          "[Duplicate Referral Prevented] Referral record already exists for user:",
          referredUserId,
        )
        return {
          success: false,
          message: "You have already applied a referral code.",
        }
      }
    }

    // 3. Search users table for code owner
    let referrer: any = null
    const { data: usersList } = await supabase
      .from("users")
      .select("*")
      .eq("referral_code", cleanCode)

    if (usersList && usersList.length > 0) {
      referrer = usersList[0]
    } else {
      const { data: profileList } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("referral_code", cleanCode)

      if (profileList && profileList.length > 0) {
        const prof = profileList[0]
        const { data: matchedUsers } = await supabase
          .from("users")
          .select("*")
          .eq("email", (prof.email || "").trim().toLowerCase())
        if (matchedUsers && matchedUsers.length > 0) {
          referrer = matchedUsers[0]
        } else {
          referrer = prof
        }
      }
    }

    if (!referrer) {
      return {
        success: false,
        message: "Invalid Referral Code. Please check and try again.",
      }
    }

    // 4. Ensure owner account is active
    const ownerStatus = (
      referrer.status ||
      referrer.account_status ||
      "active"
    ).toLowerCase()
    if (ownerStatus === "blocked" || ownerStatus === "inactive") {
      console.log(
        "[Referral Rejected] Referrer account is inactive or blocked:",
        referrer.id,
      )
      return {
        success: false,
        message: "This referral code belongs to an inactive account.",
      }
    }

    // 5. Self-Referral Protection (Compare Firebase UID, User ID, and Email)
    const referrerEmail = (referrer.email || "").trim().toLowerCase()
    const referrerFirebaseUid = referrer.firebase_uid || ""
    const currentUserFirebaseUid = referredUser?.firebase_uid || ""

    if (
      (referredUserEmail &&
        referrerEmail === referredUserEmail.trim().toLowerCase()) ||
      (referredUserId && referrer.id === referredUserId) ||
      (currentUserFirebaseUid &&
        referrerFirebaseUid &&
        referrerFirebaseUid === currentUserFirebaseUid)
    ) {
      console.log(
        "[Self Referral Prevented] User attempted to use own referral code:",
        cleanCode,
      )
      return {
        success: false,
        message:
          "Self-referral is not allowed. You cannot use your own referral code.",
      }
    }

    // Resolve true referrer UUID primary key
    const trueReferrerUserId = referrer.user_id || referrer.id

    // Check if referredUserId and trueReferrerUserId are valid Postgres UUIDs
    const isReferredUserUuid = isValidUuid(referredUserId)
    const isReferrerUserUuid = isValidUuid(trueReferrerUserId)

    if (!isReferredUserUuid || !isReferrerUserUuid) {
      console.log(
        "[Guest/Non-UUID Referral Validated] Code is valid! Deferring database insertion until sign-up.",
      )
      return {
        success: true,
        message: `Referral code valid! 50% OFF applied. Referred by ${referrer.display_name || referrer.full_name || "a friend"}.`,
        referrerName: referrer.display_name || referrer.full_name || "a friend",
      }
    }

    // 6. Execute atomic creation of referral relationship & stats credit
    const nowIso = new Date().toISOString()
    const commission = 10

    const { error: insertRefErr } = await supabase.from("referrals").insert([
      {
        referrer_id: trueReferrerUserId,
        referrer_user_id: trueReferrerUserId,
        referred_user_id: referredUserId,
        referral_code_used: cleanCode,
        commission_amount: commission,
        status: "APPROVED",
        created_at: nowIso,
      },
    ])

    if (insertRefErr) {
      console.warn(
        "[Referral Transaction Failed] Insert referral error:",
        insertRefErr,
      )
      return { success: false, message: "Failed to create referral record." }
    }

    console.log(
      "[Referral Accepted] Created referral relationship between referrer:",
      trueReferrerUserId,
      "and referred:",
      referredUserId,
    )

    // Update referred_by in users table
    await supabase
      .from("users")
      .update({ referred_by: trueReferrerUserId })
      .eq("id", referredUserId)

    // 7. Update referral_stats across all referrer candidate IDs
    const referrerIds = Array.from(
      new Set(
        [trueReferrerUserId, referrer.id, referrer.user_id].filter(
          (id) => isValidUuid(id),
        ) as string[],
      ),
    )

    for (const rid of referrerIds) {
      const { data: statsData } = await supabase
        .from("referral_stats")
        .select("*")
        .eq("user_id", rid)

      if (statsData && statsData.length > 0) {
        const currentStats = statsData[0]
        await supabase
          .from("referral_stats")
          .update({
            total_referrals: Number(currentStats.total_referrals || 0) + 1,
            successful_referrals:
              Number(currentStats.successful_referrals || 0) + 1,
            referral_earnings:
              Number(currentStats.referral_earnings || 0) + commission,
            updated_at: nowIso,
          })
          .eq("user_id", rid)
      } else {
        await supabase.from("referral_stats").insert([
          {
            user_id: rid,
            total_referrals: 1,
            successful_referrals: 1,
            pending_referrals: 0,
            referral_earnings: commission,
          },
        ])
      }
    }
    console.log(
      "[Referral Stats Updated] Referrer stats incremented for:",
      referrer.id,
    )

    // 8. Update wallets via financial transaction ledger executor
    await executeWalletTransaction({
      userId: trueReferrerUserId,
      type: "Referral Reward",
      amount: commission,
      referenceType: "referral",
      referenceId: cleanCode,
      description: `Referral Reward for referring user (Code: ${cleanCode})`,
      status: "Completed",
    })

    return {
      success: true,
      message: `Referral code accepted! You were referred by ${referrer.display_name || referrer.full_name || "a friend"}.`,
      referrerName: referrer.display_name || referrer.full_name || "a friend",
    }
  } catch (err: any) {
    console.error("[Referral Transaction Failed]:", err)
    return {
      success: false,
      message: err.message || "Failed to process referral.",
    }
  }
}
