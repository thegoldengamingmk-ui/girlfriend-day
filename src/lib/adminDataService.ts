import { supabase } from './supabase'

export interface AdminUserRecord {
  id: string
  firebaseUid?: string
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

/**
 * Single Source of Truth Admin Users Query
 * Reads primary users table and joins referral_stats & wallets in Supabase database.
 */
export async function getAdminUsers(): Promise<AdminUserRecord[]> {
  const usersMap = new Map<string, AdminUserRecord>()

  try {
    // 1. Query primary users table
    const { data: primaryUsers } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    // 2. Query legacy/compatibility user_profiles table
    const { data: profileUsers } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    // 3. Query referral_stats table
    const { data: refStatsList } = await supabase.from('referral_stats').select('*')
    const refStatsMap = new Map<string, { count: number; earnings: number }>()

    if (refStatsList && refStatsList.length > 0) {
      refStatsList.forEach((s) => {
        refStatsMap.set(s.user_id, {
          count: Number(s.successful_referrals || 0),
          earnings: Number(s.referral_earnings || 0),
        })
      })
    }

    // 4. Query wallets table
    const { data: walletList } = await supabase.from('wallets').select('*')
    const walletMap = new Map<string, number>()
    if (walletList && walletList.length > 0) {
      walletList.forEach((w) => {
        walletMap.set(w.user_id, Number(w.total_earned || 0))
      })
    }

    // Populate primary users
    if (primaryUsers && primaryUsers.length > 0) {
      primaryUsers.forEach((u) => {
        const emailKey = (u.email || '').toLowerCase()
        if (emailKey) {
          const stats = refStatsMap.get(u.id) || { count: 0, earnings: 0 }
          const walletEarned = walletMap.get(u.id) || stats.earnings

          usersMap.set(emailKey, {
            id: u.id,
            firebaseUid: u.firebase_uid,
            name: u.display_name || u.email.split('@')[0],
            email: u.email,
            mobile: 'N/A',
            subscriptionStatus: 'PREMIUM',
            subscriptionExpiry: '2027-12-31',
            referralCode: u.referral_code, // Canonical DB Field
            referredUsersCount: stats.count,
            totalReferralEarnings: walletEarned,
            accountStatus: (u.status as any) === 'blocked' ? 'BLOCKED' : 'ACTIVE',
            signupDate: u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            lastLogin: u.last_login ? new Date(u.last_login).toLocaleString() : new Date().toLocaleString(), // Canonical DB Field
            lastLoginIp: '127.0.0.1',
          })
        }
      })
    }

    // Populate user_profiles table records if not already in usersMap
    if (profileUsers && profileUsers.length > 0) {
      profileUsers.forEach((u) => {
        const emailKey = (u.email || '').toLowerCase()
        if (emailKey && !usersMap.has(emailKey)) {
          const stats = refStatsMap.get(u.id) || { count: 0, earnings: 0 }
          usersMap.set(emailKey, {
            id: u.id,
            name: u.full_name || emailKey.split('@')[0],
            email: u.email,
            mobile: u.phone || 'N/A',
            subscriptionStatus: 'PREMIUM',
            subscriptionExpiry: '2027-12-31',
            referralCode: u.referral_code,
            referredUsersCount: stats.count,
            totalReferralEarnings: stats.earnings,
            accountStatus: u.account_status === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
            signupDate: u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            lastLogin: u.last_login ? new Date(u.last_login).toLocaleString() : new Date().toLocaleString(),
            lastLoginIp: '127.0.0.1',
          })
        }
      })
    }
  } catch (err) {
    console.warn('Supabase getAdminUsers notice:', err)
  }

  // Fallback check against local backup registry
  try {
    const backupRegistry = JSON.parse(localStorage.getItem('canonical_users_backup_registry') || '{}')
    Object.values(backupRegistry).forEach((c: any) => {
      const emailKey = (c.email || '').toLowerCase()
      if (emailKey && !usersMap.has(emailKey)) {
        usersMap.set(emailKey, {
          id: c.id || `user_${Date.now()}`,
          firebaseUid: c.firebaseUid,
          name: c.displayName || c.name || emailKey.split('@')[0],
          email: c.email,
          mobile: 'N/A',
          subscriptionStatus: 'PREMIUM',
          subscriptionExpiry: '2027-12-31',
          referralCode: c.referralCode,
          referredUsersCount: c.referralStats?.successfulReferrals || 0,
          totalReferralEarnings: c.wallet?.totalEarned || 0,
          accountStatus: 'ACTIVE',
          signupDate: c.createdAt || new Date().toISOString().split('T')[0],
          lastLogin: c.lastLogin || new Date().toLocaleString(),
          lastLoginIp: '127.0.0.1',
        })
      }
    })
  } catch {}

  const result = Array.from(usersMap.values())
  console.log('[Single Source Admin Query] Loaded Total Users:', result.length)
  return result
}

/**
 * Fetch Live Payments from Supabase (0 fallback)
 */
export async function getAdminTransactions(): Promise<PaymentTransaction[]> {
  try {
    const { data: usersList } = await supabase.from('users').select('id, email, display_name')
    const userMap = new Map<string, { email: string; name: string }>()
    if (usersList && usersList.length > 0) {
      usersList.forEach((u) => {
        userMap.set(u.id, { email: u.email, name: u.display_name || u.email.split('@')[0] })
      })
    }

    const { data: dbPayments, error: pErr } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })

