import { supabase } from './supabase'

export interface AdminUserRecord {
  id: string
  name: string
  email: string
  mobile: string
  subscriptionStatus: 'PREMIUM' | 'EXPIRED' | 'FREE'
  subscriptionExpiry: string
  referralCode: string
  referredUsersCount: number
  totalReferralEarnings: number
  accountStatus: 'ACTIVE' | 'BLOCKED'
  signupDate: string
  lastLogin: string
  lastLoginIp: string
}

export interface PaymentTransaction {
  id: string
  transactionId: string
  userName: string
  email: string
  amount: number
  gateway: string
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED'
  plan: string
  date: string
}

export interface WithdrawalRecord {
  id: string
  requestId: string
  userName: string
  email: string
  amount: number
  paymentDetails: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'
  requestDate: string
  adminNotes?: string
  paymentRefId?: string
}

export interface UserLoginRecord {
  id: string
  loginTime: string
  ipAddress: string
  device: string
  browser: string
}

export async function getAdminUsers(): Promise<AdminUserRecord[]> {
  const usersMap = new Map<string, AdminUserRecord>()

  try {
    // 1. Fetch live profiles directly from Supabase user_profiles table (Single Source of Truth)
    const { data: dbProfiles } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    // 2. Aggregate live referral stats for each user
    const { data: allReferrals } = await supabase.from('referrals').select('*')
    const refStatsMap = new Map<string, { count: number; earnings: number }>()

    if (allReferrals && allReferrals.length > 0) {
      allReferrals.forEach((ref) => {
        const key = ref.referrer_user_id
        if (key) {
          const prev = refStatsMap.get(key) || { count: 0, earnings: 0 }
          const isApproved = ref.status === 'APPROVED' || ref.status === 'SUCCESS'
          refStatsMap.set(key, {
            count: prev.count + (isApproved ? 1 : 0),
            earnings: prev.earnings + (isApproved ? Number(ref.commission_amount || 10) : 0),
          })
        }
      })
    }

    if (dbProfiles && dbProfiles.length > 0) {
      dbProfiles.forEach((u) => {
        const emailKey = (u.email || '').toLowerCase()
        if (emailKey) {
          const stats = refStatsMap.get(u.id) || { count: 0, earnings: 0 }

          usersMap.set(emailKey, {
            id: u.id,
            name: u.full_name || emailKey.split('@')[0],
            email: u.email,
            mobile: u.phone || 'N/A',
            subscriptionStatus: (u.subscription_status as any) || 'PREMIUM',
            subscriptionExpiry: u.subscription_expiry ? new Date(u.subscription_expiry).toISOString().split('T')[0] : '2027-12-31',
            referralCode: u.referral_code, // Single Source of Truth DB Field
            referredUsersCount: stats.count,
            totalReferralEarnings: stats.earnings,
            accountStatus: (u.account_status as any) || 'ACTIVE',
            signupDate: u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            lastLogin: u.last_login ? new Date(u.last_login).toLocaleString() : new Date().toLocaleString(), // Single Source of Truth DB Field
            lastLoginIp: u.last_login_ip || '127.0.0.1',
          })
        }
      })
    }
  } catch (err) {
    console.warn('Supabase getAdminUsers notice:', err)
  }

  // 3. Merge cached profiles (if any) matching exact canonical DB fields
  try {
    const cached = JSON.parse(localStorage.getItem('live_users_cache') || '[]')
    if (Array.isArray(cached)) {
      cached.forEach((c: any) => {
        const emailKey = (c.email || '').toLowerCase()
        if (emailKey && !usersMap.has(emailKey)) {
          usersMap.set(emailKey, {
            id: c.id || `user_${Date.now()}`,
            name: c.name || emailKey.split('@')[0],
            email: c.email,
            mobile: c.phone || 'N/A',
            subscriptionStatus: 'PREMIUM',
            subscriptionExpiry: '2027-12-31',
            referralCode: c.referralCode,
            referredUsersCount: c.successfulReferrals || 0,
            totalReferralEarnings: c.totalEarnings || 0,
            accountStatus: 'ACTIVE',
            signupDate: c.createdAt || new Date().toISOString().split('T')[0],
            lastLogin: c.lastLogin || new Date().toLocaleString(),
            lastLoginIp: '127.0.0.1',
          })
        }
      })
    }
  } catch {}

  const result = Array.from(usersMap.values())
  console.log('[Single Source of Truth Admin Sync] Total Admin Users Loaded:', result.length)
  return result
}

