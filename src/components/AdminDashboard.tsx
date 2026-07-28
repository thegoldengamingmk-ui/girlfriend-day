import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type AdminUser,
  logoutAdminSession,
  logAdminAction,
  getRegisteredAdmins,
  createStaffAdmin,
  toggleAdminStatus,
  deleteAdminAccount,
  hashPassword,
} from '../lib/adminAuthService'
import {
  getAdminUsers,
  getAdminTransactions,
  getAdminWithdrawals,
  getUserLoginHistory,
  toggleUserStatus,
  updateWithdrawalStatus,
  subscribeToAdminRealtimeUpdates,
  downloadCSV,
  type AdminUserRecord,
  type PaymentTransaction,
  type WithdrawalRecord,
  type UserLoginRecord,
} from '../lib/adminDataService'

type AdminTab =
  | 'home'
  | 'users'
  | 'payments'
  | 'subscriptions'
  | 'referrals'
  | 'withdrawals'
  | 'cms'
  | 'notifications'
  | 'analytics'
  | 'settings'
  | 'admins'
  | 'security'

export function AdminDashboard({
  admin,
  onLogout,
}: {
  admin: AdminUser
  onLogout: () => void
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>('home')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // Live Supabase Data States (0 Default / Clean State)
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])
  const [adminAccounts, setAdminAccounts] = useState<AdminUser[]>([])

  // User Profile Drawer State
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null)
  const [userLoginHistory, setUserLoginHistory] = useState<UserLoginRecord[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Filters & Search
  const [userSearch, setUserSearch] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('ALL')
  const [paymentSearch, setPaymentSearch] = useState('')

  // Withdrawal Action Modal State
  const [actionWithdrawal, setActionWithdrawal] = useState<WithdrawalRecord | null>(null)
  const [withdrawRefId, setWithdrawRefId] = useState('')
  const [withdrawNotes, setWithdrawNotes] = useState('')

  // Staff Admin Modal State
  const [showAddAdminModal, setShowAddAdminModal] = useState(false)
  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPass, setNewAdminPass] = useState('')
  const [newAdminPermissions, setNewAdminPermissions] = useState<string[]>([
    'manage_users',
    'manage_payments',
    'approve_withdrawals',
  ])

  // Security Form State
  const [newPassword, setNewPassword] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [passMsg, setPassMsg] = useState('')

  // Load Real Data from Supabase
  const reloadSupabaseData = async () => {
    const liveUsers = await getAdminUsers()
    const liveTransactions = await getAdminTransactions()
    const liveWithdrawals = await getAdminWithdrawals()
    setUsers(liveUsers)
    setTransactions(liveTransactions)
    setWithdrawals(liveWithdrawals)
    setAdminAccounts(getRegisteredAdmins())
  }

  useEffect(() => {
    reloadSupabaseData()
    // Subscribe to Supabase Realtime changes
    const unsubscribe = subscribeToAdminRealtimeUpdates(() => {
      reloadSupabaseData()
    })
    return () => unsubscribe()
  }, [])

  // Load User Login History on profile drawer view
  useEffect(() => {
    if (selectedUser) {
      setIsLoadingHistory(true)
      getUserLoginHistory(selectedUser.id).then((history) => {
        setUserLoginHistory(history)
        setIsLoadingHistory(false)
      })
    }
  }, [selectedUser])

  const handleToggleUserBlock = async (user: AdminUserRecord) => {
    await toggleUserStatus(user.id, user.accountStatus)
    logAdminAction(admin.id, admin.email, 'TOGGLE_USER_STATUS', `Toggled account status for ${user.email}`)
    await reloadSupabaseData()
  }

  const handleUpdateWithdrawal = async (status: 'APPROVED' | 'REJECTED' | 'PAID') => {
    if (!actionWithdrawal) return
    await updateWithdrawalStatus(actionWithdrawal.id, status, withdrawNotes, withdrawRefId)
    logAdminAction(admin.id, admin.email, `WITHDRAWAL_${status}`, `Updated withdrawal request ${actionWithdrawal.requestId} to ${status}`)
    setActionWithdrawal(null)
    setWithdrawRefId('')
    setWithdrawNotes('')
    await reloadSupabaseData()
  }

  const handleCreateStaffAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (admin.role !== 'SUPER_ADMIN') {
      alert('Forbidden: Only SUPER_ADMIN can create staff admins!')
      return
    }

    try {
      const created = await createStaffAdmin(
        newAdminName,
        newAdminEmail,
        newAdminPass,
        'ADMIN',
        newAdminPermissions
      )
      setAdminAccounts(getRegisteredAdmins())
      logAdminAction(admin.id, admin.email, 'CREATE_STAFF_ADMIN', `Created staff admin ${created.email}`)
      setShowAddAdminModal(false)
      setNewAdminName('')
      setNewAdminEmail('')
      setNewAdminPass('')
    } catch (err: any) {
      alert(err?.message || 'Failed to create staff admin.')
    }
  }

  const handleToggleAdminStatus = (id: string) => {
    const updated = toggleAdminStatus(id)
    setAdminAccounts(updated)
    logAdminAction(admin.id, admin.email, 'TOGGLE_ADMIN_STATUS', `Toggled admin account status for ${id}`)
  }

  const handleDeleteAdmin = (id: string) => {
    const updated = deleteAdminAccount(id)
    setAdminAccounts(updated)
    logAdminAction(admin.id, admin.email, 'DELETE_ADMIN', `Deleted admin account ${id}`)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setPassMsg('⚠️ New password must be at least 8 characters long.')
      return
    }
    const hash = await hashPassword(newPassword)
    localStorage.setItem(`admin_hash_${admin.id}`, hash)
    setPassMsg('✨ Admin Password Changed Successfully!')
    logAdminAction(admin.id, admin.email, 'CHANGE_PASSWORD', 'Updated admin login password')
  }

  const handleExportUsersCSV = () => {
    const headers = ['User ID', 'Name', 'Email', 'Mobile', 'Subscription', 'Referral Code', 'Referred Users', 'Total Earnings', 'Status']
    const rows = users.map((u) => [
      u.id,
      u.name,
      u.email,
      u.mobile,
      u.subscriptionStatus,
      u.referralCode,
      u.referredUsersCount,
      u.totalReferralEarnings,
      u.accountStatus,
    ])
    downloadCSV(`Users_Export_${Date.now()}.csv`, headers, rows)
    logAdminAction(admin.id, admin.email, 'EXPORT_USERS_CSV', 'Exported Users dataset to CSV')
  }

  const handleExportPaymentsCSV = () => {
    const headers = ['Transaction ID', 'User Name', 'Email', 'Amount', 'Gateway', 'Status', 'Plan', 'Date']
    const rows = transactions.map((t) => [
      t.transactionId,
      t.userName,
      t.email,
      t.amount,
      t.gateway,
      t.status,
      t.plan,
      t.date,
    ])
    downloadCSV(`Payments_Export_${Date.now()}.csv`, headers, rows)
    logAdminAction(admin.id, admin.email, 'EXPORT_PAYMENTS_CSV', 'Exported Payment records to CSV')
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()) || u.referralCode.toLowerCase().includes(userSearch.toLowerCase())
    const matchesFilter = userStatusFilter === 'ALL' || u.subscriptionStatus === userStatusFilter || u.accountStatus === userStatusFilter
    return matchesSearch && matchesFilter
  })

  const filteredPayments = transactions.filter((t) =>
    t.transactionId.toLowerCase().includes(paymentSearch.toLowerCase()) ||
    t.userName.toLowerCase().includes(paymentSearch.toLowerCase()) ||
    t.email.toLowerCase().includes(paymentSearch.toLowerCase())
  )

  const totalRevenue = transactions.filter((t) => t.status === 'SUCCESS').reduce((acc, curr) => acc + curr.amount, 0)
  const totalUsers = users.length
  const activeSubscribers = users.filter((u) => u.subscriptionStatus === 'PREMIUM').length
  const pendingWdAmount = withdrawals.filter((w) => w.status === 'PENDING').reduce((acc, curr) => acc + curr.amount, 0)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans">
      {/* ── SIDEBAR NAVIGATION ── */}
      <aside
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } transition-all duration-300 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between z-30 select-none`}
      >
        <div>
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-pink-500/20 shrink-0">
                🛡️
              </div>
              {isSidebarOpen && (
                <div className="truncate">
                  <h1 className="font-bold text-sm text-white leading-snug">Owner Portal</h1>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 uppercase tracking-wider">
                    {admin.role}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-xs"
            >
              {isSidebarOpen ? '◀' : '▶'}
            </button>
          </div>

          <nav className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-140px)]">
            {[
              { id: 'home', label: 'Dashboard Home', icon: '📊' },
              { id: 'users', label: 'User Management', icon: '👥', badge: users.length },
              { id: 'payments', label: 'Payments', icon: '💳', badge: `₹${totalRevenue}` },
              { id: 'subscriptions', label: 'Subscriptions', icon: '💎' },
              { id: 'referrals', label: 'Referral System', icon: '🎁' },
              { id: 'withdrawals', label: 'Withdrawals Queue', icon: '💸', badge: withdrawals.filter((w) => w.status === 'PENDING').length },
              { id: 'cms', label: 'Website CMS', icon: '🖼️' },
              { id: 'admins', label: 'Admin Management', icon: '👑', isSuperOnly: true },
              { id: 'security', label: 'Security & 2FA', icon: '🛡️' },
            ]
              .filter((tab) => !tab.isSuperOnly || admin.role === 'SUPER_ADMIN')
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-pink-500/20 to-rose-500/20 text-pink-300 border border-pink-500/30 shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="text-base">{tab.icon}</span>
                    {isSidebarOpen && <span className="truncate">{tab.label}</span>}
                  </div>
                  {isSidebarOpen && tab.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-pink-300 border border-slate-700">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
          </nav>
        </div>

        {isSidebarOpen && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/50">
            <div className="flex items-center justify-between mb-3">
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">{admin.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{admin.email}</p>
              </div>
            </div>
            <button
              onClick={() => {
                logoutAdminSession()
                onLogout()
              }}
              className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              🚪 Logout Admin
            </button>
          </div>
        )}
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-950">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-800">
          <div>
            <h2 className="text-2xl font-bold text-white capitalize font-serif flex items-center gap-2">
              {activeTab === 'home' && '📊 Executive Dashboard Overview'}
              {activeTab === 'users' && '👥 User Management'}
              {activeTab === 'payments' && '💳 Payment Records'}
              {activeTab === 'subscriptions' && '💎 Subscription Controls'}
              {activeTab === 'referrals' && '🎁 Referral Engine'}
              {activeTab === 'withdrawals' && '💸 Withdrawal Requests Queue'}
              {activeTab === 'cms' && '🖼️ Website CMS Editor'}
              {activeTab === 'admins' && '👑 Super Admin Staff Control'}
              {activeTab === 'security' && '🛡️ Security Settings & 2FA'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Supabase Live Data Active</span>
              <span>• Role: <strong className="text-pink-300">{admin.role}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportUsersCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              📥 Export Users
            </button>
            <button
              onClick={handleExportPaymentsCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-md transition-colors cursor-pointer"
            >
              💸 Export Revenue
            </button>
          </div>
        </header>

        {/* DASHBOARD HOME */}
        {activeTab === 'home' && (
          <div className="space-y-8 animate-fade-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
                <span className="text-xs font-bold uppercase text-slate-400">Total Users</span>
                <p className="text-2xl font-bold text-white font-serif">{totalUsers}</p>
                <p className="text-[10px] text-slate-400 mt-1">Live from database</p>
              </div>
              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
                <span className="text-xs font-bold uppercase text-slate-400">Subscribers</span>
                <p className="text-2xl font-bold text-pink-300 font-serif">{activeSubscribers}</p>
                <p className="text-[10px] text-slate-400 mt-1">Active Premium</p>
              </div>
              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
                <span className="text-xs font-bold uppercase text-slate-400">Total Revenue</span>
                <p className="text-2xl font-bold text-emerald-400 font-serif">₹{totalRevenue}</p>
                <p className="text-[10px] text-slate-400 mt-1">Successful Payments</p>
              </div>
              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
                <span className="text-xs font-bold uppercase text-slate-400">Pending Withdrawals</span>
                <p className="text-2xl font-bold text-rose-400 font-serif">₹{pendingWdAmount}</p>
                <p className="text-[10px] text-slate-400 mt-1">Awaiting Approval</p>
              </div>
              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
                <span className="text-xs font-bold uppercase text-slate-400">Admin Role</span>
                <p className="text-lg font-bold text-amber-300 font-serif">{admin.role}</p>
                <p className="text-[10px] text-slate-400 mt-1">Full Access</p>
              </div>
            </div>
          </div>
        )}

        {/* USER MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="🔍 Search user by Name, Email or Referral Code..."
                className="w-full sm:w-96 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
              />
              <div className="flex gap-2">
                {['ALL', 'PREMIUM', 'FREE', 'BLOCKED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setUserStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      userStatusFilter === st ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center p-12 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
                <div className="text-4xl">👥</div>
                <h3 className="text-lg font-bold text-white font-serif">No Users Found</h3>
                <p className="text-xs text-slate-400">There are currently no registered users matching your criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="p-4">User</th>
                      <th className="p-4">Mobile</th>
                      <th className="p-4">Subscription</th>
                      <th className="p-4">Referral Code</th>
                      <th className="p-4">Last Login</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white">{u.name}</div>
                          <div className="text-slate-400 text-[11px] font-mono">{u.email}</div>
                        </td>
                        <td className="p-4 text-slate-300 font-mono">{u.mobile}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              u.subscriptionStatus === 'PREMIUM'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {u.subscriptionStatus}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-pink-300">{u.referralCode}</td>
                        <td className="p-4 text-slate-400 font-mono text-[11px]">{u.lastLogin}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              u.accountStatus === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {u.accountStatus}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
                          >
                            View Profile
                          </button>
                          <button
                            onClick={() => handleToggleUserBlock(u)}
                            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
                              u.accountStatus === 'ACTIVE'
                                ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                            }`}
                          >
                            {u.accountStatus === 'ACTIVE' ? 'Block' : 'Unblock'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex justify-between items-center bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              <input
                type="text"
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                placeholder="🔍 Search Transaction ID or Email..."
                className="w-80 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
              />
              <span className="text-xs font-semibold text-emerald-400">
                Razorpay Webhook: Active
              </span>
            </div>

            {filteredPayments.length === 0 ? (
              <div className="text-center p-12 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
                <div className="text-4xl">💳</div>
                <h3 className="text-lg font-bold text-white font-serif">No Payment Records</h3>
                <p className="text-xs text-slate-400">No payment transactions found in database.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="p-4">Transaction ID</th>
                      <th className="p-4">User</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Gateway</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredPayments.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-pink-300">{t.transactionId}</td>
                        <td className="p-4">
                          <div className="font-bold text-white">{t.userName}</div>
                          <div className="text-slate-400 text-[11px] font-mono">{t.email}</div>
                        </td>
                        <td className="p-4 font-bold text-emerald-400 font-serif text-sm">₹{t.amount}</td>
                        <td className="p-4 text-slate-300 font-semibold">{t.gateway}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              t.status === 'SUCCESS'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 font-mono">{t.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* WITHDRAWALS QUEUE */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-6 animate-fade-up">
            {withdrawals.length === 0 ? (
              <div className="text-center p-12 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
                <div className="text-4xl">💸</div>
                <h3 className="text-lg font-bold text-white font-serif">No Withdrawal Requests</h3>
                <p className="text-xs text-slate-400">No user withdrawal requests currently pending in database.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="p-4">Request ID</th>
                      <th className="p-4">User</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">UPI / Bank Details</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-amber-300">{w.requestId}</td>
                        <td className="p-4">
                          <div className="font-bold text-white">{w.userName}</div>
                          <div className="text-slate-400 text-[11px] font-mono">{w.email}</div>
                        </td>
                        <td className="p-4 font-bold text-emerald-400 font-serif text-sm">₹{w.amount}</td>
                        <td className="p-4 text-slate-200 font-mono">{w.paymentDetails}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              w.status === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : w.status === 'PENDING'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {w.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => setActionWithdrawal(w)}
                            className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold cursor-pointer"
                          >
                            Process
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── USER PROFILE DRAWER MODAL ── */}
      {selectedUser && (
        <div className="fixed inset-0 z-[500] flex items-center justify-end p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg h-full overflow-y-auto p-7 rounded-3xl bg-slate-900 border border-slate-700 text-white space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-bold font-serif text-white">{selectedUser.name}</h3>
                <p className="text-xs text-pink-300 font-mono">{selectedUser.email}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Personal Information */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <h4 className="font-bold text-pink-300 uppercase tracking-wider text-[11px]">Personal & Account Info</h4>
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>User ID: <span className="font-mono text-white">{selectedUser.id}</span></div>
                <div>Phone: <span className="text-white">{selectedUser.mobile}</span></div>
                <div>Status: <span className="text-emerald-400 font-bold">{selectedUser.accountStatus}</span></div>
                <div>Subscription: <span className="text-pink-300 font-bold">{selectedUser.subscriptionStatus}</span></div>
                <div>Referral Code: <span className="font-mono font-bold text-amber-300">{selectedUser.referralCode}</span></div>
                <div>Signup Date: <span className="text-white">{selectedUser.signupDate}</span></div>
              </div>
            </div>

            {/* Authentication & Login History */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <h4 className="font-bold text-pink-300 uppercase tracking-wider text-[11px]">🔐 Login History & Activity Log</h4>
              {isLoadingHistory ? (
                <p className="text-slate-400 text-xs">Loading login logs...</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {userLoginHistory.map((h) => (
                    <div key={h.id} className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-[11px]">
                      <div>
                        <p className="font-semibold text-white">{h.loginTime}</p>
                        <p className="text-[10px] text-slate-400">{h.browser} • IP: {h.ipAddress}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">Authenticated</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment & Withdrawal Actions */}
            <div className="pt-2 flex gap-3">
              <button
                onClick={() => handleToggleUserBlock(selectedUser)}
                className={`flex-1 py-3 rounded-2xl font-bold text-xs cursor-pointer ${
                  selectedUser.accountStatus === 'ACTIVE'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {selectedUser.accountStatus === 'ACTIVE' ? 'Block Account ⛔' : 'Unblock Account ✨'}
              </button>
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-800 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAWAL PROCESS MODAL */}
      {actionWithdrawal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-slate-900 border border-slate-700 text-white space-y-4">
            <h3 className="text-lg font-bold font-serif">Process Withdrawal #{actionWithdrawal.requestId}</h3>
            <p className="text-xs text-slate-400">User: {actionWithdrawal.userName} ({actionWithdrawal.email})</p>
            <p className="text-sm font-bold text-emerald-400 font-serif">Amount: ₹{actionWithdrawal.amount}</p>
            <p className="text-xs font-mono text-pink-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800">{actionWithdrawal.paymentDetails}</p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Payment Reference / UTR ID</label>
              <input
                type="text"
                value={withdrawRefId}
                onChange={(e) => setWithdrawRefId(e.target.value)}
                placeholder="e.g. UTR/99214812/IMPS"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Admin Notes</label>
              <textarea
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
                placeholder="e.g. Processed via HDFC Netbanking"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setActionWithdrawal(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateWithdrawal('PAID')}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Mark Paid 💸
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
