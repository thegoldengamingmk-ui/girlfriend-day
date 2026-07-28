import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { verifyAdminLogin, type AdminUser } from '../lib/adminAuthService'

export function AdminLoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: (admin: AdminUser) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')

    try {
      const admin = await verifyAdminLogin(email, password)
      onLoginSuccess(admin)
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid email or password.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative z-10 w-full max-w-sm p-7 rounded-3xl text-white shadow-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98))',
            backdropFilter: 'blur(24px)',
            border: '1.5px solid rgba(232, 120, 154, 0.35)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.85), 0 0 40px rgba(232,120,154,0.2)',
          }}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-400/40 flex items-center justify-center text-3xl shadow-lg">
              🛡️
            </div>
            <h2
              className="text-2xl font-bold text-white mb-1"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Super Admin Portal
            </h2>
            <p className="text-xs text-slate-400">
              Restricted owner access • SSL Encrypted Session
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                Admin Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@couplegift.com"
                className="w-full px-4 py-3 rounded-2xl bg-slate-900/80 border border-slate-700 text-xs text-white outline-none focus:border-pink-500 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-300/80 mb-1">
                Secure Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 rounded-2xl bg-slate-900/80 border border-slate-700 text-xs text-white outline-none focus:border-pink-500 transition-colors"
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
                className="flex-1 py-3.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-lg shadow-pink-500/25 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : "Login to Admin 🛡️"}
              </button>
            </div>
          </form>

          <p className="text-[10px] text-slate-500 text-center mt-6">
            IP: 127.0.0.1 • Authorized Personnel Only
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
