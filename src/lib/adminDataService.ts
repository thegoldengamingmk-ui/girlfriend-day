import { supabase } from "./supabase"

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export interface AdminUserRecord {
  id: string
  firebaseUid?: string
  name: string
  email: string
  mobile: string
  subscriptionStatus: "PREMIUM" | "EXPIRED" | "FREE"
  subscriptionExpiry: string
  referralCode: string
  referredUsersCount: number
  totalReferralEarnings: number
  walletBalance: number
  accountStatus: "ACTIVE" | "BLOCKED"
  signupDate: string
  lastLogin: string
  lastLoginIp: string
  referredBy?: string
}

export interface PaymentTransaction {
  id: string
  transactionId: string
  userName: string
  email: string
  amount: number
  gateway: string
  status: "SUCCESS" | "FAILED" | "PENDING" | "REFUNDED"
  plan: string
  date: string
}

export interface WithdrawalRecord {
  id: string
  requestId: string
  userId: string
  userName: string
  email: string
  amount: number
  paymentDetails: string
  upiId: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "COMPLETED"
  requestDate: string
  adminNotes?: string
  paymentRefId?: string
  reviewedAt?: string
}

export interface UserLoginRecord {
  id: string
  loginTime: string
  ipAddress: string
  device: string
  browser: string
}

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  premiumUsers: number
  freeUsers: number
  newUsersToday: number
  newUsersThisWeek: number
  newUsersThisMonth: number
  totalRevenue: number
  successfulPayments: number
  failedPayments: number
  pendingPayments: number
  pendingWithdrawalsCount: number
  pendingWithdrawalsAmount: number
  approvedWithdrawalsAmount: number
  rejectedWithdrawalsCount: number
  totalReferrals: number
  successfulReferrals: number
  totalReferralRewards: number
  totalWalletBalance: number
}

export interface ReferralRecord {
  id: string
  referrerId: string
  referrerName: string
  referrerEmail: string
  referrerCode: string
  referredName: string
  referredEmail: string
  commissionAmount: number
  status: string
  createdAt: string
}

export interface AuditLogRecord {
  id: string
  adminId: string
  adminEmail: string
  action: string
  description: string
  ipAddress: string
  deviceInfo: string
  createdAt: string
}

/**
 * Fetch comprehensive admin dashboard KPI stats from Supabase
 */