/**
 * Fetch Live Payments from Supabase (0 fallback)
 */
export async function getAdminTransactions(): Promise<PaymentTransaction[]> {
  try {
    const { data: dbPayments, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && dbPayments && dbPayments.length > 0) {
      return dbPayments.map((p) => ({
        id: p.id,
        transactionId: p.transaction_id,
        userName: p.user_name || 'User',
        email: p.user_email || 'n/a',
        amount: Number(p.amount),
        gateway: p.payment_gateway || 'Razorpay',
        status: p.payment_status || 'SUCCESS',
        plan: p.plan_name || 'Premium Plan',
        date: new Date(p.created_at).toLocaleString(),
      }))
    }
  } catch (err) {
    console.warn('Supabase getAdminTransactions notice:', err)
  }

  return []
}

/**
 * Fetch Live Withdrawals from Supabase (0 fallback)
 */
export async function getAdminWithdrawals(): Promise<WithdrawalRecord[]> {
  try {
    const { data: dbWithdrawals, error } = await supabase
      .from('withdrawals')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && dbWithdrawals && dbWithdrawals.length > 0) {
      return dbWithdrawals.map((w) => ({
        id: w.id,
        requestId: w.request_id,
        userName: w.user_name || 'User',
        email: w.user_email || 'n/a',
        amount: Number(w.amount),
        paymentDetails: `${w.payment_method || 'UPI'}: ${w.upi_id}`,
        status: w.status || 'PENDING',
        requestDate: new Date(w.created_at).toISOString().split('T')[0],
        adminNotes: w.admin_notes,
        paymentRefId: w.payment_ref_id,
      }))
    }
  } catch (err) {
    console.warn('Supabase getAdminWithdrawals notice:', err)
  }

  return []
}

/**
 * Fetch User Login History from Supabase
 */
export async function getUserLoginHistory(userId: string): Promise<UserLoginRecord[]> {
  try {
    const { data: dbHistory, error } = await supabase
      .from('user_login_history')
      .select('*')
      .eq('user_id', userId)
      .order('login_time', { ascending: false })

    if (!error && dbHistory && dbHistory.length > 0) {
      return dbHistory.map((h) => ({
        id: h.id,
        loginTime: new Date(h.login_time).toLocaleString(),
        ipAddress: h.ip_address || '127.0.0.1',
        device: h.device || 'Desktop',
        browser: h.browser || 'Browser',
      }))
    }
  } catch {}

  return [
    {
      id: 'lh_1',
      loginTime: new Date().toLocaleString(),
      ipAddress: '127.0.0.1',
      device: 'Mobile/Desktop',
      browser: 'Chrome/Safari',
    },
  ]
}

/**
 * Toggle User Account Status
 */
export async function toggleUserStatus(userId: string, currentStatus: string) {
  const newStatus = currentStatus === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE'
  try {
    await supabase.from('user_profiles').update({ account_status: newStatus }).eq('id', userId)
  } catch {}
}

/**
 * Update Withdrawal Request Status
 */
export async function updateWithdrawalStatus(
  id: string,
  newStatus: 'APPROVED' | 'REJECTED' | 'PAID',
  adminNotes?: string,
  paymentRefId?: string
) {
  try {
    await supabase
      .from('withdrawals')
      .update({
        status: newStatus,
        admin_notes: adminNotes,
        payment_ref_id: paymentRefId,
        processed_at: new Date().toISOString(),
      })
      .eq('id', id)
  } catch {}
}

/**
 * Subscribe to Supabase Realtime Changes
 */
export function subscribeToAdminRealtimeUpdates(onUpdate: () => void) {
  const channel = supabase
    .channel('admin_realtime_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => onUpdate())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => onUpdate())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => onUpdate())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'referrals' }, () => onUpdate())
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * CSV Downloader
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.map((cell) => `"${cell}"`).join(','))].join('\n')

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
