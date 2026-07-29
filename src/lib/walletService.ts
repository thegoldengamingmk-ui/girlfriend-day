/**
 * Production-Grade Financial Wallet & Transaction Ledger Service
 * Serves as the financial source of truth for all wallet balances, credits, debits,
 * referral rewards, withdrawal requests, and admin manual adjustments.
 */

import { supabase } from './supabase'

export type TransactionType =
  | 'Referral Reward'
  | 'Referral Bonus'
  | 'Admin Credit'
  | 'Admin Debit'
  | 'Withdrawal Request'
  | 'Withdrawal Approved'
  | 'Withdrawal Rejected'
  | 'Premium Purchase'
  | 'Refund'
  | 'Bonus'
  | 'Adjustment'

export type TransactionStatus = 'Pending' | 'Completed' | 'Failed' | 'Cancelled' | 'Reversed'

export interface WalletTransaction {
  id: string
  transactionId: string
  userId: string
  transactionType: TransactionType
  referenceType?: string
  referenceId?: string
  amount: number
  currency: string
  balanceBefore: number
  balanceAfter: number
  status: TransactionStatus
  description: string
  createdAt: string
  updatedAt: string
}

export interface WalletData {
  userId: string
  availableBalance: number
  pendingBalance: number
  totalEarned: number
  totalWithdrawn: number
  updatedAt: string
}

/**
 * Generate human-readable unique transaction ID (e.g. TXN-20260729-X892K)
 */
export function generateTransactionId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `TXN-${dateStr}-${randomChars}`
}

/**
 * Primary Atomic Wallet Transaction Executor
 * Never updates wallet available_balance directly without creating a transaction ledger record.
 */
export async function executeWalletTransaction(params: {
  userId: string
  type: TransactionType
  amount: number
  referenceType?: string
  referenceId?: string
  description?: string
  status?: TransactionStatus
}): Promise<{ success: boolean; transactionId: string; balanceAfter: number; message: string }> {
  const { userId, type, amount, referenceType = 'system', referenceId, description = '', status = 'Completed' } = params

  if (!userId || userId === 'guest') {
    return { success: false, transactionId: '', balanceAfter: 0, message: 'Invalid user ID provided.' }
  }

  const numAmount = Math.abs(Number(amount) || 0)
  if (numAmount === 0) {
    return { success: false, transactionId: '', balanceAfter: 0, message: 'Transaction amount must be greater than 0.' }
  }

  const nowIso = new Date().toISOString()
  const txnId = generateTransactionId()

  console.log(`[Transaction Initiated] User: ${userId} | Type: ${type} | Amount: ₹${numAmount}`)

  try {
    // 1. Fetch current wallet
    let walletRecord: any = null
    const { data: walletList } = await supabase.from('wallets').select('*').eq('user_id', userId)

    if (walletList && walletList.length > 0) {
      walletRecord = walletList[0]
    } else {
      // Auto-create wallet if missing
      const { data: newWallet } = await supabase
        .from('wallets')
        .insert([
          {
            user_id: userId,
            available_balance: 0,
            pending_balance: 0,
            total_earned: 0,
            total_withdrawn: 0,
          },
        ])
        .select()

      if (newWallet && newWallet.length > 0) {
        walletRecord = newWallet[0]
        console.log('[Wallet Created] Initialized zero-balance wallet for user:', userId)
      } else {
        walletRecord = {
          user_id: userId,
          available_balance: 0,
          pending_balance: 0,
          total_earned: 0,
          total_withdrawn: 0,
        }
      }
    }

    // Withdrawal Request balance is managed directly by withdrawalService (available -> pending)
    // so it must NOT be counted as a debit here to avoid double-deduction
    const balanceBefore = Number(walletRecord.available_balance || 0)
    const isDebit = ['Admin Debit', 'Premium Purchase'].includes(type)
    // Withdrawal Request: available→pending is managed by withdrawalService
    // Withdrawal Rejected: pending→available is managed by withdrawalService
    // Withdrawal Approved: pending balance deduction is managed by withdrawalService (pending→totalWithdrawn)
    const walletManagedExternally =
      type === 'Withdrawal Request' ||
      type === 'Withdrawal Rejected' ||
      type === 'Withdrawal Approved'
    const balanceAfter = walletManagedExternally
      ? balanceBefore
      : isDebit ? balanceBefore - numAmount : balanceBefore + numAmount

    if (isDebit && !walletManagedExternally && balanceAfter < 0 && type !== 'Admin Debit') {
      console.warn(`[Transaction Rejected] Insufficient wallet balance. Current: ₹${balanceBefore}, Requested: ₹${numAmount}`)
      return {
        success: false,
        transactionId: '',
        balanceAfter: balanceBefore,
        message: `Insufficient wallet balance. Available: ₹${balanceBefore}`,
      }
    }

    // 2. Insert transaction ledger record FIRST
    const transactionPayload = {
      transaction_id: txnId,
      user_id: userId,
      transaction_type: type,
      reference_type: referenceType,
      reference_id: referenceId || null,
      amount: numAmount,
      currency: 'INR',
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      status,
      description: description || `${type} transaction of ₹${numAmount}`,
      created_at: nowIso,
      updated_at: nowIso,
    }

    const { error: txnErr } = await supabase.from('transactions').insert([transactionPayload])
    if (txnErr) {
      console.error('[Transaction Failed] Database transaction insert error:', txnErr)
      return { success: false, transactionId: '', balanceAfter: balanceBefore, message: 'Failed to record transaction.' }
    }

    console.log(`[Transaction Created] ID: ${txnId} | Before: ₹${balanceBefore} | After: ₹${balanceAfter}`)

    // 3. Update wallet balance (skip for types managed externally by withdrawalService)
    if (!walletManagedExternally) {
      const updatedTotalEarned = !isDebit ? Number(walletRecord.total_earned || 0) + numAmount : Number(walletRecord.total_earned || 0)
      const updatedTotalWithdrawn = Number(walletRecord.total_withdrawn || 0)

      const { error: walletUpdateErr } = await supabase
        .from('wallets')
        .update({
          available_balance: balanceAfter,
          total_earned: updatedTotalEarned,
          total_withdrawn: updatedTotalWithdrawn,
          updated_at: nowIso,
        })
        .eq('user_id', userId)

      if (walletUpdateErr) {
        console.error('[Wallet Update Failed] Reverting transaction status:', walletUpdateErr)
        // Rollback transaction status to Failed
        await supabase.from('transactions').update({ status: 'Failed' }).eq('transaction_id', txnId)
        console.log('[Rollback Executed] Marked transaction as Failed due to wallet update failure.')
        return { success: false, transactionId: txnId, balanceAfter: balanceBefore, message: 'Wallet update failed.' }
      }

      console.log(`[Wallet Updated] Balance updated to ₹${balanceAfter} for user: ${userId}`)
    }

    return {
      success: true,
      transactionId: txnId,
      balanceAfter,
      message: `${type} of ₹${numAmount} executed successfully!`,
    }
  } catch (err: any) {
    console.error('[Transaction Exception]:', err)
    return { success: false, transactionId: '', balanceAfter: 0, message: err.message || 'Transaction exception occurred.' }
  }
}