export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date()
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString()
  const weekStart = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString()
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString()

  try {
    const [
      { data: allUsers },
      { data: premiumProfiles },
      { data: payments },
      { data: withdrawals },
      { data: referralStats },
      { data: wallets },
    ] = await Promise.all([
      supabase.from("users").select("id, created_at, status"),
      supabase
        .from("user_profiles")
        .select("id, subscription_status, account_status"),
      supabase.from("payments").select("id, amount, status, created_at"),
      supabase.from("withdrawals").select("id, amount, status"),
      supabase
        .from("referral_stats")
        .select("successful_referrals, referral_earnings"),
      supabase
        .from("wallets")
        .select("available_balance, pending_balance, total_earned"),
    ])

    const users = allUsers || []
    const profiles = premiumProfiles || []
    const pays = payments || []
    const wds = withdrawals || []
    const refs = referralStats || []
    const ws = wallets || []

    const premiumCount = profiles.filter(
      (p) => p.subscription_status === "PREMIUM",
    ).length
    const blockedCount = profiles.filter(
      (p) => p.account_status === "BLOCKED",
    ).length

    const successPays = pays.filter(
      (p) =>
        (p.status || "").toUpperCase() === "CAPTURED" ||
        (p.status || "").toUpperCase() === "SUCCESS",
    )
    const failedPays = pays.filter(
      (p) => (p.status || "").toUpperCase() === "FAILED",
    )
    const pendingPays = pays.filter(
      (p) => (p.status || "").toUpperCase() === "PENDING",
    )

    const totalRevenue = successPays.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    )
    const pendingWds = wds.filter((w) => w.status === "PENDING")
    const approvedWds = wds.filter(
      (w) => w.status === "COMPLETED" || w.status === "APPROVED",
    )
    const rejectedWds = wds.filter((w) => w.status === "REJECTED")

    const totalWalletEarned = ws.reduce(
      (sum, w) => sum + Number(w.total_earned || 0),
      0,
    )
    const totalReferralRewardsCalculated = refs.reduce(
      (sum, r) => sum + Number(r.referral_earnings || 0),
      0,
    )
    const totalReferralRewards = Math.max(
      totalReferralRewardsCalculated,
      totalWalletEarned,
    )

    const totalSuccessfulReferralsCalculated = refs.reduce(
      (sum, r) => sum + Number(r.successful_referrals || 0),
      0,
    )
    const totalSuccessfulReferrals = Math.max(
      totalSuccessfulReferralsCalculated,
      totalWalletEarned > 0 ? Math.ceil(totalWalletEarned / 10) : 0,
    )

    const totalWalletBalance = ws.reduce(
      (sum, w) =>
        sum + Number(w.available_balance || 0) + Number(w.pending_balance || 0),
      0,
    )

    return {
      totalUsers: users.length,
      activeUsers: users.length - blockedCount,
      premiumUsers: premiumCount,
      freeUsers: users.length - premiumCount,
      newUsersToday: users.filter((u) => u.created_at >= todayStart).length,
      newUsersThisWeek: users.filter((u) => u.created_at >= weekStart).length,
      newUsersThisMonth: users.filter((u) => u.created_at >= monthStart).length,
      totalRevenue,
      successfulPayments: successPays.length,
      failedPayments: failedPays.length,
      pendingPayments: pendingPays.length,
      pendingWithdrawalsCount: pendingWds.length,
      pendingWithdrawalsAmount: pendingWds.reduce(
        (sum, w) => sum + Number(w.amount || 0),
        0,
      ),
      approvedWithdrawalsAmount: approvedWds.reduce(
        (sum, w) => sum + Number(w.amount || 0),
        0,
      ),
      rejectedWithdrawalsCount: rejectedWds.length,
      totalReferrals: totalSuccessfulReferrals,
      successfulReferrals: totalSuccessfulReferrals,
      totalReferralRewards,
      totalWalletBalance,
    }
  } catch (err) {
    console.warn("[getAdminStats error]:", err)
    return {
      totalUsers: 0,
      activeUsers: 0,
      premiumUsers: 0,
      freeUsers: 0,
      newUsersToday: 0,
      newUsersThisWeek: 0,
      newUsersThisMonth: 0,
      totalRevenue: 0,
      successfulPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
      pendingWithdrawalsCount: 0,
      pendingWithdrawalsAmount: 0,
      approvedWithdrawalsAmount: 0,
      rejectedWithdrawalsCount: 0,
      totalReferrals: 0,
      successfulReferrals: 0,
      totalReferralRewards: 0,
      totalWalletBalance: 0,
    }
  }
}

/**
 * Single Source of Truth Admin Users Query
 * Reads primary users table and joins referral_stats, wallets, user_profiles in Supabase.
 */
