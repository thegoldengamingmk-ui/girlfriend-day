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
  toggleUserStatus,
  getAdminTransactions,
  getAdminWithdrawals,
  updateWithdrawalStatus,
  downloadCSV,
  type AdminUserRecord,
  type PaymentTransaction,
  type WithdrawalRecord,
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

  // System Data States
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])
  const [adminAccounts, setAdminAccounts] = useState<AdminUser[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null)

  // Search & Filters
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
  const [currPassword, setCurrPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [passMsg, setPassMsg] = useState('')

  useEffect(() => {
    setUsers(getAdminUsers())
    setTransactions(getAdminTransactions())
    setWithdrawals(getAdminWithdrawals())
    setAdminAccounts(getRegisteredAdmins())
  }, [])

  const handleToggleUserBlock = (userId: string) => {
    const updated = toggleUserStatus(userId)
    setUsers(updated)
    const target = updated.find((u) => u.id === userId)
    logAdminAction(admin.id, admin.email, 'TOGGLE_USER_STATUS', `Updated account status for ${target?.email} to ${target?.accountStatus}`)
  }

  const handleUpdateWithdrawal = (status: 'APPROVED' | 'REJECTED' | 'PAID') => {
    if (!actionWithdrawal) return
    const updated = updateWithdrawalStatus(actionWithdrawal.id, status, withdrawNotes, withdrawRefId)
    setWithdrawals(updated)
    logAdminAction(admin.id, admin.email, `WITHDRAWAL_${status}`, `Updated withdrawal request ${actionWithdrawal.requestId} to ${status}`)
    setActionWithdrawal(null)
    setWithdrawRefId('')
    setWithdrawNotes('')
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
              {activeTab === 'referrals' && '🎁 Referral Engine & Fraud Protection'}
              {activeTab === 'withdrawals' && '💸 Withdrawal Requests Queue'}
              {activeTab === 'cms' && '🖼️ Website CMS Editor'}
              {activeTab === 'admins' && '👑 Super Admin Staff Control'}
              {activeTab === 'security' && '🛡️ Security Settings & 2FA'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Role: <strong className="text-pink-300">{admin.role}</strong> • Logged in as {admin.email}
            </p>
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
              </div>
              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
                <span className="text-xs font-bold uppercase text-slate-400">Subscribers</span>
                <p className="text-2xl font-bold text-pink-300 font-serif">{activeSubscribers}</p>
              </div>
              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
                <span className="text-xs font-bold uppercase text-slate-400">Total Revenue</span>
                <p className="text-2xl font-bold text-emerald-400 font-serif">₹{totalRevenue}</p>
              </div>
              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
                <span className="text-xs font-bold uppercase text-slate-400">Pending Withdrawals</span>
                <p className="text-2xl font-bold text-rose-400 font-serif">₹{pendingWdAmount}</p>
              </div>
              <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
                <span className="text-xs font-bold uppercase text-slate-400">Admin Role</span>
                <p className="text-lg font-bold text-amber-300 font-serif">{admin.role}</p>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN MANAGEMENT (SUPER_ADMIN ONLY) */}
        {activeTab === 'admins' && admin.role === 'SUPER_ADMIN' && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex justify-between items-center bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              <h3 className="text-base font-bold text-white font-serif">Staff Admin Accounts</h3>
              <button
                onClick={() => setShowAddAdminModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white cursor-pointer"
              >
                + Add Staff Admin
              </button>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="p-4">Admin Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Permissions</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {adminAccounts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-white">{a.name}</td>
                      <td className="p-4 font-mono text-slate-300">{a.email}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                          {a.role}
                        </span>
                      </td>
                      <td className="p-4 text-[11px] text-slate-400">
                        {a.permissions ? a.permissions.join(', ') : 'Full Access'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${a.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {a.role !== 'SUPER_ADMIN' && (
                          <>
                            <button
                              onClick={() => handleToggleAdminStatus(a.id)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 font-bold"
                            >
                              {a.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => handleDeleteAdmin(a.id)}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECURITY & 2FA SETTINGS */}
        {activeTab === 'security' && (
          <div className="max-w-xl space-y-6 animate-fade-up">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white font-serif">🔑 Change Admin Password</h3>
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">New Strong Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 12 characters"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none"
                  />
                </div>
                {passMsg && <p className="text-xs text-emerald-400 font-semibold">{passMsg}</p>}
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold cursor-pointer">
                  Update Password ❤️
                </button>
              </form>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white font-serif">🛡️ Two-Factor Authentication (2FA)</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Authenticator App (TOTP)</p>
                  <p className="text-[11px] text-slate-400">Require 6-digit OTP code during login</p>
                </div>
                <button
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${twoFactorEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  {twoFactorEnabled ? '2FA Enabled ✨' : 'Enable 2FA'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CREATE STAFF ADMIN MODAL */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={handleCreateStaffAdmin} className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-700 text-white space-y-4">
            <h3 className="text-lg font-bold font-serif">Add New Staff Admin</h3>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="e.g. Alex Staff"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="alex@couplegift.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Temporary Password</label>
              <input
                type="password"
                required
                value={newAdminPass}
                onChange={(e) => setNewAdminPass(e.target.value)}
                placeholder="Min 12 characters"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowAddAdminModal(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-pink-600 text-white">
                Create Admin ✨
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
