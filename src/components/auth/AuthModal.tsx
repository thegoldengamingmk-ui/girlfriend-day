import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  signUpUser,
  signInUser,
  verifyEmailCode,
  resendVerificationEmail,
  checkResendCooldown,
} from '../../lib/authService'

interface AuthModalProps {
  isOpen: boolean
  initialTab?: 'signin' | 'signup'
  onClose: () => void
  onSuccess: (userProfile: any) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialTab = 'signup',
  onClose,
  onSuccess,
}) => {
  const [view, setView] = useState<'signin' | 'signup' | 'verify'>(initialTab)

  // Form inputs
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Resend cooldown timer
  const [resendTimer, setResendTimer] = useState(0)

  useEffect(() => {
    setView(initialTab)
    setErrorMsg('')
    setSuccessMsg('')
  }, [initialTab, isOpen])

  useEffect(() => {
    let interval: any
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [resendTimer])

  if (!isOpen) return null

  // Handle Signup
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.')
      return
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.')
      return
    }

    setIsLoading(true)
    setLoadingText('Signing Up...')
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await signUpUser(fullName, email, password)
      setIsLoading(false)

      if (res.needsVerification) {
        setView('verify')
        setSuccessMsg('Account created! Please check your email for the 6-digit verification code.')
        setResendTimer(60)
      } else if (res.user) {
        setSuccessMsg('Account created successfully!')
        onSuccess(res)
      }
    } catch (err: any) {
      setIsLoading(false)
      setErrorMsg(err.message || 'Failed to create account.')
    }
  }

  // Handle Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.')
      return
    }

    setIsLoading(true)
    setLoadingText('Logging In...')
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await signInUser(email, password)
      setIsLoading(false)
      setSuccessMsg('Logged in successfully!')
      onSuccess(res.profile)
    } catch (err: any) {
      setIsLoading(false)
      if (err.message === 'UNVERIFIED_EMAIL') {
        setView('verify')
        setErrorMsg('Please verify your email before logging in.')
        setResendTimer(60)
      } else {
        setErrorMsg(err.message || 'Failed to sign in.')
      }
    }
  }

  // Handle Verification OTP submission
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setErrorMsg('Please enter the complete 6-digit verification code.')
      return
    }

    setIsLoading(true)
    setLoadingText('Verifying...')
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await verifyEmailCode(email, otpCode)
      setIsLoading(false)
      setSuccessMsg('Verification successful!')
      onSuccess(res.profile)
    } catch (err: any) {
      setIsLoading(false)
      setErrorMsg(err.message || 'Invalid verification code. Please try again.')
    }
  }

  // Handle Resend Verification Email
  const handleResend = async () => {
    const cooldown = checkResendCooldown(email)
    if (!cooldown.allowed) {
      setResendTimer(cooldown.remainingSeconds)
      setErrorMsg(`Please wait ${cooldown.remainingSeconds} seconds before requesting another email.`)
      return
    }

    setIsLoading(true)
    setLoadingText('Sending Verification Email...')
    setErrorMsg('')
    setSuccessMsg('')

    try {
      await resendVerificationEmail(email)
      setIsLoading(false)
      setSuccessMsg('A new verification email has been sent! Check your inbox.')
      setResendTimer(60)
    } catch (err: any) {
      setIsLoading(false)
      setErrorMsg(err.message || 'Failed to resend verification email.')
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

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl text-white shadow-2xl overflow-hidden border border-pink-400/30"
          style={{
            background: 'linear-gradient(135deg, rgba(22, 5, 42, 0.98), rgba(60, 10, 52, 0.98))',
            backdropFilter: 'blur(28px)',
            boxShadow: '0 25px 70px rgba(0,0,0,0.85), 0 0 50px rgba(255,105,180,0.2)',
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2
                className="text-2xl font-extrabold text-white tracking-tight"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {view === 'verify'
                  ? 'Verify Email'
                  : view === 'signup'
                  ? 'Create Account'
                  : 'Welcome Back'}
              </h2>
              <p className="text-xs text-pink-200/70 mt-1">
                {view === 'verify'
                  ? `Enter verification code sent to ${email}`
                  : view === 'signup'
                  ? 'Sign up to unlock your referral link & dashboard'
                  : 'Log in to access your referral earnings'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-pink-200 hover:text-white transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Navigation Tabs (Signin / Signup) */}
          {view !== 'verify' && (
            <div className="flex bg-white/5 p-1 rounded-2xl mb-6 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setView('signup')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  view === 'signup'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md'
                    : 'text-pink-200/70 hover:text-white'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('signin')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  view === 'signin'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md'
                    : 'text-pink-200/70 hover:text-white'
                }`}
              >
                Sign In
              </button>
            </div>
          )}

          {/* Alert Banners */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-medium leading-relaxed flex items-start gap-2.5"
            >
              <span className="text-base leading-none">⚠️</span>
              <div className="flex-1">{errorMsg}</div>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-medium leading-relaxed flex items-start gap-2.5"
            >
              <span className="text-base leading-none">✅</span>
              <div className="flex-1">{successMsg}</div>
            </motion.div>
          )}

          {/* Form Views */}
          {view === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-pink-200/80 mb-1.5">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/50 transition-all placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-pink-200/80 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/50 transition-all placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-pink-200/80 mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/50 transition-all placeholder:text-white/30"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 shadow-lg shadow-pink-500/25 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span>{loadingText}</span>
                  </>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </form>
          )}

          {view === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-pink-200/80 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/50 transition-all placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-pink-200/80 mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/50 transition-all placeholder:text-white/30"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 shadow-lg shadow-pink-500/25 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span>{loadingText}</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          )}

          {view === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-pink-200/80 mb-1.5">
                  6-Digit Verification Code *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-center font-mono text-xl tracking-[0.4em] font-bold text-white focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/50 transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-white/30"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 shadow-lg shadow-pink-500/25 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span>{loadingText}</span>
                  </>
                ) : (
                  <span>Verify Email</span>
                )}
              </button>

              <div className="pt-2 border-t border-white/10 text-center">
                <button
                  type="button"
                  disabled={isLoading || resendTimer > 0}
                  onClick={handleResend}
                  className="text-xs font-semibold text-pink-300 hover:text-white disabled:opacity-50 cursor-pointer transition-all"
                >
                  {resendTimer > 0
                    ? `Resend Email in ${resendTimer}s`
                    : 'Resend Verification Email'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