export async function getAdminUsers(): Promise<AdminUserRecord[]> {
  const usersMap = new Map<string, AdminUserRecord>()

  try {
    // Parallel fetch of all required tables
    const [
      { data: primaryUsers },
      { data: profileUsers },
      { data: refStatsList },
      { data: walletList },
    ] = await Promise.all([
      supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("referral_stats").select("*"),
      supabase.from("wallets").select("*"),
    ])

    // Build referral stats map by user_id
    const refStatsMap = new Map<string, { count: number; earnings: number }>()
    if (refStatsList && refStatsList.length > 0) {
      refStatsList.forEach((s) => {
        refStatsMap.set(s.user_id, {
          count: Number(s.successful_referrals || 0),
          earnings: Number(s.referral_earnings || 0),
        })
      })
    }

    // Build wallet map by user_id
    const walletMap = new Map<string, {
      available: number
      total_earned: number
    }>()
    if (walletList && walletList.length > 0) {
      walletList.forEach((w) => {
        walletMap.set(w.user_id, {
          available: Number(w.available_balance || 0),
          total_earned: Number(w.total_earned || 0),
        })
      })
    }

    // Build profile map by email for subscription data join
    const profileMap = new Map<string, any>()
    if (profileUsers && profileUsers.length > 0) {
      profileUsers.forEach((p) => {
        if (p.email) profileMap.set(p.email.toLowerCase(), p)
      })
    }

    // Populate from primary users table
    if (primaryUsers && primaryUsers.length > 0) {
      primaryUsers.forEach((u) => {
        const emailKey = (u.email || "").toLowerCase()
        if (!emailKey) return

        const stats = refStatsMap.get(u.id) || { count: 0, earnings: 0 }
        const wallet = walletMap.get(u.id) || { available: 0, total_earned: 0 }
        const profile = profileMap.get(emailKey)

        // Read subscription status from user_profiles (source of truth), fall back to users.role
        const subscriptionStatus = (() => {
          const rawStatus = (
            profile?.subscription_status ||
            u.subscription_status ||
            "FREE"
          ).toUpperCase()
          if (rawStatus === "PREMIUM") return "PREMIUM" as const
          if (rawStatus === "EXPIRED") return "EXPIRED" as const
          return "FREE" as const
        })()

        const subscriptionExpiry = profile?.subscription_expiry
          ? new Date(profile.subscription_expiry).toISOString().split("T")[0]
          : subscriptionStatus === "PREMIUM"
            ? "Active"
            : "N/A"

        const accountStatus = (() => {
          const st = (
            u.status ||
            profile?.account_status ||
            "active"
          ).toLowerCase()
          return st === "blocked" || st === "BLOCKED"
            ? "BLOCKED" as const
            : "ACTIVE" as const
        })()

        usersMap.set(emailKey, {
          id: u.id,
          firebaseUid: u.firebase_uid,
          name: u.display_name || u.email.split("@")[0],
          email: u.email,
          mobile: profile?.phone || "N/A",
          subscriptionStatus,
          subscriptionExpiry,
          referralCode: u.referral_code,
          referredUsersCount: stats.count,
          totalReferralEarnings: wallet.total_earned || stats.earnings,
          walletBalance: wallet.available,
          accountStatus,
          signupDate: u.created_at
            ? new Date(u.created_at).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          lastLogin: u.last_login
            ? new Date(u.last_login).toLocaleString()
            : "Never",
          lastLoginIp: profile?.last_login_ip || "N/A",
          referredBy: u.referred_by || profile?.referred_by || undefined,
        })
      })
    }

    // Populate user_profiles table records if not already in usersMap
    if (profileUsers && profileUsers.length > 0) {
      profileUsers.forEach((u) => {
        const emailKey = (u.email || "").toLowerCase()
        if (!emailKey || usersMap.has(emailKey)) return

        const stats = refStatsMap.get(u.id) || { count: 0, earnings: 0 }
        const wallet = walletMap.get(u.id) || { available: 0, total_earned: 0 }

        const subscriptionStatus = (() => {
          const rawStatus = (u.subscription_status || "FREE").toUpperCase()
          if (rawStatus === "PREMIUM") return "PREMIUM" as const
          if (rawStatus === "EXPIRED") return "EXPIRED" as const
          return "FREE" as const
        })()

        usersMap.set(emailKey, {
          id: u.id,
          name: u.full_name || emailKey.split("@")[0],
          email: u.email,
          mobile: u.phone || "N/A",
          subscriptionStatus,
          subscriptionExpiry: u.subscription_expiry
            ? new Date(u.subscription_expiry).toISOString().split("T")[0]
            : "N/A",
          referralCode: u.referral_code,
          referredUsersCount: stats.count,
          totalReferralEarnings: wallet.total_earned || stats.earnings,
          walletBalance: wallet.available,
          accountStatus: u.account_status === "BLOCKED" ? "BLOCKED" : "ACTIVE",
          signupDate: u.created_at
            ? new Date(u.created_at).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          lastLogin: u.last_login
            ? new Date(u.last_login).toLocaleString()
            : "Never",
          lastLoginIp: u.last_login_ip || "N/A",
          referredBy: u.referred_by || undefined,
        })
      })
    }
  } catch (err) {
    console.warn("[getAdminUsers error]:", err)
  }

  return Array.from(usersMap.values())
}

/**
 * Fetch Live Payments from Supabase
 */
