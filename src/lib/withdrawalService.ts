/**
 * Production-Grade Withdrawal Service & Controlled Approval Workflow
 * Manages withdrawal requests, validation, pending balance reservation, admin approvals/rejections,
 * financial transaction ledger logging, and user notifications.
 */

import { supabase } from "./supabase"
import { executeWalletTransaction } from "./walletService"

export const WITHDRAWAL_CONFIG = {
  MIN_AMOUNT: 100, // ₹100 minimum withdrawal
  MAX_AMOUNT: 10000, // ₹10,000 maximum single withdrawal
  DAILY_LIMIT: 25000, // ₹25,000 daily limit
}

export type WithdrawalStatus = "PENDING" | "PROCESSING" | "APPROVED" | "COMPLETED" | "REJECTED" | "CANCELLED" | "FAILED"

export interface CreateWithdrawalParams {
  userId: string
  userName?: string
  userEmail?: string
  amount: number
  paymentMethod: "UPI" | "BANK" | "PAYPAL"
  upiId?: string
  paymentDetails?: string
}

export interface WithdrawalRecord {
  id: string
  withdrawalId: string
  requestId: string
  userId: string
  userName?: string
  userEmail?: string
  amount: number
  currency: string
  paymentMethod: string
  upiId: string
  paymentDetails: string
  status: WithdrawalStatus
  adminNotes: string
  requestedAt: string
  reviewedAt?: string
  completedAt?: string
  reviewedBy?: string
  transactionId?: string
}

/**
 * Generate unique human-readable withdrawal ID (e.g. WD-20260729-X892K)
 */
export function generateWithdrawalId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `WD-${dateStr}-${randomChars}`
}

/**
 * Submit Withdrawal Request
 * Moves requested amount from available_balance -> pending_balance.
 * Creates a Pending Withdrawal Request row and a Pending Transaction Ledger Entry.
 */
