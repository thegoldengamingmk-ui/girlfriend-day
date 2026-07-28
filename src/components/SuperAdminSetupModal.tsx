import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  isSetupRoutePermanentlyLocked,
  createInitialSuperAdmin,
  type AdminUser,
} from '../lib/adminAuthService'

export function SuperAdminSetupModal({
  isOpen,
  onClose,
  onSetupSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSetupSuccess: (admin: AdminUser) => void
}) {
  const isLocked = isSetupRoutePermanentlyLocked()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked) {
      setErrorMsg('403 Forbidden: Initial Super Admin Setup is Permanently Disabled.')
      return
    }

    setIsLoading(true)
    setErrorMsg('')

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.')
      setIsLoading(false)
      return
    }

    try {
      const newAdmin = await createInitialSuperAdmin(name, email, password)
      onSetupSuccess(newAdmin)
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create Super Admin account.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[450] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md"
        />

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 20 }}
          className="relative z-10 w-full max-w-md p-7 rounded-3xl text-white shadow-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98))',
            backdropFilter: 'blur(24px)',
            border: isLocked ? '1.5px solid rgba(244, 63, 94, 0.5)' : '1.5px solid rgba(232, 120, 154, 0.4)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.85), 0 0 40px rgba(244,63,94,0.2)',
          }}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className={`w-16 h-16 mx-auto mb-3 rounded-2xl ${isLocked ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400' : 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-400/40 text-pink-300'} flex items-center justify-center text-3xl shadow-lg`}>
              {isLocked ? '⛔' : '👑'}
            </div>
            <h2
              className="text-2xl font-bold text-white mb-1"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {isLocked ? '403 Forbidden: Setup Disabled' : 'Super Admin Initial Setup'}
            </h2>
            <p className="text-xs text-slate-400">
              Route `/setup-super-admin` • Security Protocol Active
            </p>
          </div>

          {isLocked ? (
            <div className="text-center p-6 bg-slate-900/90 rounded-2xl border border-rose-500/30 space-y-4">
              <div className="text-4xl">🔒</div>
              <h3 className="text-base font-bold text-rose-400 font-serif">Initial Setup Permanently Locked</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                A master <strong className="text-pink-300">SUPER_ADMIN</strong> account has already been initialized and configured. For system security against unauthorized account creation, this endpoint is <strong className="text-rose-400">permanently disabled</strong>.
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono text-left">
                To re-enable setup, perform a secure database reset or execute admin seed reset from server environment.
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Return to Admin Login 🔐
              </button>
            </div>
          ) : (
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                  Full Name (Website Owner)
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Website Owner"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                  Master Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@couplegift.com"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-700 text-xs text-white outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                  Master Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 12 chars (A-Z, a-z, 0-9, special char)"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter master password"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-700 text-xs text-white outline-none focus:border-pink-500"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-400 text-center font-semibold animate-fade-up">
                  ⚠️ {errorMsg}
                </p>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 rounded-2xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 border border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 shadow-lg shadow-pink-500/25 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoading ? 'Hashing & Creating...' : 'Initialize Super Admin 👑'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
