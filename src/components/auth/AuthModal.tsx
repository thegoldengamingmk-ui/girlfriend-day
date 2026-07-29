import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signInWithGoogle } from '../../lib/authService'

interface AuthModalProps {
  isOpen: boolean
  initialTab?: 'signin' | 'signup'
  onClose: () => void
  onSuccess: (userProfile: any) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    setErrorMsg('')

    try {
      const profile = await signInWithGoogle()
      setIsLoading(false)
      onSuccess(profile)
    } catch (err: any) {
      setIsLoading(false)
      setErrorMsg(err.message || 'Google Sign-In failed. Please try again.')
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative z-10 w-full max-w-sm p-6 sm:p-8 rounded-3xl text-center text-white shadow-2xl overflow-hidden border border-pink-400/30"
          style={{
            background: 'linear-gradient(135deg, rgba(22, 5, 42, 0.98), rgba(60, 10, 52, 0.98))',
            backdropFilter: 'blur(28px)',
            boxShadow: '0 25px 70px rgba(0,0,0,0.85), 0 0 50px rgba(255,105,180,0.2)',
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-pink-200 hover:text-white transition-all cursor-pointer"
          >
            ✕
          </button>

          {/* Header Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-400/30 flex items-center justify-center text-3xl shadow-lg">
            🎁
          </div>

          <h2
            className="text-2xl font-bold text-white mb-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Welcome to Gift Surprise
          </h2>

          <p className="text-xs text-pink-200/75 mb-6 font-sans leading-relaxed">
            Sign in with Google to unlock your referral link, track your earnings, and access your dashboard.
          </p>

          {/* Error Banner */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-medium flex items-center gap-2 text-left"
            >
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {/* Google Sign-In Button */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleGoogleAuth}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-gray-100 text-gray-800 font-bold text-sm shadow-xl flex items-center justify-center gap-3 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-gray-700" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span className="text-gray-700">Connecting to Google...</span>
              </>
            ) : (
              <>
                {/* Official Google G Logo */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-pink-200/50 mt-4 leading-relaxed">
            By continuing, you agree to access your referral code & dashboard. One-click instant authentication.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
