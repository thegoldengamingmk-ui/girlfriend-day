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

/**
 * Fetch Live Users from Supabase database (0 fallback)
 */
export async function getAdminUsers(): Promise<AdminUserRecord[]> {
  try {
    const { data: dbProfiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && dbProfiles && dbProfiles.length > 0) {
      return dbProfiles.map((u) => ({
        id: u.id,
        name: u.full_name || 'User',
        email: u.email,
        mobile: u.phone || 'N/A',
        subscriptionStatus: u.subscription_status || 'FREE',
        subscriptionExpiry: u.subscription_expiry ? new Date(u.subscription_expiry).toISOString().split('T')[0] : 'N/A',
        referralCode: u.referral_code || 'N/A',
        referredUsersCount: 0,
        totalReferralEarnings: 0,
        accountStatus: u.account_status || 'ACTIVE',
        signupDate: u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : 'Today',
        lastLogin: u.last_login ? new Date(u.last_login).toLocaleString() : 'N/A',
        lastLoginIp: u.last_login_ip || '127.0.0.1',
      }))
    }
  } catch (err) {
    console.warn('Supabase getAdminUsers notice:', err)
  }

  // Check cache for locally created accounts during testing
  try {
    const cached = JSON.parse(localStorage.getItem('live_users_cache') || '[]')
    if (cached.length > 0) {
      return cached.map((c: any) => ({
        id: c.id,
        name: c.name || c.email.split('@')[0],
        email: c.email,
        mobile: c.phone || 'N/A',
        subscriptionStatus: 'PREMIUM',
        subscriptionExpiry: '2027-07-28',
        referralCode: c.referralCode,
        referredUsersCount: 0,
        totalReferralEarnings: 0,
        accountStatus: 'ACTIVE',
        signupDate: new Date().toISOString().split('T')[0],
        lastLogin: new Date().toLocaleString(),
        lastLoginIp: '127.0.0.1',
      }))
    }
  } catch {}

  return []
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