export async function getAdminTransactions(): Promise<PaymentTransaction[]> {
  try {
    const { data: usersList } = await supabase
      .from("users")
      .select("id, email, display_name")
    const userMap = new Map<string, { email: string; name: string }>()
    if (usersList && usersList.length > 0) {
      usersList.forEach((u) => {
        userMap.set(u.id, {
          email: u.email,
          name: u.display_name || u.email.split("@")[0],
        })
      })
    }

    const { data: dbPayments, error: pErr } = await supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })

    if (pErr) console.warn("[Admin Payments Query Warning]:", pErr)

    if (dbPayments && dbPayments.length > 0) {
      return dbPayments.map((p) => {
        const uInfo = userMap.get(p.user_id) || { email: "N/A", name: "User" }
        const rawStatus = (p.status || "").toUpperCase()
        const status: PaymentTransaction["status"] =
          rawStatus === "CAPTURED" || rawStatus === "SUCCESS"
            ? "SUCCESS"
            : rawStatus === "FAILED"
              ? "FAILED"
              : rawStatus === "REFUNDED"
                ? "REFUNDED"
                : "PENDING"
        return {
          id: p.id,
          transactionId: p.razorpay_payment_id || p.payment_id || p.id,
          userName: uInfo.name,
          email: uInfo.email,
          amount: Number(p.amount || 0),
          gateway: p.payment_method || "Razorpay",
          status,
          plan: "Premium Surprise Website",
          date: p.created_at
            ? new Date(p.created_at).toLocaleString()
            : new Date().toLocaleString(),
        }
      })
    }
  } catch (err) {
    console.warn("[getAdminTransactions error]:", err)
  }
  return []
}

/**
 * Fetch Live Withdrawals from Supabase
 */
export async function getAdminWithdrawals(): Promise<WithdrawalRecord[]> {
  try {
    const { data: usersList } = await supabase
      .from("users")
      .select("id, email, display_name")
    const userMap = new Map<string, { email: string; name: string }>()
    if (usersList && usersList.length > 0) {
      usersList.forEach((u) => {
        userMap.set(u.id, {
          email: u.email,
          name: u.display_name || u.email.split("@")[0],
        })
      })
    }

    const { data: dbWithdrawals, error: wErr } = await supabase
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false })

    if (wErr) console.warn("[Admin Withdrawals Query Warning]:", wErr)

    if (dbWithdrawals && dbWithdrawals.length > 0) {
      return dbWithdrawals.map((w) => {
        const uInfo = userMap.get(w.user_id) || { email: "N/A", name: "User" }
        return {
          id: w.id,
          requestId:
            w.withdrawal_id || w.request_id || `WD-${w.id.slice(0, 6)}`,
          userId: w.user_id,
          userName: uInfo.name,
          email: uInfo.email,
          amount: Number(w.amount || 0),
          paymentDetails:
            w.payment_details || (w.upi_id ? `UPI: ${w.upi_id}` : "N/A"),
          upiId: w.upi_id || "",
          status: (
            w.status || "PENDING"
          ).toUpperCase() as WithdrawalRecord["status"],
          requestDate:
            w.requested_at || w.created_at
              ? new Date(w.requested_at || w.created_at).toLocaleString()
              : new Date().toLocaleString(),
          adminNotes: w.admin_notes || "",
          paymentRefId: w.transaction_id || "",
          reviewedAt: w.reviewed_at
            ? new Date(w.reviewed_at).toLocaleString()
            : undefined,
        }
      })
    }
  } catch (err) {
    console.warn("[getAdminWithdrawals error]:", err)
  }
  return []
}

/**
 * Fetch Referral Activity from Supabase
 */
export async function getAdminReferrals(): Promise<ReferralRecord[]> {
  try {
    const { data: usersList } = await supabase
      .from("users")
      .select("id, email, display_name, referral_code")
    const userMap = new Map<string, {
      email: string
      name: string
      code: string
    }>()
    if (usersList) {
      usersList.forEach((u) => {
        userMap.set(u.id, {
          email: u.email,
          name: u.display_name || u.email.split("@")[0],
          code: u.referral_code || "",
        })
      })
    }

    const { data: referrals } = await supabase
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false })

    if (referrals && referrals.length > 0) {
      return referrals.map((r) => {
        const referrerId = r.referrer_id || r.referrer_user_id
        const referrer = userMap.get(referrerId) || {
          email: "N/A",
          name: "Unknown",
          code: r.referral_code_used || "",
        }
        const referred = userMap.get(r.referred_user_id) || {
          email: "N/A",
          name: "Unknown",
          code: "",
        }
        return {
          id: r.id,
          referrerId: referrerId,
          referrerName: referrer.name,
          referrerEmail: referrer.email,
          referrerCode: referrer.code || r.referral_code_used,
          referredName: referred.name,
          referredEmail: referred.email,
          commissionAmount: Number(r.commission_amount || 10),
          status: r.status || "APPROVED",
          createdAt: r.created_at
            ? new Date(r.created_at).toLocaleString()
            : new Date().toLocaleString(),
        }
      })
    }
  } catch (err) {
    console.warn("[getAdminReferrals error]:", err)
  }
  return []
}

