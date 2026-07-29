import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { processAdminWithdrawalAction } from "../lib/withdrawalService"
import {
  type AdminUser,
  logoutAdminSession,
  logAdminAction,
  getRegisteredAdmins,
  createStaffAdmin,
  toggleAdminStatus,
  deleteAdminAccount,
  updateAdminPassword,
  validatePasswordStrength,
} from "../lib/adminAuthService"
import {
  getAdminStats,
  getAdminUsers,
  getAdminTransactions,
  getAdminWithdrawals,
  getAdminReferrals,
  getAdminAuditLogs,
  getUserLoginHistory,
  toggleUserStatus,
  toggleUserSubscription,
  subscribeToAdminRealtimeUpdates,
  downloadCSV,
  type AdminUserRecord,
  type PaymentTransaction,
  type WithdrawalRecord,
  type ReferralRecord,
  type AuditLogRecord,
  type UserLoginRecord,
  type AdminStats,
} from "../lib/adminDataService"

type AdminTab = "home" | "users" | "payments" | "subscriptions" | "referrals" | "withdrawals" | "admins" | "security"

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = "white",
  icon,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon: string
}) {
  return (
    <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col gap-2 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-2xl font-bold font-serif`} style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  )
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase()
  const styles: Record<string, string> = {
    ACTIVE: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    PREMIUM: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    SUCCESS: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    CAPTURED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    COMPLETED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    APPROVED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    PENDING: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    PROCESSING: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    BLOCKED: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    FAILED: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    REJECTED: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    EXPIRED: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    FREE: "bg-slate-700/60 text-slate-300 border-slate-600/30",
    PAID: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    SUPER_ADMIN: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    ADMIN: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  }
  const cls = styles[s] || "bg-slate-700/60 text-slate-400 border-slate-600/30"
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}
    >
      {s}
    </span>
  )
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: string
  title: string
  sub?: string
}) {
  return (
    <div className="text-center p-14 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
      <div className="text-5xl">{icon}</div>
      <h3 className="text-lg font-bold text-white font-serif">{title}</h3>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

// ── Section Title ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest text-pink-300/70 mb-4">
      {children}
    </h3>
  )
}

// ── Table Wrapper ────────────────────────────────────────────────────────────

function AdminTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl">
      <table className="w-full text-left border-collapse text-xs">
        {children}
      </table>
    </div>
  )
}

function Th({
  children,
  right,
}: {
  children: React.ReactNode
  right?: boolean
}) {
  return (
    <th
      className={`p-4 text-slate-400 uppercase tracking-wider font-semibold ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  )
}