    if (pErr) console.warn('[Admin Payments Query Warning]:', pErr)

    if (dbPayments && dbPayments.length > 0) {
      return dbPayments.map((p) => {
        const uInfo = userMap.get(p.user_id) || { email: p.user_email || 'n/a', name: p.user_name || 'User' }
        return {
          id: p.id,
          transactionId: p.razorpay_payment_id || p.payment_id || p.id,
          userName: uInfo.name,
          email: uInfo.email,
          amount: Number(p.amount || 0),
          gateway: p.payment_method || 'Razorpay',
          status: (p.status || 'Captured').toUpperCase() === 'CAPTURED' ? 'SUCCESS' : 'FAILED',
          plan: 'Premium Surprise Website',
          date: p.created_at ? new Date(p.created_at).toLocaleString() : new Date().toLocaleString(),
        }
      })
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
    const { data: usersList } = await supabase.from('users').select('id, email, display_name')
    const userMap = new Map<string, { email: string; name: string }>()
    if (usersList && usersList.length > 0) {
      usersList.forEach((u) => {
        userMap.set(u.id, { email: u.email, name: u.display_name || u.email.split('@')[0] })
      })
    }

    const { data: dbWithdrawals, error: wErr } = await supabase
      .from('withdrawals')
      .select('*')
      .order('created_at', { ascending: false })

    if (wErr) console.warn('[Admin Withdrawals Query Warning]:', wErr)

    if (dbWithdrawals && dbWithdrawals.length > 0) {
      return dbWithdrawals.map((w) => {
        const uInfo = userMap.get(w.user_id) || { email: w.user_email || 'n/a', name: w.user_name || 'User' }
        return {
          id: w.id,
          requestId: w.withdrawal_id || w.request_id || `WD-${w.id.slice(0, 6)}`,
          userName: uInfo.name,
          email: uInfo.email,
          amount: Number(w.amount || 0),
          paymentDetails: w.payment_details || `UPI: ${w.upi_id || 'N/A'}`,
          status: (w.status || 'PENDING').toUpperCase() as any,
          requestDate: w.created_at ? new Date(w.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          adminNotes: w.admin_notes || '',
          paymentRefId: w.transaction_id || '',
        }
      })
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
    await supabase.from('users').update({ status: newStatus.toLowerCase() }).eq('id', userId)
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => onUpdate())
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