/**
 * Fetch Audit Logs from Supabase
 */
export async function getAdminAuditLogs(
  limit = 100,
): Promise<AuditLogRecord[]> {
  try {
    const { data: logs } = await supabase
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (logs && logs.length > 0) {
      return logs.map((l) => ({
        id: l.id,
        adminId: l.admin_id,
        adminEmail: l.admin_email,
        action: l.action,
        description: l.description || "",
        ipAddress: l.ip_address || "127.0.0.1",
        deviceInfo: l.device_info || "Browser",
        createdAt: l.created_at
          ? new Date(l.created_at).toLocaleString()
          : new Date().toLocaleString(),
      }))
    }
  } catch (err) {
    console.warn("[getAdminAuditLogs error]:", err)
  }
  return []
}

/**
 * Fetch User Login History from Supabase
 */
export async function getUserLoginHistory(
  userId: string,
): Promise<UserLoginRecord[]> {
  try {
    const { data: dbHistory, error } = await supabase
      .from("user_login_history")
      .select("*")
      .eq("user_id", userId)
      .order("login_time", { ascending: false })
      .limit(50)

    if (!error && dbHistory && dbHistory.length > 0) {
      return dbHistory.map((h) => ({
        id: h.id,
        loginTime: new Date(h.login_time).toLocaleString(),
        ipAddress: h.ip_address || "N/A",
        device: h.device || "Desktop",
        browser: h.browser || "Browser",
      }))
    }
  } catch {}
  return []
}

/**
 * Toggle User Account Status in Supabase (both tables)
 */
export async function toggleUserStatus(userId: string, currentStatus: string) {
  const newStatus = currentStatus === "ACTIVE" ? "BLOCKED" : "ACTIVE"
  const newStatusLower = newStatus.toLowerCase()
  try {
    await Promise.all([
      supabase
        .from("users")
        .update({
          status: newStatusLower,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId),
      supabase
        .from("user_profiles")
        .update({
          account_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId),
    ])
  } catch (err) {
    console.warn("[toggleUserStatus error]:", err)
  }
}

/**
 * Grant or Revoke Premium Subscription for a User
 */
export async function toggleUserSubscription(
  userId: string,
  email: string,
  grant: boolean,
) {
  const nowIso = new Date().toISOString()
  const expiry = grant
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    : null
  const status = grant ? "PREMIUM" : "FREE"
  try {
    await supabase
      .from("user_profiles")
      .update({
        subscription_status: status,
        subscription_expiry: expiry,
        updated_at: nowIso,
      })
      .eq("email", email.toLowerCase())

    if (isValidUuid(userId)) {
      await supabase
        .from("users")
        .update({ updated_at: nowIso })
        .eq("id", userId)
    }
  } catch (err) {
    console.warn("[toggleUserSubscription error]:", err)
  }
}

/**
 * Update Withdrawal Request Status (legacy — used by updateWithdrawalStatus calls)
 */
export async function updateWithdrawalStatus(
  id: string,
  newStatus: "APPROVED" | "REJECTED" | "PAID" | "COMPLETED",
  adminNotes?: string,
  paymentRefId?: string,
) {
  const nowIso = new Date().toISOString()
  try {
    await supabase
      .from("withdrawals")
      .update({
        status: newStatus,
        admin_notes: adminNotes,
        transaction_id: paymentRefId || null,
        reviewed_at: nowIso,
        completed_at:
          newStatus === "COMPLETED" || newStatus === "PAID" ? nowIso : null,
        updated_at: nowIso,
      })
      .eq("id", id)
  } catch (err) {
    console.warn("[updateWithdrawalStatus error]:", err)
  }
}

/**
 * Subscribe to Supabase Realtime Changes for Admin Dashboard
 */
export function subscribeToAdminRealtimeUpdates(onUpdate: () => void) {
  const channel = supabase
    .channel("admin_realtime_v2")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "users" },
      () => onUpdate(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_profiles" },
      () => onUpdate(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "payments" },
      () => onUpdate(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "withdrawals" },
      () => onUpdate(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "referrals" },
      () => onUpdate(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "wallets" },
      () => onUpdate(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "transactions" },
      () => onUpdate(),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * CSV Downloader
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[],
) {
  const csvContent =
    "data:text/csv;charset=utf-8," +
    [
      headers.join(","),
      ...rows.map((e: any) =>
        e.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n")

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