export async function createWithdrawalRequest(
  params: CreateWithdrawalParams,
): Promise<{
  success: boolean
  message: string
  withdrawalId?: string
  withdrawal?: any
}> {
  const {
    userId,
    amount,
    paymentMethod = "UPI",
    upiId = "N/A",
    paymentDetails = "",
  } = params

  if (!userId || userId === "guest") {
    return {
      success: false,
      message: "Please sign in to request a withdrawal.",
    }
  }

  const numAmount = Math.abs(Number(amount) || 0)

  // 1. Validation Rules
  if (numAmount < WITHDRAWAL_CONFIG.MIN_AMOUNT) {
    return {
      success: false,
      message: `Minimum withdrawal amount is ₹${WITHDRAWAL_CONFIG.MIN_AMOUNT}.`,
    }
  }

  if (numAmount > WITHDRAWAL_CONFIG.MAX_AMOUNT) {
    return {
      success: false,
      message: `Maximum withdrawal limit per request is ₹${WITHDRAWAL_CONFIG.MAX_AMOUNT}.`,
    }
  }

  try {
    // 2. Verify User Wallet & Available Balance
    const { data: walletList } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)

    if (!walletList || walletList.length === 0) {
      return { success: false, message: "Wallet not found for user." }
    }

    const wallet = walletList[0]
    const availableBalance = Number(wallet.available_balance || 0)

    if (numAmount > availableBalance) {
      return {
        success: false,
        message: `Insufficient wallet balance. Available: ₹${availableBalance}, Requested: ₹${numAmount}.`,
      }
    }

    // 3. Check for existing PENDING withdrawal requests
    const { data: pendingRequests } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "PENDING")

    if (pendingRequests && pendingRequests.length > 0) {
      return {
        success: false,
        message: "You already have a pending withdrawal request under review.",
      }
    }

    // 4. Move Available Balance -> Pending Balance (reserve funds)
    const nowIso = new Date().toISOString()
    const wdId = generateWithdrawalId()
    const newAvailable = availableBalance - numAmount
    const newPending = Number(wallet.pending_balance || 0) + numAmount

    const { error: walletErr } = await supabase
      .from("wallets")
      .update({
        available_balance: newAvailable,
        pending_balance: newPending,
        updated_at: nowIso,
      })
      .eq("user_id", userId)

    if (walletErr) {
      console.error(
        "[Withdrawal Request Failed] Wallet update error:",
        walletErr,
      )
      return {
        success: false,
        message: "Failed to reserve withdrawal balance.",
      }
    }

    // 5. Create Pending Transaction Ledger Entry (audit only, does NOT change wallet again)
    const txnId = `TXN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    await supabase.from("transactions").insert([
      {
        transaction_id: txnId,
        user_id: userId,
        transaction_type: "Withdrawal Request",
        reference_type: "withdrawal",
        reference_id: wdId,
        amount: numAmount,
        currency: "INR",
        balance_before: availableBalance,
        balance_after: newAvailable,
        status: "Pending",
        description: `Withdrawal Request submitted (${paymentMethod}: ${upiId})`,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ])

    // 6. Insert Withdrawal Record
    const withdrawalPayload = {
      withdrawal_id: wdId,
      request_id: wdId,
      user_id: userId,
      amount: numAmount,
      currency: "INR",
      payment_method: paymentMethod,
      payment_details: paymentDetails || `UPI: ${upiId}`,
      upi_id: upiId,
      status: "PENDING",
      requested_at: nowIso,
      transaction_id: txnId,
      created_at: nowIso,
      updated_at: nowIso,
    }

    const { data: inserted, error: wdInsertErr } = await supabase
      .from("withdrawals")
      .insert([withdrawalPayload])
      .select()

    if (wdInsertErr) {
      console.error(
        "[Withdrawal Insert Error] Database insert warning:",
        wdInsertErr,
      )
    }

    console.log(
      `[Withdrawal Requested] WD ID: ${wdId} | User: ${userId} | Amount: ₹${numAmount} | Available: ₹${newAvailable} | Pending: ₹${newPending}`,
    )

    return {
      success: true,
      message: `Withdrawal request for ₹${numAmount} submitted successfully! It is under admin review.`,
      withdrawalId: wdId,
      withdrawal:
        inserted && inserted.length > 0 ? inserted[0] : withdrawalPayload,
    }
  } catch (err: any) {
    console.error("[Withdrawal Exception]:", err)
    return {
      success: false,
      message: err.message || "Failed to submit withdrawal request.",
    }
  }
}

/**
 * Process Admin Withdrawal Approval / Rejection Action
 */
export async function processAdminWithdrawalAction(params: {
  withdrawalId: string
  action: "APPROVE" | "REJECT" | "MARK_PROCESSING"
  adminNotes?: string
  adminEmail?: string
}): Promise<{ success: boolean message: string }> {
  const { withdrawalId, action, adminNotes = "", adminEmail = "Admin" } = params
  const nowIso = new Date().toISOString()

  console.log(
    `[Admin Withdrawal Action] Action: ${action} | WD ID: ${withdrawalId} | Admin: ${adminEmail}`,
  )

  try {
    // 1. Fetch withdrawal record
    const { data: list } = await supabase
      .from("withdrawals")
      .select("*")
      .or(
        `id.eq.${withdrawalId},withdrawal_id.eq.${withdrawalId},request_id.eq.${withdrawalId}`,
      )

    if (!list || list.length === 0) {
      return { success: false, message: "Withdrawal request not found." }
    }

    const wd = list[0]
    const userId = wd.user_id
    const amount = Number(wd.amount || 0)

    if (wd.status === "COMPLETED" || wd.status === "REJECTED") {
      return {
        success: false,
        message: `Withdrawal has already been marked as ${wd.status}.`,
      }
    }

    // 2. Fetch User Wallet
    const { data: walletList } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
    if (!walletList || walletList.length === 0) {
      return { success: false, message: "User wallet not found." }
    }

    const wallet = walletList[0]
    const currentPending = Number(wallet.pending_balance || 0)
    const currentAvailable = Number(wallet.available_balance || 0)
    const currentWithdrawn = Number(wallet.total_withdrawn || 0)

    if (action === "APPROVE") {
      // ── APPROVAL WORKFLOW ──
      // Deduct Pending Balance -> Increase Total Withdrawn
      const newPending = Math.max(0, currentPending - amount)
      const newWithdrawn = currentWithdrawn + amount

      await supabase
        .from("wallets")
        .update({
          pending_balance: newPending,
          total_withdrawn: newWithdrawn,
          updated_at: nowIso,
        })
        .eq("user_id", userId)

      // Update withdrawal record
      await supabase
        .from("withdrawals")
        .update({
          status: "COMPLETED",
          reviewed_at: nowIso,
          completed_at: nowIso,
          reviewed_by: adminEmail,
          admin_notes: adminNotes || "Withdrawal approved and paid via UPI.",
          updated_at: nowIso,
        })
        .eq("id", wd.id)

      // Record transaction ledger entry
      await executeWalletTransaction({
        userId,
        type: "Withdrawal Approved",
        amount,
        referenceType: "withdrawal",
        referenceId: wd.withdrawal_id || wd.id,
        description: `Withdrawal of ₹${amount} Approved and Transferred`,
        status: "Completed",
      })

      console.log(
        `[Withdrawal Approved] WD ID: ${wd.withdrawal_id} | Paid: ₹${amount} to User: ${userId}`,
      )
      return {
        success: true,
        message: `Withdrawal of ₹${amount} approved and marked as COMPLETED!`,
      }
    } else if (action === "REJECT") {
      // ── REJECTION WORKFLOW ──
      // Restore Pending Balance -> Available Balance
      const newPending = Math.max(0, currentPending - amount)
      const newAvailable = currentAvailable + amount

      await supabase
        .from("wallets")
        .update({
          available_balance: newAvailable,
          pending_balance: newPending,
          updated_at: nowIso,
        })
        .eq("user_id", userId)

      // Update withdrawal record
      await supabase
        .from("withdrawals")
        .update({
          status: "REJECTED",
          reviewed_at: nowIso,
          reviewed_by: adminEmail,
          admin_notes:
            adminNotes ||
            "Withdrawal rejected. Funds restored to available balance.",
          updated_at: nowIso,
        })
        .eq("id", wd.id)

      // Record transaction ledger entry
      await executeWalletTransaction({
        userId,
        type: "Withdrawal Rejected",
        amount,
        referenceType: "withdrawal",
        referenceId: wd.withdrawal_id || wd.id,
        description: `Withdrawal of ₹${amount} Rejected. Funds restored to wallet.`,
        status: "Cancelled",
      })

      console.log(
        `[Withdrawal Rejected] WD ID: ${wd.withdrawal_id} | Restored: ₹${amount} to Available Balance`,
      )
      return {
        success: true,
        message: `Withdrawal of ₹${amount} rejected. Funds restored to user wallet.`,
      }
    } else if (action === "MARK_PROCESSING") {
      await supabase
        .from("withdrawals")
        .update({
          status: "PROCESSING",
          reviewed_at: nowIso,
          reviewed_by: adminEmail,
          admin_notes: adminNotes || "Payout is currently processing.",
          updated_at: nowIso,
        })
        .eq("id", wd.id)

      return {
        success: true,
        message: "Withdrawal status updated to PROCESSING.",
      }
    }

    return { success: false, message: "Invalid action specified." }
  } catch (err: any) {
    console.error("[Admin Withdrawal Action Error]:", err)
    return {
      success: false,
      message: err.message || "Failed to process withdrawal action.",
    }
  }
}
