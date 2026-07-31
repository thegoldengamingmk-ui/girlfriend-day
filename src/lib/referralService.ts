import { supabase } from "./supabase"
import { getUserTransactions, WalletTransaction } from "./walletService"
import {
  signUpUser,
  signInUser,
  verifyEmailCode,
  resendVerificationEmail,
} from "./authService"
import {
  syncFirebaseUserWithDatabase,
  buildReferralLink,
  generateUniqueReferralCode,
  validateAndApplyReferralCode,
} from "./userService"

export async function signUpUserWithEmail(email: string, password: string) {
  return signUpUser("", email, password)
}

export async function sendEmailOtp(email: string) {
  return resendVerificationEmail(email)
}

export async function verifyEmailOtpToken(
  email: string,
  token: string,
  type: any = "signup",
) {
  return verifyEmailCode(email, token)
}

export async function signInUserWithPassword(email: string, password: string) {
  return signInUser(email, password)
}

export async function sendPasswordResetOtp(email: string) {
  // Auth is handled via Google Sign-In (Firebase). Supabase email/password
  // auth is not used. Password reset is not applicable for Google-only accounts.
  throw new Error(
    "Password reset is not available. Please sign in with Google.",
  )
}

export async function updatePassword(newPassword: string) {
  // Auth is handled via Google Sign-In (Firebase). Password updates
  // are not supported for Google OAuth accounts.
  throw new Error(
    "Password update is not available. Please sign in with Google.",
  )
}

export interface UserReferralProfile {
  id: string
  firebaseUid?: string
  name: string
  email: string
  photoUrl?: string
  phone?: string
  referralCode: string
  referralLink: string
  walletBalance: number
  successfulReferrals: number
  pendingReferrals: number
  totalReferrals: number
  totalEarnings: number
  pendingWithdrawal: number
  createdAt: string
  lastLogin: string
  referralHistory: any[]
  withdrawHistory: any[]
  transactions: WalletTransaction[]
}

export async function generateUserReferralCode(): Promise<string> {
  return generateUniqueReferralCode()
}

export function generateReferralLink(referralCode: string): string {
  return buildReferralLink(referralCode)
}

export async function recordUserLoginHistory(userId: string, email: string) {
  const deviceInfo =
    typeof navigator !== "undefined" ? navigator.userAgent : "Unknown Device"
  const browser = deviceInfo.includes("Chrome")
    ? "Chrome"
    : deviceInfo.includes("Safari")
      ? "Safari"
      : deviceInfo.includes("Firefox")
        ? "Firefox"
        : "Mobile Browser"

  const nowIso = new Date().toISOString()

  try {
    await supabase
      .from("user_profiles")
      .update({
        last_login: nowIso,
        last_login_ip: "127.0.0.1",
      })
      .eq("email", email.trim().toLowerCase())

    await supabase.from("user_login_history").insert([
      {
        user_id: userId.includes("-") ? userId : undefined,
        email: email.trim().toLowerCase(),
        ip_address: "127.0.0.1",
        device: "Desktop/Mobile",
        browser,
      },
    ])
  } catch (err) {
    console.warn("Supabase user_login_history notice:", err)
  }
}

export function isSelfReferral(
  userEmail: string,
  referrerCode: string,
  userProfileCode?: string,
): boolean {
  if (!referrerCode || !userProfileCode) return false
  return (
    referrerCode.trim().toUpperCase() === userProfileCode.trim().toUpperCase()
  )
}

export async function applyReferralCode(
  referredUserId: string,
  referredUserEmail: string,
  enteredCode: string,
) {
  return validateAndApplyReferralCode(
    referredUserId,
    referredUserEmail,
    enteredCode,
  )
}

/**
 * Delegate to single source of truth userService
 */
export async function getOrCreateReferralProfile(
  firebaseUid: string,
  email: string,
  displayName?: string,
  photoUrl?: string,
): Promise<UserReferralProfile> {
  const canonical = await syncFirebaseUserWithDatabase({
    uid: firebaseUid,
    email,
    displayName,
    photoURL: photoUrl,
  })

  const transactions = await getUserTransactions(canonical.id)

  const totalEarnings = Math.max(
    canonical.wallet.totalEarned,
    canonical.referralStats.referralEarnings,
  )
  const walletBalance = Math.max(
    canonical.wallet.availableBalance,
    totalEarnings - canonical.wallet.totalWithdrawn,
  )

  return {
    id: canonical.id,
    firebaseUid: canonical.firebaseUid,
    name: canonical.displayName,
    email: canonical.email,
    photoUrl: canonical.profilePhoto,
    phone: "",
    referralCode: canonical.referralCode,
    referralLink: canonical.referralLink,
    walletBalance: walletBalance >= 0 ? walletBalance : 0,
    successfulReferrals: canonical.referralStats.successfulReferrals,
    pendingReferrals: canonical.referralStats.pendingReferrals,
    totalReferrals: canonical.referralStats.totalReferrals,
    totalEarnings,
    pendingWithdrawal: canonical.wallet.pendingBalance,
    createdAt: canonical.createdAt,
    lastLogin: canonical.lastLogin,
    referralHistory: [],
    withdrawHistory: canonical.withdrawals,
    transactions,
  }
}