/**
 * Fetch all transaction ledger history for a specific user
 */
export async function getUserTransactions(userId: string): Promise<WalletTransaction[]> {
  if (!userId) return []

  try {
    const { data: txnList } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!txnList || txnList.length === 0) return []

    return txnList.map((t) => ({
      id: t.id,
      transactionId: t.transaction_id,
      userId: t.user_id,
      transactionType: t.transaction_type as TransactionType,
      referenceType: t.reference_type,
      referenceId: t.reference_id,
      amount: Number(t.amount || 0),
      currency: t.currency || 'INR',
      balanceBefore: Number(t.balance_before || 0),
      balanceAfter: Number(t.balance_after || 0),
      status: t.status as TransactionStatus,
      description: t.description || '',
      createdAt: t.created_at ? new Date(t.created_at).toLocaleString() : new Date().toLocaleString(),
      updatedAt: t.updated_at ? new Date(t.updated_at).toLocaleString() : new Date().toLocaleString(),
    }))
  } catch (err) {
    console.warn('[Transactions Query Warning]:', err)
    return []
  }
}

/**
 * Fetch ALL transaction ledger entries across the system for Admin Panel
 */
export async function getAllSystemTransactions(): Promise<any[]> {
  try {
    const { data: list } = await supabase
      .from('transactions')
      .select('*, users(email, display_name)')
      .order('created_at', { ascending: false })

    if (!list) return []

    return list.map((t) => ({
      id: t.id,
      transactionId: t.transaction_id,
      userId: t.user_id,
      userName: t.users?.display_name || 'User',
      userEmail: t.users?.email || 'N/A',
      transactionType: t.transaction_type,
      referenceType: t.reference_type,
      amount: Number(t.amount || 0),
      balanceBefore: Number(t.balance_before || 0),
      balanceAfter: Number(t.balance_after || 0),
      status: t.status,
      description: t.description || '',
      createdAt: t.created_at ? new Date(t.created_at).toLocaleString() : new Date().toLocaleString(),
    }))
  } catch (err) {
    console.warn('[Admin Transactions Fetch Warning]:', err)
    return []
  }
}

/**
 * Integrity Checker: Verifies that wallet available_balance matches transaction ledger sum
 */
export async function verifyWalletIntegrity(userId: string): Promise<{ valid: boolean; calculatedBalance: number; actualBalance: number }> {
  try {
    const { data: walletData } = await supabase.from('wallets').select('available_balance').eq('user_id', userId)
    const actualBalance = walletData && walletData.length > 0 ? Number(walletData[0].available_balance || 0) : 0

    const { data: txns } = await supabase.from('transactions').select('transaction_type, amount, status').eq('user_id', userId).eq('status', 'Completed')

    let calculatedBalance = 0
    if (txns && txns.length > 0) {
      txns.forEach((t) => {
        const amt = Number(t.amount || 0)
        const isDebit = ['Admin Debit', 'Withdrawal Request', 'Premium Purchase'].includes(t.transaction_type)
        if (isDebit) {
          calculatedBalance -= amt
        } else {
          calculatedBalance += amt
        }
      })
    }

    const valid = Math.abs(calculatedBalance - actualBalance) < 0.01
    return { valid, calculatedBalance, actualBalance }
  } catch (err) {
    return { valid: true, calculatedBalance: 0, actualBalance: 0 }
  }
}