function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-slate-800 bg-slate-900">{children}</tr>
    </thead>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboard({
  admin,
  onLogout,
}: {
  admin: AdminUser
  onLogout: () => void
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>("home")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Live data states
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])
  const [referrals, setReferrals] = useState<ReferralRecord[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([])
  const [adminAccounts, setAdminAccounts] = useState<AdminUser[]>([])

  // User profile drawer
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null)
  const [userLoginHistory, setUserLoginHistory] = useState<UserLoginRecord[]>(
    [],
  )
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Search & filter state
  const [userSearch, setUserSearch] = useState("")
  const [userStatusFilter, setUserStatusFilter] = useState("ALL")
  const [paymentSearch, setPaymentSearch] = useState("")
  const [withdrawalFilter, setWithdrawalFilter] = useState("ALL")
  const [referralSearch, setReferralSearch] = useState("")
  const [auditSearch, setAuditSearch] = useState("")

  // Withdrawal action modal
  const [actionWithdrawal, setActionWithdrawal] =
    useState<WithdrawalRecord | null>(null)
  const [withdrawNotes, setWithdrawNotes] = useState("")
  const [withdrawRefId, setWithdrawRefId] = useState("")
  const [isProcessingWd, setIsProcessingWd] = useState(false)

  // Staff admin modal
  const [showAddAdminModal, setShowAddAdminModal] = useState(false)
  const [newAdminName, setNewAdminName] = useState("")
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [newAdminPass, setNewAdminPass] = useState("")
  const [newAdminRole, setNewAdminRole] = useState<"ADMIN" | "SUPER_ADMIN">(
    "ADMIN",
  )
  const [newAdminPermissions, setNewAdminPermissions] = useState<string[]>([
    "manage_users",
    "manage_payments",
    "approve_withdrawals",
  ])
  const [adminFormMsg, setAdminFormMsg] = useState("")
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false)

  // Security tab
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [passMsg, setPassMsg] = useState("")
  const [isChangingPass, setIsChangingPass] = useState(false)

  // ── Data Loader ────────────────────────────────────────────────────────────

  const reloadAllData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const [
        liveStats,
        liveUsers,
        liveTransactions,
        liveWithdrawals,
        liveReferrals,
        liveLogs,
        liveAdmins,
      ] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getAdminTransactions(),
        getAdminWithdrawals(),
        getAdminReferrals(),
        getAdminAuditLogs(200),
        getRegisteredAdmins(),
      ])
      setStats(liveStats)
      setUsers(liveUsers)
      setTransactions(liveTransactions)
      setWithdrawals(liveWithdrawals)
      setReferrals(liveReferrals)
      setAuditLogs(liveLogs)
      setAdminAccounts(liveAdmins)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    reloadAllData()
    const unsubscribe = subscribeToAdminRealtimeUpdates(() => reloadAllData())
    return () => unsubscribe()
  }, [reloadAllData])

  useEffect(() => {
    if (selectedUser) {
      setIsLoadingHistory(true)
      getUserLoginHistory(selectedUser.id).then((h) => {
        setUserLoginHistory(h)
        setIsLoadingHistory(false)
      })
    }
  }, [selectedUser])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleUserBlock = async (user: AdminUserRecord) => {
    await toggleUserStatus(user.id, user.accountStatus)
    await logAdminAction(
      admin.id,
      admin.email,
      "TOGGLE_USER_STATUS",
      `${
        user.accountStatus === "ACTIVE" ? "Blocked" : "Unblocked"
      } user: ${user.email}`,
    )
    await reloadAllData()
    if (selectedUser?.id === user.id) {
      setSelectedUser((prev) =>
        prev
          ? {
              ...prev,
              accountStatus:
                prev.accountStatus === "ACTIVE" ? "BLOCKED" : "ACTIVE",
            }
          : null,
      )
    }
  }

  const handleToggleSubscription = async (user: AdminUserRecord) => {
    const grant = user.subscriptionStatus !== "PREMIUM"
    await toggleUserSubscription(user.id, user.email, grant)
    await logAdminAction(
      admin.id,
      admin.email,
      "TOGGLE_SUBSCRIPTION",
      `${grant ? "Granted" : "Revoked"} PREMIUM for user: ${user.email}`,
    )
    await reloadAllData()
  }

  const handleWithdrawalAction = async (action: "APPROVE" | "REJECT") => {
    if (!actionWithdrawal) return
    setIsProcessingWd(true)
    try {
      await processAdminWithdrawalAction({
        withdrawalId: actionWithdrawal.id,
        action,
        adminNotes:
          withdrawNotes ||
          (action === "APPROVE"
            ? `Approved. Ref: ${withdrawRefId || "N/A"}`
            : "Withdrawal rejected."),
        adminEmail: admin.email,
      })
      await logAdminAction(
        admin.id,
        admin.email,
        `WITHDRAWAL_${action}`,
        `${action} withdrawal ${actionWithdrawal.requestId} (₹${actionWithdrawal.amount}) for ${actionWithdrawal.email}`,
      )
      setActionWithdrawal(null)
      setWithdrawNotes("")
      setWithdrawRefId("")
      await reloadAllData()
    } finally {
      setIsProcessingWd(false)
    }
  }

  const handleCreateStaffAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (admin.role !== "SUPER_ADMIN") return
    setIsCreatingAdmin(true)
    setAdminFormMsg("")
    try {
      await createStaffAdmin(
        newAdminName,
        newAdminEmail,
        newAdminPass,
        newAdminRole,
        newAdminPermissions,
      )
      await logAdminAction(
        admin.id,
        admin.email,
        "CREATE_STAFF_ADMIN",
        `Created ${newAdminRole} account for ${newAdminEmail}`,
      )
      setShowAddAdminModal(false)
      setNewAdminName("")
      setNewAdminEmail("")
      setNewAdminPass("")
      await reloadAllData()
    } catch (err: any) {
      setAdminFormMsg(err?.message || "Failed to create admin.")
    } finally {
      setIsCreatingAdmin(false)
    }
  }

  const handleToggleAdminStatus = async (id: string) => {
    await toggleAdminStatus(id)
    await logAdminAction(
      admin.id,
      admin.email,
      "TOGGLE_ADMIN_STATUS",
      `Toggled admin status for ${id}`,
    )
    await reloadAllData()
  }

  const handleDeleteAdmin = async (id: string, email: string) => {
    if (!confirm(`Delete admin account ${email}? This cannot be undone.`))
      return
    await deleteAdminAccount(id)
    await logAdminAction(
      admin.id,
      admin.email,
      "DELETE_ADMIN",
      `Deleted admin account: ${email}`,
    )
    await reloadAllData()
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmNewPassword) {
      setPassMsg("⚠️ Passwords do not match.")
      return
    }
    const strength = validatePasswordStrength(newPassword)
    if (!strength.isValid) {
      setPassMsg(`⚠️ ${strength.error}`)
      return
    }
    setIsChangingPass(true)
    setPassMsg("")
    try {
      await updateAdminPassword(admin.id, newPassword)
      await logAdminAction(
        admin.id,
        admin.email,
        "CHANGE_PASSWORD",
        "Updated admin login password",
      )
      setPassMsg("✅ Password updated successfully!")
      setNewPassword("")
      setConfirmNewPassword("")
    } catch (err: any) {
      setPassMsg(`⚠️ ${err?.message || "Failed to update password."}`)
    } finally {
      setIsChangingPass(false)
    }
  }

  // ── CSV Exports ────────────────────────────────────────────────────────────

  const handleExportUsersCSV = () => {
    downloadCSV(
      `Users_Export_${Date.now()}.csv`,
      [
        "User ID",
        "Name",
        "Email",
        "Mobile",
        "Subscription",
        "Wallet Balance",
        "Referral Code",
        "Referred Users",
        "Earnings",
        "Status",
        "Signup Date",
        "Last Login",
      ],
      users.map((u) => [
        u.id,
        u.name,
        u.email,
        u.mobile,
        u.subscriptionStatus,
        u.walletBalance,
        u.referralCode,
        u.referredUsersCount,
        u.totalReferralEarnings,
        u.accountStatus,
        u.signupDate,
        u.lastLogin,
      ]) as any,
    )
    logAdminAction(
      admin.id,
      admin.email,
      "EXPORT_USERS_CSV",
      "Exported Users dataset to CSV",
    )
  }

  const handleExportPaymentsCSV = () => {
    downloadCSV(
      `Payments_Export_${Date.now()}.csv`,
      [
        "Transaction ID",
        "User Name",
        "Email",
        "Amount",
        "Gateway",
        "Status",
        "Date",
      ],
      transactions.map((t) => [
        t.transactionId,
        t.userName,
        t.email,
        t.amount,
        t.gateway,
        t.status,
        t.date,
      ]) as any,
    )
    logAdminAction(
      admin.id,
      admin.email,
      "EXPORT_PAYMENTS_CSV",
      "Exported Payment records to CSV",
    )
  }

  // ── Derived / Filtered Data ────────────────────────────────────────────────

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase()
    const matchSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.referralCode.toLowerCase().includes(q)
    const matchFilter =
      userStatusFilter === "ALL" ||
      u.subscriptionStatus === userStatusFilter ||
      u.accountStatus === userStatusFilter
    return matchSearch && matchFilter
  })

  const filteredPayments = transactions.filter((t) => {
    const q = paymentSearch.toLowerCase()
    return (
      !q ||
      t.transactionId.toLowerCase().includes(q) ||
      t.userName.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q)
    )
  })

  const filteredWithdrawals = withdrawals.filter(
    (w) => withdrawalFilter === "ALL" || w.status === withdrawalFilter,
  )

  const filteredReferrals = referrals.filter((r) => {
    const q = referralSearch.toLowerCase()
    return (
      !q ||
      r.referrerEmail.toLowerCase().includes(q) ||
      r.referredEmail.toLowerCase().includes(q) ||
      r.referrerCode.toLowerCase().includes(q)
    )
  })

  const filteredAuditLogs = auditLogs.filter((l) => {
    const q = auditSearch.toLowerCase()
    return (
      !q ||
      l.action.toLowerCase().includes(q) ||
      l.adminEmail.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q)
    )
  })

  const premiumUsers = users.filter((u) => u.subscriptionStatus === "PREMIUM")

  // ── NAV TABS ────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "home", label: "Dashboard", icon: "📊" },
    { id: "users", label: "Users", icon: "👥", badge: users.length },
    {
      id: "payments",
      label: "Payments",
      icon: "💳",
      badge: stats ? `₹${stats.totalRevenue}` : "",
    },
    {
      id: "subscriptions",
      label: "Subscriptions",
      icon: "💎",
      badge: premiumUsers.length,
    },
    {
      id: "referrals",
      label: "Referrals",
      icon: "🎁",
      badge: referrals.length,
    },
    {
      id: "withdrawals",
      label: "Withdrawals",
      icon: "💸",
      badge:
        withdrawals.filter((w) => w.status === "PENDING").length || undefined,
    },
    { id: "admins", label: "Admins", icon: "👑", superOnly: true },
    { id: "security", label: "Security & Logs", icon: "🛡️" },
  ].filter((t) => !t.superOnly || admin.role === "SUPER_ADMIN")

  // ── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans">
      {/* ── SIDEBAR ── */}
      <aside
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } transition-all duration-300 bg-slate-900/95 border-r border-slate-800 flex flex-col justify-between z-30 select-none shrink-0`}
      >
        <div>
          {/* Brand */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-pink-500/20 shrink-0">
                🛡️
              </div>
              {isSidebarOpen && (
                <div className="truncate">
                  <h1 className="font-bold text-sm text-white leading-snug">
                    Admin Portal
                  </h1>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 uppercase tracking-wider">
                    {admin.role}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-xs shrink-0"
            >
              {isSidebarOpen ? "◀" : "▶"}
            </button>
          </div>

          {/* Nav */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-pink-500/20 to-rose-500/20 text-pink-300 border border-pink-500/30 shadow-md"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="text-base shrink-0">{tab.icon}</span>
                  {isSidebarOpen && (
                    <span className="truncate">{tab.label}</span>
                  )}
                </div>
                {isSidebarOpen &&
                  tab.badge !== undefined &&
                  tab.badge !== 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        tab.id === "withdrawals"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-slate-800 text-pink-300 border border-slate-700"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
              </button>
            ))}
          </nav>
        </div>

        {/* User footer */}
        {isSidebarOpen && (
          <div className="p-4 border-t border-slate-800">
            <div className="mb-3">
              <p className="text-xs font-bold text-white truncate">
                {admin.name}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {admin.email}
              </p>
            </div>
            <button
              onClick={() => {
                logoutAdminSession()
                onLogout()
              }}
              className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              🚪 Logout
            </button>
          </div>
        )}
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white font-serif">
              {tabs.find((t) => t.id === activeTab)?.icon}{" "}
              {tabs.find((t) => t.id === activeTab)?.label}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRefreshing
                    ? "bg-amber-400 animate-pulse"
                    : "bg-emerald-400 animate-pulse"
                }`}
              />
              <span>
                {isRefreshing ? "Refreshing..." : "Live Supabase Data"}
              </span>
              <span>
                • <strong className="text-pink-300">{admin.role}</strong>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reloadAllData}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              🔄 Refresh
            </button>
            <button
              onClick={handleExportUsersCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              📥 Users CSV
            </button>
            <button
              onClick={handleExportPaymentsCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white transition-colors cursor-pointer"
            >
              💸 Revenue CSV
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ══ DASHBOARD HOME ════════════════════════════════════════════ */}
          {activeTab === "home" && (
            <div className="space-y-8 animate-fade-up">
              {/* KPI Row 1 — Users */}
              <div>
                <SectionTitle>👥 User Overview</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  <StatCard
                    icon="👥"
                    label="Total Users"
                    value={stats?.totalUsers ?? users.length}
                    sub="Registered accounts"
                  />
                  <StatCard
                    icon="✅"
                    label="Active Users"
                    value={stats?.activeUsers ?? "-"}
                    color="#34d399"
                    sub="Not blocked"
                  />
                  <StatCard
                    icon="💎"
                    label="Premium"
                    value={stats?.premiumUsers ?? premiumUsers.length}
                    color="#a78bfa"
                    sub="Active subscriptions"
                  />
                  <StatCard
                    icon="🆕"
                    label="Today"
                    value={stats?.newUsersToday ?? "-"}
                    color="#60a5fa"
                    sub="New registrations"
                  />
                  <StatCard
                    icon="📅"
                    label="This Month"
                    value={stats?.newUsersThisMonth ?? "-"}
                    color="#f472b6"
                    sub="New registrations"
                  />
                </div>
              </div>

              {/* KPI Row 2 — Revenue */}
              <div>
                <SectionTitle>💰 Revenue & Payments</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon="💰"
                    label="Total Revenue"
                    value={`₹${stats?.totalRevenue ?? "-"}`}
                    color="#34d399"
                    sub="Successful payments"
                  />
                  <StatCard
                    icon="✅"
                    label="Successful"
                    value={stats?.successfulPayments ?? "-"}
                    color="#34d399"
                    sub="Payment count"
                  />
                  <StatCard
                    icon="❌"
                    label="Failed"
                    value={stats?.failedPayments ?? "-"}
                    color="#f87171"
                    sub="Payment count"
                  />
                  <StatCard
                    icon="⏳"
                    label="Pending"
                    value={stats?.pendingPayments ?? "-"}
                    color="#fbbf24"
                    sub="Awaiting capture"
                  />
                </div>
              </div>

              {/* KPI Row 3 — Withdrawals */}
              <div>
                <SectionTitle>💸 Withdrawals</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon="⏳"
                    label="Pending Count"
                    value={stats?.pendingWithdrawalsCount ?? "-"}
                    color="#fbbf24"
                    sub="Awaiting approval"
                  />
                  <StatCard
                    icon="🔒"
                    label="Pending Amount"
                    value={`₹${stats?.pendingWithdrawalsAmount ?? "-"}`}
                    color="#fbbf24"
                    sub="Reserved balance"
                  />
                  <StatCard
                    icon="✅"
                    label="Approved Amount"
                    value={`₹${stats?.approvedWithdrawalsAmount ?? "-"}`}
                    color="#34d399"
                    sub="Total paid out"
                  />
                  <StatCard
                    icon="❌"
                    label="Rejected"
                    value={stats?.rejectedWithdrawalsCount ?? "-"}
                    color="#f87171"
                    sub="Rejected requests"
                  />
                </div>
              </div>

              {/* KPI Row 4 — Referrals & Wallet */}
              <div>
                <SectionTitle>🎁 Referrals & Wallet</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon="🎁"
                    label="Total Referrals"
                    value={stats?.totalReferrals ?? referrals.length}
                    color="#c084fc"
                    sub="Successful"
                  />
                  <StatCard
                    icon="💸"
                    label="Referral Rewards"
                    value={`₹${stats?.totalReferralRewards ?? "-"}`}
                    color="#c084fc"
                    sub="Total paid"
                  />
                  <StatCard
                    icon="🏦"
                    label="Total Wallet"
                    value={`₹${stats?.totalWalletBalance ?? "-"}`}
                    color="#22d3ee"
                    sub="All user balances"
                  />
                  <StatCard
                    icon="🛡️"
                    label="Admin Role"
                    value={admin.role}
                    color="#fbbf24"
                    sub={admin.email}
                  />
                </div>
              </div>

              {/* Recent Withdrawals Preview */}
              {withdrawals.filter((w) => w.status === "PENDING").length > 0 && (
                <div>
                  <SectionTitle>
                    ⚡ Pending Withdrawals — Action Required
                  </SectionTitle>
                  <div className="space-y-2">
                    {withdrawals
                      .filter((w) => w.status === "PENDING")
                      .slice(0, 5)
                      .map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20"
                        >
                          <div>
                            <p className="text-sm font-bold text-white">
                              {w.userName} —{" "}
                              <span className="text-emerald-400">
                                ₹{w.amount}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {w.email} • {w.paymentDetails}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveTab("withdrawals")
                              setWithdrawalFilter("PENDING")
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 hover:bg-amber-500/30 transition-colors cursor-pointer"
                          >
                            Review →
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ USER MANAGEMENT ═══════════════════════════════════════════ */}
          {activeTab === "users" && (
            <div className="space-y-4 animate-fade-up">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="🔍 Search by name, email, or referral code..."
                  className="w-full sm:w-96 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500 transition-colors"
                />
                <div className="flex gap-2 flex-wrap">
                  {["ALL", "PREMIUM", "FREE", "ACTIVE", "BLOCKED"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setUserStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        userStatusFilter === st
                          ? "bg-pink-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <EmptyState
                  icon="👥"
                  title="No Users Found"
                  sub="No users match your search or filter."
                />
              ) : (
                <AdminTable>
                  <THead>
                    <Th>User</Th>
                    <Th>Subscription</Th>
                    <Th>Wallet</Th>
                    <Th>Referral Code</Th>
                    <Th>Last Login</Th>
                    <Th>Status</Th>
                    <Th right>Actions</Th>
                  </THead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-4">
                          <div className="font-bold text-white">{u.name}</div>
                          <div className="text-slate-400 text-[11px] font-mono">
                            {u.email}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {u.signupDate}
                          </div>
                        </td>
                        <td className="p-4">
                          <StatusBadge status={u.subscriptionStatus} />
                        </td>
                        <td className="p-4 font-bold text-emerald-400 font-mono">
                          ₹{u.walletBalance}
                        </td>
                        <td className="p-4 font-mono font-bold text-pink-300 text-xs">
                          {u.referralCode}
                        </td>
                        <td className="p-4 text-slate-400 text-[11px]">
                          {u.lastLogin}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={u.accountStatus} />
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex gap-1.5 justify-end flex-wrap">
                            <button
                              onClick={() => setSelectedUser(u)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleToggleSubscription(u)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer ${
                                u.subscriptionStatus === "PREMIUM"
                                  ? "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                              }`}
                            >
                              {u.subscriptionStatus === "PREMIUM"
                                ? "Revoke"
                                : "Grant Premium"}
                            </button>
                            <button
                              onClick={() => handleToggleUserBlock(u)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer ${
                                u.accountStatus === "ACTIVE"
                                  ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                              }`}
                            >
                              {u.accountStatus === "ACTIVE"
                                ? "Block"
                                : "Unblock"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              )}
              <p className="text-xs text-slate-500 text-right">
                Showing {filteredUsers.length} of {users.length} users
              </p>
            </div>
          )}

          {/* ══ PAYMENTS ══════════════════════════════════════════════════ */}
          {activeTab === "payments" && (
            <div className="space-y-4 animate-fade-up">
              <div className="flex justify-between items-center p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
                <input
                  type="text"
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  placeholder="🔍 Search by transaction ID or email..."
                  className="w-80 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-emerald-400 font-semibold">
                    ● Razorpay Connected
                  </span>
                  <span className="text-xs text-slate-400">
                    {filteredPayments.length} records
                  </span>
                </div>
              </div>

              {filteredPayments.length === 0 ? (
                <EmptyState
                  icon="💳"
                  title="No Payment Records"
                  sub="No payment transactions found in the database."
                />
              ) : (
                <AdminTable>
                  <THead>
                    <Th>Transaction ID</Th>
                    <Th>User</Th>
                    <Th>Amount</Th>
                    <Th>Gateway</Th>
                    <Th>Status</Th>
                    <Th>Date</Th>
                  </THead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredPayments.map((t) => (
                      <tr
                        key={t.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-4 font-mono font-bold text-pink-300 text-[11px]">
                          {t.transactionId}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-white">
                            {t.userName}
                          </div>
                          <div className="text-slate-400 text-[11px] font-mono">
                            {t.email}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-emerald-400 font-serif">
                          ₹{t.amount}
                        </td>
                        <td className="p-4 text-slate-300 font-semibold">
                          {t.gateway}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="p-4 text-slate-400 text-[11px]">
                          {t.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              )}
            </div>
          )}

          {/* ══ SUBSCRIPTIONS ═════════════════════════════════════════════ */}
          {activeTab === "subscriptions" && (
            <div className="space-y-4 animate-fade-up">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                  icon="💎"
                  label="Total Premium"
                  value={premiumUsers.length}
                  color="#a78bfa"
                  sub="Active subscribers"
                />
                <StatCard
                  icon="🆓"
                  label="Free Users"
                  value={
                    users.filter((u) => u.subscriptionStatus === "FREE").length
                  }
                  color="#94a3b8"
                  sub="No subscription"
                />
                <StatCard
                  icon="⏰"
                  label="Expired"
                  value={
                    users.filter((u) => u.subscriptionStatus === "EXPIRED")
                      .length
                  }
                  color="#f97316"
                  sub="Lapsed subscriptions"
                />
                <StatCard
                  icon="💰"
                  label="Revenue"
                  value={`₹${stats?.totalRevenue ?? "-"}`}
                  color="#34d399"
                  sub="From payments"
                />
              </div>

              {premiumUsers.length === 0 ? (
                <EmptyState
                  icon="💎"
                  title="No Premium Subscribers"
                  sub="No users with active PREMIUM subscription."
                />
              ) : (
                <AdminTable>
                  <THead>
                    <Th>User</Th>
                    <Th>Email</Th>
                    <Th>Status</Th>
                    <Th>Expiry</Th>
                    <Th>Wallet Balance</Th>
                    <Th right>Actions</Th>
                  </THead>
                  <tbody className="divide-y divide-slate-800/60">
                    {premiumUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-4 font-bold text-white">{u.name}</td>
                        <td className="p-4 text-slate-400 font-mono text-[11px]">
                          {u.email}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={u.subscriptionStatus} />
                        </td>
                        <td className="p-4 text-slate-300 text-xs">
                          {u.subscriptionExpiry}
                        </td>
                        <td className="p-4 font-bold text-emerald-400">
                          ₹{u.walletBalance}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleToggleSubscription(u)}
                            className="px-3 py-1.5 rounded-xl bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 font-bold text-xs cursor-pointer border border-orange-500/30"
                          >
                            Revoke Premium
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              )}
            </div>
          )}

          {/* ══ REFERRALS ═════════════════════════════════════════════════ */}
          {activeTab === "referrals" && (
            <div className="space-y-4 animate-fade-up">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard
                  icon="🎁"
                  label="Total Referrals"
                  value={referrals.length}
                  color="#c084fc"
                  sub="All time"
                />
                <StatCard
                  icon="💸"
                  label="Total Rewards"
                  value={`₹${referrals.reduce((s, r) => s + r.commissionAmount, 0)}`}
                  color="#c084fc"
                  sub="Paid commissions"
                />
                <StatCard
                  icon="✅"
                  label="Approved"
                  value={
                    referrals.filter((r) => r.status === "APPROVED").length
                  }
                  color="#34d399"
                  sub="Completed referrals"
                />
              </div>

              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
                <input
                  type="text"
                  value={referralSearch}
                  onChange={(e) => setReferralSearch(e.target.value)}
                  placeholder="🔍 Search by referrer email, referred email, or code..."
                  className="w-full sm:w-96 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                />
              </div>

              {filteredReferrals.length === 0 ? (
                <EmptyState
                  icon="🎁"
                  title="No Referral Activity"
                  sub="No referral records found in the database."
                />
              ) : (
                <AdminTable>
                  <THead>
                    <Th>Referrer</Th>
                    <Th>Code Used</Th>
                    <Th>Referred User</Th>
                    <Th>Commission</Th>
                    <Th>Status</Th>
                    <Th>Date</Th>
                  </THead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredReferrals.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-4">
                          <div className="font-bold text-white">
                            {r.referrerName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {r.referrerEmail}
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold text-pink-300 text-xs">
                          {r.referrerCode}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-white">
                            {r.referredName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {r.referredEmail}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-emerald-400">
                          ₹{r.commissionAmount}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="p-4 text-slate-400 text-[11px]">
                          {r.createdAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              )}
            </div>
          )}

          {/* ══ WITHDRAWALS ═══════════════════════════════════════════════ */}
          {activeTab === "withdrawals" && (
            <div className="space-y-4 animate-fade-up">
              <div className="flex gap-2 p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex-wrap">
                {["ALL", "PENDING", "COMPLETED", "REJECTED", "PROCESSING"].map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => setWithdrawalFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        withdrawalFilter === st
                          ? "bg-pink-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {st}{" "}
                      {st !== "ALL"
                        ? `(${withdrawals.filter((w) => w.status === st).length})`
                        : `(${withdrawals.length})`}
                    </button>
                  ),
                )}
              </div>

              {filteredWithdrawals.length === 0 ? (
                <EmptyState
                  icon="💸"
                  title="No Withdrawal Requests"
                  sub="No requests match the selected filter."
                />
              ) : (
                <AdminTable>
                  <THead>
                    <Th>Request ID</Th>
                    <Th>User</Th>
                    <Th>Amount</Th>
                    <Th>Payment Details</Th>
                    <Th>Status</Th>
                    <Th>Requested</Th>
                    <Th right>Actions</Th>
                  </THead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredWithdrawals.map((w) => (
                      <tr
                        key={w.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-4 font-mono font-bold text-amber-300 text-[11px]">
                          {w.requestId}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-white">
                            {w.userName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {w.email}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-emerald-400 font-serif">
                          ₹{w.amount}
                        </td>
                        <td className="p-4 text-slate-200 text-xs font-mono">
                          {w.paymentDetails}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={w.status} />
                        </td>
                        <td className="p-4 text-slate-400 text-[11px]">
                          {w.requestDate}
                        </td>
                        <td className="p-4 text-right">
                          {(w.status as string === "PENDING" ||
                            w.status as string === "PROCESSING") && (
                            <button
                              onClick={() => {
                                setActionWithdrawal(w)
                                setWithdrawNotes("")
                                setWithdrawRefId("")
                              }}
                              className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs cursor-pointer"
                            >
                              Process
                            </button>
                          )}
                          {(w.status === "COMPLETED" ||
                            w.status === "REJECTED") && (
                            <span className="text-[11px] text-slate-500 italic">
                              {w.reviewedAt || "Processed"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              )}
            </div>
          )}

          {/* ══ ADMIN MANAGEMENT ══════════════════════════════════════════ */}
          {activeTab === "admins" && admin.role === "SUPER_ADMIN" && (
            <div className="space-y-6 animate-fade-up">
              <div className="flex justify-between items-center">
                <SectionTitle>
                  Staff Admin Accounts ({adminAccounts.length})
                </SectionTitle>
                <button
                  onClick={() => {
                    setShowAddAdminModal(true)
                    setAdminFormMsg("")
                  }}
                  className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold cursor-pointer shadow-md transition-colors"
                >
                  ➕ Add Admin
                </button>
              </div>

              {adminAccounts.length === 0 ? (
                <EmptyState
                  icon="👑"
                  title="No Admin Accounts"
                  sub="No staff admins found. Create the first one."
                />
              ) : (
                <AdminTable>
                  <THead>
                    <Th>Admin</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th right>Actions</Th>
                  </THead>
                  <tbody className="divide-y divide-slate-800/60">
                    {adminAccounts.map((a) => (
                      <tr
                        key={a.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-4">
                          <div className="font-bold text-white">{a.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {a.email}
                          </div>
                        </td>
                        <td className="p-4">
                          <StatusBadge status={a.role} />
                        </td>
                        <td className="p-4">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="p-4 text-slate-400 text-[11px]">
                          {a.createdAt
                            ? new Date(a.createdAt).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="p-4 text-right">
                          {a.role !== "SUPER_ADMIN" && (
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => handleToggleAdminStatus(a.id)}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer ${
                                  a.status === "ACTIVE"
                                    ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                                    : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                                }`}
                              >
                                {a.status === "ACTIVE" ? "Suspend" : "Activate"}
                              </button>
                              <button
                                onClick={() => handleDeleteAdmin(a.id, a.email)}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-bold text-xs cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                          {a.role === "SUPER_ADMIN" && (
                            <span className="text-[11px] text-amber-300/60 italic">
                              Protected
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              )}
            </div>
          )}

          {/* ══ SECURITY & LOGS ══════════════════════════════════════════ */}
          {activeTab === "security" && (
            <div className="space-y-8 animate-fade-up">
              {/* Change Password */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 max-w-md">
                <SectionTitle>🔐 Change Admin Password</SectionTitle>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 12 chars, A-Z, a-z, 0-9, special"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                    />
                  </div>
                  {passMsg && (
                    <p
                      className={`text-xs font-semibold ${
                        passMsg.startsWith("✅")
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {passMsg}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={isChangingPass}
                    className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isChangingPass ? "Updating..." : "Update Password 🔐"}
                  </button>
                </form>
                <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono">
                  Password is hashed with SHA-256 + salt and stored in Supabase
                  admins table.
                </div>
              </div>

              {/* Audit Logs */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle>
                    📋 Admin Audit Logs ({auditLogs.length})
                  </SectionTitle>
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="🔍 Filter logs..."
                    className="w-64 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                  />
                </div>
                {filteredAuditLogs.length === 0 ? (
                  <EmptyState
                    icon="📋"
                    title="No Audit Logs"
                    sub="No admin activity logged yet."
                  />
                ) : (
                  <AdminTable>
                    <THead>
                      <Th>Action</Th>
                      <Th>Admin</Th>
                      <Th>Description</Th>
                      <Th>Device</Th>
                      <Th>Timestamp</Th>
                    </THead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredAuditLogs.map((l) => (
                        <tr
                          key={l.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 text-[10px] font-bold font-mono border border-pink-500/20">
                              {l.action}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300 text-xs font-mono">
                            {l.adminEmail}
                          </td>
                          <td className="p-4 text-slate-400 text-xs max-w-xs truncate">
                            {l.description}
                          </td>
                          <td className="p-4 text-slate-500 text-[10px] max-w-[120px] truncate">
                            {l.deviceInfo}
                          </td>
                          <td className="p-4 text-slate-400 text-[11px]">
                            {l.createdAt}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </AdminTable>
                )}
              </div>
            </div>
          )}
        </div>
        {/* end p-6 */}
      </main>

      {/* ══ USER PROFILE DRAWER ════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-end p-4 bg-black/80 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedUser(null)
            }}
          >
            <motion.div
              initial={{ x: 80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              className="w-full max-w-lg h-full overflow-y-auto p-7 rounded-3xl bg-slate-900 border border-slate-700 text-white space-y-5"
            >
              <div className="flex justify-between items-start pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-xl font-bold font-serif text-white">
                    {selectedUser.name}
                  </h3>
                  <p className="text-xs text-pink-300 font-mono">
                    {selectedUser.email}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <StatusBadge status={selectedUser.accountStatus} />
                    <StatusBadge status={selectedUser.subscriptionStatus} />
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <h4 className="font-bold text-pink-300 uppercase tracking-wider text-[11px]">
                  Account Details
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    ID:{" "}
                    <span className="font-mono text-white text-[10px]">
                      {selectedUser.id.slice(0, 18)}...
                    </span>
                  </div>
                  <div>
                    Phone:{" "}
                    <span className="text-white">{selectedUser.mobile}</span>
                  </div>
                  <div>
                    Referral:{" "}
                    <span className="font-mono font-bold text-amber-300">
                      {selectedUser.referralCode}
                    </span>
                  </div>
                  <div>
                    Signup:{" "}
                    <span className="text-white">
                      {selectedUser.signupDate}
                    </span>
                  </div>
                  <div>
                    Wallet:{" "}
                    <span className="text-emerald-400 font-bold">
                      ₹{selectedUser.walletBalance}
                    </span>
                  </div>
                  <div>
                    Earnings:{" "}
                    <span className="text-emerald-300 font-bold">
                      ₹{selectedUser.totalReferralEarnings}
                    </span>
                  </div>
                  <div>
                    Referred Users:{" "}
                    <span className="text-violet-300 font-bold">
                      {selectedUser.referredUsersCount}
                    </span>
                  </div>
                  <div>
                    Last IP:{" "}
                    <span className="text-white font-mono">
                      {selectedUser.lastLoginIp}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <h4 className="font-bold text-pink-300 uppercase tracking-wider text-[11px]">
                  🔐 Login History
                </h4>
                {isLoadingHistory ? (
                  <p className="text-slate-400">Loading...</p>
                ) : userLoginHistory.length === 0 ? (
                  <p className="text-slate-500">No login history found.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {userLoginHistory.map((h) => (
                      <div
                        key={h.id}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-[11px]"
                      >
                        <div>
                          <p className="font-semibold text-white">
                            {h.loginTime}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {h.browser} • IP: {h.ipAddress}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          Login
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleToggleSubscription(selectedUser)}
                  className={`flex-1 py-2.5 rounded-2xl font-bold text-xs cursor-pointer ${
                    selectedUser.subscriptionStatus === "PREMIUM"
                      ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                      : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  }`}
                >
                  {selectedUser.subscriptionStatus === "PREMIUM"
                    ? "Revoke Premium ⚡"
                    : "Grant Premium 💎"}
                </button>
                <button
                  onClick={() => handleToggleUserBlock(selectedUser)}
                  className={`flex-1 py-2.5 rounded-2xl font-bold text-xs cursor-pointer ${
                    selectedUser.accountStatus === "ACTIVE"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {selectedUser.accountStatus === "ACTIVE"
                    ? "Block Account ⛔"
                    : "Unblock ✅"}
                </button>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="w-full py-2.5 rounded-2xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ WITHDRAWAL PROCESS MODAL ══════════════════════════════════════ */}
      <AnimatePresence>
        {actionWithdrawal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isProcessingWd)
                setActionWithdrawal(null)
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm p-6 rounded-3xl bg-slate-900 border border-slate-700 text-white space-y-5"
            >
              <div>
                <h3 className="text-lg font-bold font-serif">
                  Process Withdrawal
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {actionWithdrawal.requestId}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <p className="text-xs text-slate-300">
                  <span className="text-slate-500">User:</span>{" "}
                  {actionWithdrawal.userName}
                </p>
                <p className="text-xs text-slate-300">
                  <span className="text-slate-500">Email:</span>{" "}
                  {actionWithdrawal.email}
                </p>
                <p className="text-lg font-bold text-emerald-400 font-serif">
                  ₹{actionWithdrawal.amount}
                </p>
                <p className="text-xs font-mono text-pink-300">
                  {actionWithdrawal.paymentDetails}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                  Payment Ref / UTR ID
                </label>
                <input
                  type="text"
                  value={withdrawRefId}
                  onChange={(e) => setWithdrawRefId(e.target.value)}
                  placeholder="e.g. UTR/99214812/IMPS"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                  Admin Notes
                </label>
                <textarea
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="e.g. Processed via HDFC Netbanking"
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none resize-none focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => setActionWithdrawal(null)}
                  disabled={isProcessingWd}
                  className="py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleWithdrawalAction("REJECT")}
                  disabled={isProcessingWd}
                  className="py-2.5 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {isProcessingWd ? "..." : "Reject ❌"}
                </button>
                <button
                  onClick={() => handleWithdrawalAction("APPROVE")}
                  disabled={isProcessingWd}
                  className="py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {isProcessingWd ? "..." : "Approve ✅"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ ADD ADMIN MODAL ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAddAdminModal && admin.role === "SUPER_ADMIN" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAddAdminModal(false)
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-700 text-white space-y-4"
            >
              <h3 className="text-lg font-bold font-serif">Add Staff Admin</h3>
              <form onSubmit={handleCreateStaffAdmin} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Admin full name"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                    Password (min 12 chars)
                  </label>
                  <input
                    type="password"
                    required
                    value={newAdminPass}
                    onChange={(e) => setNewAdminPass(e.target.value)}
                    placeholder="Strong password required"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                    Role
                  </label>
                  <select
                    value={newAdminRole}
                    onChange={(e) => setNewAdminRole(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                  >
                    <option value="ADMIN">ADMIN — Standard access</option>
                    <option value="SUPER_ADMIN">
                      SUPER_ADMIN — Full access
                    </option>
                  </select>
                </div>
                {adminFormMsg && (
                  <p className="text-xs text-rose-400 font-semibold">
                    ⚠️ {adminFormMsg}
                  </p>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddAdminModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 cursor-pointer hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingAdmin}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {isCreatingAdmin ? "Creating..." : "Create Admin 👑"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
