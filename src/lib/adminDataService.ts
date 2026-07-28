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

export interface CMSContent {
  heroTitle: string
  heroSubtitle: string
  planPriceDefault: number
  planPriceReferral: number
  features: string[]
  faqs: { question: string; answer: string }[]
  testimonials: { name: string; text: string; rating: number }[]
}

// Default Mock System Data
const INITIAL_USERS: AdminUserRecord[] = [
  {
    id: 'usr_101',
    name: 'Rohan Sharma',
    email: 'rohan.s@gmail.com',
    mobile: '+91 9876543210',
    subscriptionStatus: 'PREMIUM',
    subscriptionExpiry: '2027-07-28',
    referralCode: 'GF-LOVE-8912',
    referredUsersCount: 4,
    totalReferralEarnings: 40,
    accountStatus: 'ACTIVE',
    signupDate: '2026-07-28',
  },
  {
    id: 'usr_102',
    name: 'Ananya Verma',
    email: 'ananya.v@yahoo.com',
    mobile: '+91 9812345678',
    subscriptionStatus: 'PREMIUM',
    subscriptionExpiry: '2027-07-27',
    referralCode: 'GF-LOVE-5521',
    referredUsersCount: 2,
    totalReferralEarnings: 20,
    accountStatus: 'ACTIVE',
    signupDate: '2026-07-27',
  },
  {
    id: 'usr_103',
    name: 'Vikram Singh',
    email: 'vikram.singh@hotmail.com',
    mobile: '+91 9765432109',
    subscriptionStatus: 'FREE',
    subscriptionExpiry: 'N/A',
    referralCode: 'GF-LOVE-1102',
    referredUsersCount: 0,
    totalReferralEarnings: 0,
    accountStatus: 'ACTIVE',
    signupDate: '2026-07-26',
  },
  {
    id: 'usr_104',
    name: 'Priya Malhotra',
    email: 'priya.m@outlook.com',
    mobile: '+91 9988776655',
    subscriptionStatus: 'EXPIRED',
    subscriptionExpiry: '2026-07-01',
    referralCode: 'GF-LOVE-3344',
    referredUsersCount: 1,
    totalReferralEarnings: 10,
    accountStatus: 'BLOCKED',
    signupDate: '2026-06-15',
  },
]

const INITIAL_TRANSACTIONS: PaymentTransaction[] = [
  {
    id: 'pay_1',
    transactionId: 'pay_RZP_99214812',
    userName: 'Rohan Sharma',
    email: 'rohan.s@gmail.com',
    amount: 49,
    gateway: 'Razorpay',
    status: 'SUCCESS',
    plan: 'Premium Gift Plan (50% OFF)',
    date: '2026-07-28 14:22',
  },
  {
    id: 'pay_2',
    transactionId: 'pay_RZP_88127364',
    userName: 'Ananya Verma',
    email: 'ananya.v@yahoo.com',
    amount: 99,
    gateway: 'Razorpay',
    status: 'SUCCESS',
    plan: 'Premium Gift Plan',
    date: '2026-07-27 18:10',
  },
  {
    id: 'pay_3',
    transactionId: 'pay_RZP_77615243',
    userName: 'Vikram Singh',
    email: 'vikram.singh@hotmail.com',
    amount: 49,
    gateway: 'Razorpay',
    status: 'FAILED',
    plan: 'Premium Gift Plan',
    date: '2026-07-26 11:05',
  },
]

const INITIAL_WITHDRAWALS: WithdrawalRecord[] = [
  {
    id: 'wd_1',
    requestId: 'REQ-WDR-9921',
    userName: 'Rohan Sharma',
    email: 'rohan.s@gmail.com',
    amount: 150,
    paymentDetails: 'UPI: rohan@upi',
    status: 'PENDING',
    requestDate: '2026-07-28',
    adminNotes: 'Awaiting Bank Settlement',
  },
  {
    id: 'wd_2',
    requestId: 'REQ-WDR-8812',
    userName: 'Ananya Verma',
    email: 'ananya.v@yahoo.com',
    amount: 100,
    paymentDetails: 'Bank: HDFC (Acc: 98127341, IFSC: HDFC0001234)',
    status: 'PAID',
    requestDate: '2026-07-20',
    paymentRefId: 'UPI/66128471/SETTLED',
    adminNotes: 'Transferred via IMPS',
  },
]

/**
 * Fetch Users
 */
export function getAdminUsers(): AdminUserRecord[] {
  try {
    const cached = localStorage.getItem('admin_users_data')
    if (cached) return JSON.parse(cached)
  } catch {}
  return INITIAL_USERS
}

/**
 * Update User Status (Block/Unblock)
 */
export function toggleUserStatus(userId: string): AdminUserRecord[] {
  const users = getAdminUsers().map((u) => {
    if (u.id === userId) {
      return {
        ...u,
        accountStatus: u.accountStatus === 'ACTIVE' ? ('BLOCKED' as const) : ('ACTIVE' as const),
      }
    }
    return u
  })
  localStorage.setItem('admin_users_data', JSON.stringify(users))
  return users
}

/**
 * Fetch Transactions
 */
export function getAdminTransactions(): PaymentTransaction[] {
  try {
    const cached = localStorage.getItem('admin_transactions_data')
    if (cached) return JSON.parse(cached)
  } catch {}
  return INITIAL_TRANSACTIONS
}

/**
 * Fetch Withdrawals Queue
 */
export function getAdminWithdrawals(): WithdrawalRecord[] {
  try {
    const cached = localStorage.getItem('admin_withdrawals_data')
    if (cached) return JSON.parse(cached)
  } catch {}
  return INITIAL_WITHDRAWALS
}

/**
 * Update Withdrawal Status
 */
export function updateWithdrawalStatus(
  id: string,
  newStatus: 'APPROVED' | 'REJECTED' | 'PAID',
  adminNotes?: string,
  paymentRefId?: string
): WithdrawalRecord[] {
  const records = getAdminWithdrawals().map((w) => {
    if (w.id === id) {
      return {
        ...w,
        status: newStatus,
        adminNotes: adminNotes || w.adminNotes,
        paymentRefId: paymentRefId || w.paymentRefId,
      }
    }
    return w
  })
  localStorage.setItem('admin_withdrawals_data', JSON.stringify(records))
  return records
}

/**
 * Export CSV Helper
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
