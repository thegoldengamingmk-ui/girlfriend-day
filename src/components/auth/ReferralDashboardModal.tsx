import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  UserReferralProfile,
  getOrCreateReferralProfile,
  applyReferralCode,
} from "../../lib/referralService"
import { createWithdrawalRequest } from "../../lib/withdrawalService"
import { emailService } from "../../lib/emailService"
import { verifyEmailCode } from "../../lib/authService"

interface ReferralDashboardModalProps {
  isOpen: boolean
  userProfile: UserReferralProfile | null
  onClose: () => void
  onLogout: () => void
}

export const ReferralDashboardModal: React.FC<ReferralDashboardModalProps> = ({
  isOpen,
  userProfile: initialProfile,
  onClose,
  onLogout,
}) => {
  const [profile, setProfile] = useState<UserReferralProfile | null>(
    initialProfile,
  )
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [toastMsg, setToastMsg] = useState("")

  // Referral code input state
  const [applyCodeInput, setApplyCodeInput] = useState("")
  const [applyCodeMsg, setApplyCodeMsg] = useState("")
  const [isApplyingCode, setIsApplyingCode] = useState(false)

  // Withdrawal Modal & Step states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState<"details" | "otp">("details")
  const [withdrawAmount, setWithdrawAmount] = useState(100)
  const [upiId, setUpiId] = useState("")
  const [otpToken, setOtpToken] = useState("")
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false)
  const [loadingText, setLoadingText] = useState("")
  const [withdrawError, setWithdrawError] = useState("")

  const handleApplyCode = async () => {
    if (!applyCodeInput.trim() || !profile) return
    setIsApplyingCode(true)
    setApplyCodeMsg("")

    console.log("[Referral Input Received] Raw Input:", applyCodeInput)
    const normalized = applyCodeInput.trim().toUpperCase()
    console.log("[Normalized Referral Code]:", normalized)

    try {
      const res = await applyReferralCode(profile.id, profile.email, normalized)
      console.log("[Referral Database Query Result]:", res)
      setIsApplyingCode(false)
      setApplyCodeMsg(res.message)
      if (res.success) {
        setApplyCodeInput("")
        setToastMsg("Referral Code Applied! 🎉")
        await refreshData()
      }
    } catch (err: any) {
      console.error("[Referral Thrown Exception]:", err)
      setIsApplyingCode(false)
      setApplyCodeMsg(err.message || "Failed to apply referral code.")
    }
  }

  useEffect(() => {
    setProfile(initialProfile)
  }, [initialProfile])

  // Sync latest profile data when modal opens
  useEffect(() => {
    if (isOpen && initialProfile?.id && initialProfile?.email) {
      refreshData()
    }
  }, [isOpen])

  const refreshData = async () => {
    if (!initialProfile) return
    setIsLoadingProfile(true)
    try {
      const updated = await getOrCreateReferralProfile(
        initialProfile.id,
        initialProfile.email,
      )
      setProfile(updated)
    } catch (err) {
      console.warn("Dashboard refresh notice:", err)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  if (!isOpen || !profile) return null

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(profile.referralCode)
      } else {
        const input = document.createElement("input")
        input.value = profile.referralCode
        document.body.appendChild(input)
        input.select()
        document.execCommand("copy")
        document.body.removeChild(input)
      }
      setCopiedCode(true)
      setToastMsg("Referral Code Copied! ❤️")
      setTimeout(() => {
        setCopiedCode(false)
        setToastMsg("")
      }, 2500)
    } catch {}
  }

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(profile.referralLink)
      } else {
        const input = document.createElement("input")
        input.value = profile.referralLink
        document.body.appendChild(input)
        input.select()
        document.execCommand("copy")
        document.body.removeChild(input)
      }
      setCopiedLink(true)
      setToastMsg("Referral Link Copied! 🚀")
      setTimeout(() => {
        setCopiedLink(false)
        setToastMsg("")
      }, 2500)
    } catch {}
  }

  // Request Withdrawal: Step 1 (Trigger OTP)
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!upiId.trim() || !upiId.includes("@")) {
      setWithdrawError("Please enter a valid UPI ID (e.g. name@upi).")
      return
    }
    if (withdrawAmount < 100 || withdrawAmount > profile.walletBalance) {
      setWithdrawError(
        `Amount must be between ₹100 and your current balance (₹${profile.walletBalance}).`,
      )
      return
    }

    setIsSubmittingWithdraw(true)
    setLoadingText("Sending Verification OTP...")
    setWithdrawError("")

    try {
      await emailService.sendWithdrawalOtp(profile.email)
      setIsSubmittingWithdraw(false)
      setWithdrawStep("otp")
    } catch (err: any) {
      setIsSubmittingWithdraw(false)
      setWithdrawError(err.message || "Failed to send OTP. Please try again.")
    }
  }

  // Request Withdrawal: Step 2 (Verify OTP & Create Request)
  const handleConfirmWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpToken.trim() || otpToken.trim().length < 6) {
      setWithdrawError("Please enter the complete 6-digit OTP code.")
      return
    }

    setIsSubmittingWithdraw(true)
    setLoadingText("Verifying OTP & Creating Withdrawal...")
    setWithdrawError("")

    try {
      // Verify OTP code
      await verifyEmailCode(profile.email, otpToken)

      // Submit withdrawal request to DB
      await createWithdrawalRequest({
        userId: profile.id,
        userName: profile.name,
        userEmail: profile.email,
        amount: withdrawAmount,
        paymentMethod: "UPI",
        upiId: upiId.trim(),
      })

      setIsSubmittingWithdraw(false)
      setShowWithdrawModal(false)
      setWithdrawStep("details")
      setOtpToken("")

      setToastMsg("Withdrawal Request Created Successfully! 🎉")
      setTimeout(() => setToastMsg(""), 3000)

      // Refresh dashboard balance & history
      await refreshData()
    } catch (err: any) {
      setIsSubmittingWithdraw(false)
      setWithdrawError(err.message || "Invalid OTP code. Please try again.")
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Toast Alert */}
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 z-[350] bg-gradient-to-r from-pink-500 to-purple-600 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-2xl border border-white/20 flex items-center gap-2"
          >
            <span>✨</span>
            <span>{toastMsg}</span>
          </motion.div>
        )}

        {/* Dashboard Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 25 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 25 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="relative z-10 w-full max-w-2xl p-5 sm:p-7 rounded-3xl text-white shadow-2xl my-auto overflow-hidden border border-pink-300/30"
          style={{
            background:
              "linear-gradient(135deg, rgba(20, 5, 35, 0.98), rgba(55, 10, 48, 0.98))",
            backdropFilter: "blur(28px)",
            boxShadow:
              "0 20px 70px rgba(0,0,0,0.85), 0 0 50px rgba(255,105,180,0.2)",
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10 mb-5">
            <div className="flex items-center gap-3">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.name}
                  className="w-11 h-11 rounded-2xl object-cover border border-pink-400/40 shadow-md"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-xl font-bold shadow-md">
                  👤
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-white leading-tight flex items-center gap-1.5">
                  <span>{profile.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    Google
                  </span>
                </h2>
                <p className="text-xs text-pink-200/70">{profile.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refreshData}
                disabled={isLoadingProfile}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-pink-200 border border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🔄</span>
                <span>{isLoadingProfile ? "Loading..." : "Refresh"}</span>
              </button>
              <button
                onClick={onLogout}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
              >
                Logout
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-pink-200 hover:text-white transition-all cursor-pointer ml-1"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Account Metadata Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5 text-[11px] text-pink-200/75 bg-white/5 p-3 rounded-2xl border border-white/5">
            <div>
              <span className="text-pink-300/60 block uppercase font-semibold text-[9px]">
                Account Created
              </span>
              <span className="font-medium text-white">
                {profile.createdAt}
              </span>
            </div>
            <div>
              <span className="text-pink-300/60 block uppercase font-semibold text-[9px]">
                Last Login
              </span>
              <span className="font-medium text-white">
                {profile.lastLogin}
              </span>
            </div>
            <div>
              <span className="text-pink-300/60 block uppercase font-semibold text-[9px]">
                Total Referrals
              </span>
              <span className="font-medium text-white">
                {profile.totalReferrals}
              </span>
            </div>
            <div>
              <span className="text-pink-300/60 block uppercase font-semibold text-[9px]">
                Status
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Verified
              </span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20">
              <span className="text-[10px] uppercase font-bold text-pink-300/80 tracking-wider">
                Withdrawable
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                ₹{profile.walletBalance}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20">
              <span className="text-[10px] uppercase font-bold text-pink-300/80 tracking-wider">
                Total Earnings
              </span>
              <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
                ₹{profile.totalEarnings}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20">
              <span className="text-[10px] uppercase font-bold text-pink-300/80 tracking-wider">
                Successful
              </span>
              <div className="text-xl sm:text-2xl font-black text-sky-400 mt-1">
                {profile.successfulReferrals}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20">
              <span className="text-[10px] uppercase font-bold text-pink-300/80 tracking-wider">
                Pending
              </span>
              <div className="text-xl sm:text-2xl font-black text-purple-300 mt-1">
                {profile.pendingReferrals}
              </div>
            </div>
          </div>

          {/* Referral Code & Referral Link Box */}
          <div className="p-4 rounded-2xl bg-white/5 border border-pink-400/20 mb-5 space-y-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-pink-300 tracking-wider mb-1">
                Your Personal Referral Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={profile.referralCode}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 font-mono text-sm font-bold text-pink-200"
                />
                <button
                  onClick={handleCopyCode}
                  className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
                >
                  {copiedCode ? "Copied!" : "Copy Code"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-pink-300 tracking-wider mb-1">
                Your Referral Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={profile.referralLink}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-pink-100/90 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
                >
                  {copiedLink ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </div>

            {/* Apply Friend's Referral Code Section */}
            <div className="pt-2 border-t border-white/10">
              <label className="block text-[10px] uppercase font-bold text-amber-300 tracking-wider mb-1">
                🎁 Have a Friend's Referral Code?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={applyCodeInput}
                  onChange={(e) =>
                    setApplyCodeInput(e.target.value.toUpperCase())
                  }
                  placeholder="Enter Code (e.g. GF-LOVE-XXXX)"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-white uppercase placeholder:normal-case placeholder:font-normal"
                />
                <button
                  onClick={handleApplyCode}
                  disabled={isApplyingCode || !applyCodeInput.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-xs font-bold text-white transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isApplyingCode ? "Applying..." : "Apply Code"}
                </button>
              </div>
              {applyCodeMsg && (
                <p
                  className={`text-[11px] font-semibold mt-1.5 ${
                    applyCodeMsg.includes("accepted") ||
                    applyCodeMsg.includes("Applied")
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {applyCodeMsg.includes("accepted") ||
                  applyCodeMsg.includes("Applied")
                    ? "✓ "
                    : "⚠️ "}
                  {applyCodeMsg}
                </p>
              )}
            </div>
          </div>

          {/* Withdraw CTA */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/30 mb-6">
            <div>
              <h4 className="text-sm font-bold text-emerald-300">
                Ready to Withdraw?
              </h4>
              <p className="text-[11px] text-emerald-200/75">
                Minimum payout: ₹100. Withdrawals require Email OTP
                verification.
              </p>
            </div>
            <button
              onClick={() => {
                setWithdrawAmount(Math.max(100, profile.walletBalance))
                setWithdrawStep("details")
                setWithdrawError("")
                setShowWithdrawModal(true)
              }}
              disabled={profile.walletBalance < 100}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Request Withdraw
            </button>
          </div>

          {/* Wallet Financial Transaction Ledger Section */}
          <div className="mb-6">
            <h3 className="text-xs uppercase font-bold tracking-wider text-amber-300 mb-3 flex items-center gap-2">
              <span>💳</span>
              <span>Wallet Financial Transaction Ledger</span>
            </h3>

            {!profile.transactions || profile.transactions.length === 0 ? (
              <div className="text-center py-6 bg-white/5 rounded-2xl border border-white/5 text-xs text-pink-200/60">
                No financial transactions recorded yet. Balance: ₹
                {profile.walletBalance}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-amber-500/20 bg-white/5 max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs text-pink-200">
                  <thead className="bg-amber-500/10 text-[10px] uppercase tracking-wider text-amber-300 border-b border-amber-500/20 sticky top-0 backdrop-blur-md">
                    <tr>
                      <th className="p-3">Txn ID</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Running Balance</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {profile.transactions.map((txn) => {
                      const isDebit = [
                        "Admin Debit",
                        "Withdrawal Request",
                        "Premium Purchase",
                      ].includes(txn.transactionType)
                      return (
                        <tr
                          key={txn.id}
                          className="hover:bg-white/5 transition-all text-[11px]"
                        >
                          <td className="p-3 font-bold text-amber-200">
                            {txn.transactionId}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                isDebit
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
                              {txn.transactionType}
                            </span>
                          </td>
                          <td
                            className={`p-3 font-bold ${
                              isDebit ? "text-rose-400" : "text-emerald-400"
                            }`}
                          >
                            {isDebit ? "-" : "+"}₹{txn.amount}
                          </td>
                          <td className="p-3 font-bold text-white">
                            ₹{txn.balanceAfter}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              {txn.status}
                            </span>
                          </td>
                          <td className="p-3 text-[10px] text-pink-200/60">
                            {txn.createdAt}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Withdraw History Section */}
          <div>
            <h3 className="text-xs uppercase font-bold tracking-wider text-pink-300/90 mb-3 flex items-center gap-2">
              <span>📋</span>
              <span>Withdraw History</span>
            </h3>

            {profile.withdrawHistory.length === 0 ? (
              <div className="text-center py-6 bg-white/5 rounded-2xl border border-white/5 text-xs text-pink-200/60">
                No withdrawal history found.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                <table className="w-full text-left text-xs text-pink-200">
                  <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-pink-300/70 border-b border-white/10">
                    <tr>
                      <th className="p-3">Request ID</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">UPI ID</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {profile.withdrawHistory.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-white/5 transition-all"
                      >
                        <td className="p-3 font-mono text-white">
                          {item.requestId}
                        </td>
                        <td className="p-3 font-bold text-emerald-400">
                          ₹{item.amount}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-pink-200/80">
                          {item.upiId}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === "APPROVED" ||
                              item.status === "PAID"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : item.status === "REJECTED"
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-pink-200/60">
                          {item.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* OTP-Secured Withdrawal Modal Sub-Layer */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[330] flex items-center justify-center p-4">
          <div
            onClick={() => setShowWithdrawModal(false)}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative z-10 w-full max-w-sm p-6 rounded-3xl text-white shadow-2xl border border-pink-400/30"
            style={{
              background:
                "linear-gradient(135deg, rgba(22, 5, 42, 0.98), rgba(60, 10, 52, 0.98))",
              backdropFilter: "blur(24px)",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">
                {withdrawStep === "details"
                  ? "Withdrawal Request"
                  : "Verify OTP Code"}
              </h3>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-pink-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            {withdrawError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs">
                ⚠️ {withdrawError}
              </div>
            )}

            {withdrawStep === "details" ? (
              <form onSubmit={handleRequestOtp} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-pink-200/80 mb-1">
                    Withdrawal Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={100}
                    max={profile.walletBalance}
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm focus:outline-none focus:border-pink-400"
                  />
                  <span className="text-[10px] text-pink-300/70 mt-1 block">
                    Available: ₹{profile.walletBalance}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-pink-200/80 mb-1">
                    UPI ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="username@upi"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-pink-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingWithdraw}
                  className="w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingWithdraw
                    ? loadingText
                    : "Continue to OTP Verification"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmWithdrawal} className="space-y-3.5">
                <p className="text-xs text-pink-200/80">
                  Enter 6-digit OTP sent to{" "}
                  <span className="font-semibold text-white">
                    {profile.email}
                  </span>{" "}
                  to confirm withdrawal of ₹{withdrawAmount}.
                </p>

                <div>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={otpToken}
                    onChange={(e) =>
                      setOtpToken(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="123456"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-center font-mono text-lg tracking-[0.4em] font-bold text-white focus:outline-none focus:border-pink-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingWithdraw}
                  className="w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingWithdraw
                    ? loadingText
                    : "Verify & Submit Withdrawal"}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
