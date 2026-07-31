import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from "react"
import { motion, AnimatePresence } from "framer-motion"
import { uploadPhoto, uploadVoiceNote, uploadMusicTrack } from "./lib/storage"
import {
  createSurprise,
  getSurpriseBySlug,
  verifyQuestions,
} from "./lib/surpriseService"
import {
  signUpUserWithEmail,
  sendEmailOtp,
  verifyEmailOtpToken,
  signInUserWithPassword,
  sendPasswordResetOtp,
  updatePassword,
  getOrCreateReferralProfile,
  type UserReferralProfile,
} from "./lib/referralService"
import { AdminLoginModal } from "./components/AdminLoginModal"
import { SuperAdminSetupModal } from "./components/SuperAdminSetupModal"
import { AuthModal } from "./components/auth/AuthModal"
import {
  getCurrentSession,
  signOutUser,
  subscribeToAuthChanges,
} from "./lib/authService"
import { validateAndApplyReferralCode } from "./lib/userService"
import { launchRazorpayCheckout } from "./lib/razorpayService"
import { getActiveAdminSession, resetAdminSetupLock, type AdminUser } from "./lib/adminAuthService"
import type { SurpriseDetailResponse, PublicQuestion } from "./types/database"

// Lazy-loaded heavy components (code splitting for faster initial load)
const AdminDashboard = lazy(() =>
  import("./components/AdminDashboard").then((m) => ({
    default: m.AdminDashboard,
  })),
)
const ReferralDashboardModal = lazy(() =>
  import("./components/auth/ReferralDashboardModal").then((m) => ({
    default: m.ReferralDashboardModal,
  })),
)

type Screen = 1 | 2 | 3 | 4 | 5 | 6 | 7 | "dashboard" | "admin-login" | "admin-dashboard" | "setup-super-admin"

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ CONSTANTS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

const ROMANTIC_CAPTIONS = [
  "The day my world changed forever ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â",
  "Every smile with you feels like home ÃƒÂ¢Ã…â€œÃ‚Â¨",
  "My favorite place in the whole world is right next to you ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â¹",
  "Little moments with you become everlasting memories ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â‚¬â€œ",
  "Forever wouldn't be long enough with you ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â‚¬Â¢",
  "You make every single day feel magical ÃƒÂ°Ã…Â¸Ã‚Â¥Ã¢â‚¬Å¡",
  "Our happiest chapter, written together ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â",
]

const MEMORY_QUOTES = [
  "ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œIn all the world, there is no heart for me like yours. In all the world, there is no love for you like mine.ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â",
  "ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œIf I had a flower for every time I thought of you... I could walk through my garden forever.ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â",
  "ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œYou are my today and all of my tomorrows.ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â",
]

const DEFAULT_PHOTOS = [
  "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&h=500&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=400&h=500&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=400&h=500&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&h=500&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1488654715439-fbf461f0eb8d?w=400&h=500&fit=crop&auto=format",
]

const DEFAULT_LETTER = `My dearest love,

Every single day with you feels like a dream I never want to wake up from. You are the reason my mornings are beautiful, my evenings are warm, and my heart is completely full.

On this special Girlfriend Day, I want you to know that loving you is the greatest adventure of my life. You make everything brighter ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â every moment sweeter, every memory worth treasuring forever.

I fall in love with you more every single day, and I am so grateful you are mine.

Thank you for being my person, my peace, my home.

Forever yours, with all my love ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â`

const CONFETTI_COLORS = [
  "#ffc8d6",
  "#f4a0b5",
  "#c4b5fd",
  "#ddb8a0",
  "#ffffff",
  "#ffb3c6",
  "#e8789a",
  "#d4a0c4",
  "#fde8f0",
]

const DARK_BG: React.CSSProperties = {
  background:
    "linear-gradient(135deg, #0d0020 0%, #1a0035 28%, #0e001a 58%, #1a002d 100%)",
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SHARED ATOMS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function FloatingHearts({ n = 12 }: { n?: number }) {
  const items = useRef(
    Array.from({ length: n }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      sz: Math.random() * 16 + 8,
      delay: Math.random() * 12,
      dur: Math.random() * 8 + 6,
      op: Math.random() * 0.3 + 0.08,
    })),
  ).current

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((h) => (
        <div
          key={h.id}
          className="absolute animate-float-heart select-none will-change-transform"
          style={{
            left: `${h.left}%`,
            bottom: "-30px",
            fontSize: `${h.sz}px`,
            animationDelay: `${h.delay}s`,
            animationDuration: `${h.dur}s`,
            opacity: h.op,
          }}
        >
          ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â
        </div>
      ))}
    </div>
  )
}

function Sparkles({ n = 14 }: { n?: number }) {
  const items = useRef(
    Array.from({ length: n }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      sz: Math.random() * 4 + 2,
      delay: Math.random() * 4,
      dur: Math.random() * 2 + 1.2,
    })),
  ).current

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full animate-sparkle will-change-transform"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.sz}px`,
            height: `${s.sz}px`,
            background:
              "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,200,220,0.6) 55%, transparent 100%)",
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
          }}
        />
      ))}
    </div>
  )
}

function GlowOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[
        { c: "rgba(196,181,253,0.14)", pos: "-top-40 -left-40", d: "0s" },
        { c: "rgba(244,160,181,0.14)", pos: "-bottom-40 -right-40", d: "3s" },
        { c: "rgba(255,200,214,0.07)", pos: "top-1/3 right-8", d: "6s" },
      ].map((o, i) => (
        <div
          key={i}
          className={`absolute w-80 h-80 rounded-full animate-float-orb ${o.pos}`}
          style={{
            background: `radial-gradient(circle, ${o.c} 0%, transparent 70%)`,
            animationDelay: o.d,
          }}
        />
      ))}
    </div>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ AUDIO SYSTEM (WEB AUDIO SYNTHESIZER & BGM) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    audioCtx = new AudioCtxClass()
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume()
  }
  return audioCtx
}

export function playButtonSound() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.14) // G5

    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.22)
  } catch {
    // ignore audio restriction
  }
}

export function playTypeSound() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "triangle"
    const freqs = [580, 680, 780, 880]
    const f = freqs[Math.floor(Math.random() * freqs.length)]
    osc.frequency.setValueAtTime(f, ctx.currentTime)

    gain.gain.setValueAtTime(0.04, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.04)
  } catch {
    // ignore
  }
}

function RomanticBGMPlayer() {
  const [isMuted, setIsMuted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const userMutedRef = useRef(false)

  useEffect(() => {
    const audio = new Audio(
      "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    )
    audio.loop = true
    audio.volume = 0.45
    audioRef.current = audio

    const startBGM = () => {
      if (userMutedRef.current) return
      audio
        .play()
        .then(() => {
          setIsPlaying(true)
          setIsMuted(false)
        })
        .catch(() => {
          // Fallback: If unmuted autoplay is restricted by browser policy,
          // start muted audio playback first, then unmute on first user gesture
          audio.muted = true
          audio
            .play()
            .then(() => {
              setIsPlaying(true)
              setIsMuted(true)
            })
            .catch(() => {
              setIsPlaying(false)
            })
        })
    }

    startBGM()

    const handleGesture = () => {
      if (userMutedRef.current) return
      const currentAudio = audioRef.current
      if (currentAudio && (currentAudio.paused || currentAudio.muted)) {
        currentAudio.muted = false
        currentAudio
          .play()
          .then(() => {
            setIsPlaying(true)
            setIsMuted(false)
          })
          .catch(() => {})
      }
    }

    const handlePauseBGM = () => {
      const currentAudio = audioRef.current
      if (currentAudio && !currentAudio.paused) {
        currentAudio.pause()
        setIsPlaying(false)
      }
    }

    const handleResumeBGM = () => {
      const currentAudio = audioRef.current
      if (currentAudio && !userMutedRef.current) {
        currentAudio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {})
      }
    }

    const events = [
      "pointerdown",
      "touchstart",
      "click",
      "keydown",
      "scroll",
      "mousemove",
    ]
    events.forEach((evt) =>
      window.addEventListener(evt, handleGesture, { passive: true }),
    )
    window.addEventListener("pause-bgm", handlePauseBGM)
    window.addEventListener("resume-bgm", handleResumeBGM)

    return () => {
      audio.pause()
      events.forEach((evt) => window.removeEventListener(evt, handleGesture))
      window.removeEventListener("pause-bgm", handlePauseBGM)
      window.removeEventListener("resume-bgm", handleResumeBGM)
    }
  }, [])

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    playButtonSound()
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying && !isMuted) {
      userMutedRef.current = true
      audio.muted = true
      audio.pause()
      setIsMuted(true)
      setIsPlaying(false)
    } else {
      userMutedRef.current = false
      audio.muted = false
      audio.play().then(() => {
        setIsMuted(false)
        setIsPlaying(true)
      })
    }
  }

  return (
    <button
      onClick={toggleMute}
      className="fixed top-4 right-4 z-[150] px-3.5 py-2 rounded-full flex items-center gap-2 text-xs font-medium cursor-pointer transition-all duration-300 hover:scale-105 select-none"
      style={{
        background: isMuted ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.15)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: isMuted
          ? "1px solid rgba(255,255,255,0.18)"
          : "1px solid rgba(255,255,255,0.28)",
        color: "#ffffff",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <span
        className={
          isPlaying && !isMuted
            ? "animate-pulse text-pink-300"
            : "text-pink-200/60"
        }
      >
        {isPlaying && !isMuted
          ? "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Âµ Playing ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Tap to Mute"
          : "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Â¡ Muted ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Tap to Play"}
      </span>
    </button>
  )
}

function Btn({
  children,
  onClick,
  full = false,
  outline = false,
  disabled = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  full?: boolean
  outline?: boolean
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          playButtonSound()
          onClick?.()
        }
      }}
      className={`${
        full ? "w-full" : ""
      } px-8 py-4 rounded-full font-medium transition-all duration-300 ${
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:scale-[1.04] active:scale-[0.97] cursor-pointer"
      } select-none ${!outline && !disabled ? "animate-btn-glow" : ""}`}
      style={
        outline
          ? {
              border: "1.5px solid rgba(232,120,154,0.38)",
              color: "#ffc8d6",
              background: "transparent",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "clamp(0.875rem, 1.8vw, 1.05rem)",
            }
          : {
              background:
                "linear-gradient(135deg, #e8789a 0%, #c9438a 60%, #9e2070 100%)",
              boxShadow:
                "0 6px 24px rgba(232,120,154,0.5), 0 0 55px rgba(200,67,138,0.18)",
              color: "white",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "clamp(0.875rem, 1.8vw, 1.05rem)",
              border: "1px solid rgba(255,255,255,0.15)",
            }
      }
    >
      {children}
    </button>
  )
}

function Glass({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-3xl ${className}`}
      style={{
        background: "rgba(255,255,255,0.07)",
        backdropFilter: "blur(26px)",
        WebkitBackdropFilter: "blur(26px)",
        border: "1px solid rgba(255,255,255,0.13)",
        boxShadow:
          "0 8px 44px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.09)",
      }}
    >
      {children}
    </div>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SCREEN 1 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â LANDING ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function S1({
  onNext,
  onDash,
  girlfriendName,
}: {
  onNext: () => void
  onDash: () => void
  girlfriendName?: string
}) {
  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{ ...DARK_BG, minHeight: "100dvh" }}
    >
      <FloatingHearts n={30} />
      <Sparkles n={36} />
      <GlowOrbs />

      <div className="cinematic-container relative z-10 flex flex-col items-center text-center animate-fade-up">
        <div
          className="mb-8 animate-pulse-heart select-none"
          style={{
            fontSize: "clamp(4rem, 12vw, 8rem)",
            filter:
              "drop-shadow(0 0 32px rgba(255,80,140,0.85)) drop-shadow(0 0 75px rgba(255,80,140,0.45))",
          }}
        >
          ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â
        </div>

        <h1
          className="font-bold text-white mb-4 leading-tight"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(1.6rem, 4.5vw, 3rem)",
            textShadow: "0 0 40px rgba(255,180,200,0.55)",
          }}
        >
          {girlfriendName
            ? `My dearest ${girlfriendName}, I've created something special just for you...`
            : "My love, I've created something special just for you..."}
        </h1>

        <p
          className="text-pink-200 mb-10 opacity-75"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "clamp(0.9rem, 2vw, 1.15rem)",
          }}
        >
          I put all my love into this surprise for you.
        </p>

        <Btn onClick={onNext}>Unlock ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â</Btn>

        <p
          className="mt-14 text-xs"
          style={{
            color: "rgba(255,180,200,0.28)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Made with all my love.
        </p>
      </div>

      {!girlfriendName && (
        <button
          onClick={onDash}
          className="absolute bottom-6 right-5 text-xs cursor-pointer transition-all duration-200 hover:opacity-60"
          style={{
            color: "rgba(255,180,200,0.22)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Create ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â€
        </button>
      )}
    </div>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SCREEN 2 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â LOADING ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function S2({ onNext }: { onNext: () => void }) {
  const [pct, setPct] = useState(0)
  const [checks, setChecks] = useState<Set<number>>(new Set())
  const doneRef = useRef(false)
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext

  const steps = [
    "Opening my heart for you",
    "Gathering our sweetest memories",
    "Preparing my love letter",
    "Unlocking your surprise...",
  ]

  useEffect(() => {
    const t = setInterval(() => {
      setPct((p) => {
        if (p >= 100) {
          clearInterval(t)
          if (!doneRef.current) {
            doneRef.current = true
            setTimeout(() => onNextRef.current(), 400)
          }
          return 100
        }

        const nextP = p + 2.5
        if (nextP >= 20) setChecks((c) => new Set(c).add(0))
        if (nextP >= 48) setChecks((c) => new Set(c).add(1))
        if (nextP >= 74) setChecks((c) => new Set(c).add(2))
        if (nextP >= 96) setChecks((c) => new Set(c).add(3))
        return nextP
      })
    }, 60)

    return () => clearInterval(t)
  }, [])

  const r = 58
  const circ = 2 * Math.PI * r
  const off = circ - (Math.min(pct, 100) / 100) * circ

  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden px-6"
      style={{ ...DARK_BG, minHeight: "100dvh" }}
    >
      <FloatingHearts n={15} />
      <Sparkles n={20} />

      <div className="cinematic-container relative z-10 flex flex-col items-center animate-fade-up">
        {/* Progress Ring */}
        <div className="relative w-36 h-36 mb-10 flex items-center justify-center">
          <svg
            width="132"
            height="132"
            viewBox="0 0 132 132"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx="66"
              cy="66"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="7"
            />
            <circle
              cx="66"
              cy="66"
              r={r}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={off}
              stroke="url(#pg)"
              style={{ transition: "stroke-dashoffset 0.05s linear" }}
            />
            <defs>
              <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffc8d6" />
                <stop offset="100%" stopColor="#e8789a" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {Math.round(Math.min(pct, 100))}%
            </span>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-4 w-full">
          {steps.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 transition-all duration-600"
              style={{ opacity: checks.has(i) ? 1 : 0.22 }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 transition-all duration-500"
                style={{
                  background: checks.has(i)
                    ? "linear-gradient(135deg, #e8789a, #c9438a)"
                    : "rgba(255,255,255,0.08)",
                  boxShadow: checks.has(i)
                    ? "0 0 16px rgba(232,120,154,0.65)"
                    : "none",
                }}
              >
                {checks.has(i) ? "ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“" : ""}
              </div>
              <span
                className="text-pink-100 text-sm"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SCREEN 3 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â VERIFY ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function S3({ onNext }: { onNext: () => void }) {
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden px-6"
      style={{ ...DARK_BG, minHeight: "100dvh" }}
    >
      <FloatingHearts n={15} />
      <Sparkles n={20} />
      <GlowOrbs />

      <div className="cinematic-container relative z-10 animate-fade-up">
        <Glass className="p-8 text-center">
          <div className="text-6xl mb-5">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢</div>
          <h2
            className="font-bold text-white mb-4 leading-snug"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.3rem, 3.5vw, 2rem)",
            }}
          >
            Only you can unlock my heart.
          </h2>
          <p
            className="text-sm mb-8"
            style={{
              color: "rgba(255,200,220,0.65)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            I created this surprise just for you, with all my love. Are you
            ready?
          </p>

          <div
            className="mx-auto mb-8 h-px w-16 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(232,120,154,0.5), transparent)",
            }}
          />

          <Btn onClick={onNext} full>
            Continue ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â
          </Btn>
        </Glass>
      </div>
    </div>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ROMANTIC CALENDAR PICKER ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function RomanticCalendarPicker({
  value,
  onChange,
  placeholder = "Select date of first meet...",
  isDark = true,
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  isDark?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)

  const parseVal = (str: string) => {
    if (!str) return new Date()
    const parsed = new Date(str)
    return isNaN(parsed.getTime()) ? new Date() : parsed
  }

  const [currMonth, setCurrMonth] = useState(() => parseVal(value).getMonth())
  const [currYear, setCurrYear] = useState(() => parseVal(value).getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(() => {
    if (!value) return null
    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? null : parsed.getDate()
  })

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate()
  const firstDayIndex = new Date(currYear, currMonth, 1).getDay()

  const handlePrevMonth = () => {
    if (currMonth === 0) {
      setCurrMonth(11)
      setCurrYear((y) => y - 1)
    } else {
      setCurrMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (currMonth === 11) {
      setCurrMonth(0)
      setCurrYear((y) => y + 1)
    } else {
      setCurrMonth((m) => m + 1)
    }
  }

  const selectDate = (day: number) => {
    setSelectedDay(day)
    const formatted = `${months[currMonth]} ${day}, ${currYear}`
    onChange(formatted)
    setIsOpen(false)
  }

  const currentActualYear = new Date().getFullYear()
  const years = Array.from({ length: 35 }, (_, i) => currentActualYear - 30 + i)

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-2xl text-left text-sm outline-none transition-all duration-200 flex items-center justify-between cursor-pointer select-none"
        style={{
          background: isDark ? "rgba(255,255,255,0.06)" : "#fff0f5",
          border: isOpen
            ? "1.5px solid #c9438a"
            : isDark
              ? "1px solid rgba(255,255,255,0.1)"
              : "1.5px solid rgba(200,67,138,0.3)",
          boxShadow: isOpen ? "0 0 0 2.5px rgba(232,120,154,0.2)" : "none",
          color: value
            ? isDark
              ? "#ffffff"
              : "#0f0022"
            : isDark
              ? "rgba(255,200,220,0.55)"
              : "#8c1f5c",
          fontWeight: "500",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <span className="truncate">{value ? `ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦ ${value}` : placeholder}</span>
        <span
          className={
            isDark
              ? "text-pink-300 text-xs ml-2 opacity-80"
              : "text-pink-600 text-xs ml-2"
          }
        >
          ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-2 z-50 p-4 rounded-3xl animate-fade-up"
          style={{
            background: "rgba(22, 5, 38, 0.96)",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            border: "1px solid rgba(255, 180, 210, 0.25)",
            boxShadow:
              "0 12px 40px rgba(0,0,0,0.65), 0 0 30px rgba(232,120,154,0.25)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-full flex items-center justify-center text-pink-200 hover:bg-pink-500/20 cursor-pointer transition-colors"
            >
              ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={currMonth}
                onChange={(e) => setCurrMonth(Number(e.target.value))}
                className="bg-transparent text-pink-100 font-semibold text-xs cursor-pointer outline-none rounded px-1 py-0.5"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {months.map((m, idx) => (
                  <option
                    key={m}
                    value={idx}
                    className="bg-purple-950 text-white"
                  >
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={currYear}
                onChange={(e) => setCurrYear(Number(e.target.value))}
                className="bg-transparent text-pink-100 font-semibold text-xs cursor-pointer outline-none rounded px-1 py-0.5"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {years.map((y) => (
                  <option
                    key={y}
                    value={y}
                    className="bg-purple-950 text-white"
                  >
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-full flex items-center justify-center text-pink-200 hover:bg-pink-500/20 cursor-pointer transition-colors"
            >
              ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âº
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {weekDays.map((day) => (
              <span
                key={day}
                className="text-[10px] font-semibold uppercase tracking-wider text-pink-300/60"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const isSelected = selectedDay === day
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs transition-all cursor-pointer ${
                    isSelected
                      ? "text-white font-bold animate-pulse-glow"
                      : "text-pink-100 hover:bg-pink-500/20"
                  }`}
                  style={
                    isSelected
                      ? {
                          background:
                            "linear-gradient(135deg, #e8789a 0%, #c9438a 100%)",
                          boxShadow: "0 0 12px rgba(232,120,154,0.6)",
                        }
                      : {}
                  }
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="mt-3 pt-2 border-t border-white/10 flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={() => {
                const today = new Date()
                setCurrMonth(today.getMonth())
                setCurrYear(today.getFullYear())
                selectDate(today.getDate())
              }}
              className="text-pink-300 hover:underline cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-pink-200/60 hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SCREEN 4 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â QUESTIONS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function S4({
  onNext,
  slug,
  questions = [],
}: {
  onNext: () => void
  slug?: string
  questions?: PublicQuestion[]
}) {
  const defaultQuestions = [
    { question: "When did we first meet?" },
    { question: "What nickname do I call you?" },
    { question: "What is our favorite memory together?" },
  ]

  const displayQuestions =
    questions && questions.length > 0 ? questions : defaultQuestions

  const [ans, setAns] = useState<string[]>(
    Array(displayQuestions.length).fill(""),
  )
  const [err, setErr] = useState(false)
  const [errMessage, setErrMessage] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const shake = () => {
    const el = cardRef.current
    if (!el) return
    el.style.animation = "none"
    requestAnimationFrame(() => {
      el.style.animation = "shake 0.55s ease-in-out"
    })
    setTimeout(() => {
      if (el) el.style.animation = ""
    }, 600)
  }

  const submit = async () => {
    const filled = ans.every((a) => a.trim().length > 0)
    if (!filled) {
      shake()
      setErr(true)
      setErrMessage("Please answer all secret questions ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â")
      return
    }

    if (slug) {
      setIsVerifying(true)
      setErr(false)
      try {
        const res = await verifyQuestions(slug, ans)
        if (res.success) {
          onNext()
        } else {
          shake()
          setErr(true)
          setErrMessage(res.message || "Incorrect answer(s). Try once more ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â")
        }
      } catch {
        shake()
        setErr(true)
        setErrMessage("Verification error. Please try again.")
      } finally {
        setIsVerifying(false)
      }
    } else {
      // Local fallback preview flow
      onNext()
    }
  }

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden px-6 py-12"
      style={{ ...DARK_BG, minHeight: "100dvh" }}
    >
      <FloatingHearts n={12} />
      <Sparkles n={16} />
      <GlowOrbs />

      <div
        ref={cardRef}
        className="cinematic-container relative z-10 animate-fade-up"
      >
        <Glass className="p-8">
          <h2
            className="font-bold text-white mb-1 text-center"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.3rem, 3.5vw, 2rem)",
            }}
          >
            Answer Our Special Questions ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â
          </h2>
          <p
            className="text-xs text-center mb-8"
            style={{
              color: "rgba(255,200,220,0.5)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Answer these secret questions to unlock my heart
          </p>

          <div className="space-y-5">
            {displayQuestions.map((q, i) => (
              <div key={i}>
                <label
                  className="block text-xs mb-2 font-semibold tracking-widest uppercase"
                  style={{
                    color: "rgba(255,180,210,0.6)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {q.question}
                </label>
                {q.question.toLowerCase().includes("meet") ||
                q.question.toLowerCase().includes("date") ||
                q.question.toLowerCase().includes("when") ? (
                  <RomanticCalendarPicker
                    value={ans[i] || ""}
                    placeholder="Select date, month & year..."
                    onChange={(val) => {
                      const n = [...ans]
                      n[i] = val
                      setAns(n)
                      if (err) setErr(false)
                    }}
                  />
                ) : (
                  <input
                    value={ans[i] || ""}
                    onChange={(e) => {
                      const n = [...ans]
                      n[i] = e.target.value
                      setAns(n)
                      if (err) setErr(false)
                    }}
                    placeholder="Type your secret answer..."
                    className="w-full px-4 py-3 rounded-2xl text-white text-sm outline-none transition-all duration-200"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(232,120,154,0.55)"
                      e.currentTarget.style.boxShadow =
                        "0 0 0 2.5px rgba(232,120,154,0.18)"
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.1)"
                      e.currentTarget.style.boxShadow = "none"
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {err && (
            <p
              className="mt-5 text-center text-sm animate-fade-up"
              style={{ color: "#ffa0c0", fontFamily: "'DM Sans', sans-serif" }}
            >
              {errMessage || "Almost... Try once more ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â"}
            </p>
          )}

          <div className="mt-8">
            <Btn onClick={submit} full disabled={isVerifying}>
              {isVerifying ? "Verifying Answers... ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â" : "Unlock Gift ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â"}
            </Btn>
          </div>
        </Glass>
      </div>
    </div>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SCREEN 5 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â GIFT BOX ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function S5({ onNext }: { onNext: () => void }) {
  const orbitAngles = [0, 60, 120, 180, 240, 300]

  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden px-6"
      style={{ ...DARK_BG, minHeight: "100dvh" }}
    >
      <FloatingHearts n={18} />
      <Sparkles n={30} />
      <GlowOrbs />

      <div className="cinematic-container relative z-10 flex flex-col items-center text-center animate-fade-up">
        {/* Gift Box */}
        <div className="relative mb-10 animate-gift-float">
          {/* Orbit sparkles */}
          {orbitAngles.map((deg, i) => (
            <div
              key={i}
              className="absolute text-yellow-100 animate-sparkle text-lg pointer-events-none"
              style={{
                left: `calc(50% + ${Math.cos((deg * Math.PI) / 180) * 98}px)`,
                top: `calc(50% + ${Math.sin((deg * Math.PI) / 180) * 88}px)`,
                transform: "translate(-50%,-50%)",
                animationDelay: `${i * 0.32}s`,
                animationDuration: `${1.6 + (i % 3) * 0.4}s`,
              }}
            >
              ÃƒÂ¢Ã…â€œÃ‚Â¨
            </div>
          ))}

          <svg width="176" height="176" viewBox="0 0 176 176">
            <defs>
              <linearGradient id="gbox" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#c9438a" />
                <stop offset="100%" stopColor="#7a0f50" />
              </linearGradient>
              <linearGradient id="glid" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f09ab8" />
                <stop offset="100%" stopColor="#c9438a" />
              </linearGradient>
              <linearGradient id="grib" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#d4a870" />
                <stop offset="45%" stopColor="#f5d9a8" />
                <stop offset="100%" stopColor="#d4a870" />
              </linearGradient>
              <filter id="gf" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect
              x="22"
              y="84"
              width="132"
              height="82"
              rx="9"
              fill="url(#gbox)"
              filter="url(#gf)"
            />
            <rect
              x="12"
              y="66"
              width="152"
              height="26"
              rx="8"
              fill="url(#glid)"
              filter="url(#gf)"
            />
            <rect x="76" y="84" width="24" height="82" fill="url(#grib)" />
            <rect x="76" y="66" width="24" height="26" fill="url(#grib)" />
            <path
              d="M88 66 C70 40 40 42 50 60 C58 72 88 66 88 66 Z"
              fill="url(#grib)"
            />
            <path
              d="M88 66 C106 40 136 42 126 60 C118 72 88 66 88 66 Z"
              fill="url(#grib)"
            />
            <circle cx="88" cy="66" r="10" fill="#f5d9a8" />
          </svg>
        </div>

        <h2
          className="font-bold text-white mb-4 leading-tight"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
            textShadow: "0 0 40px rgba(255,180,200,0.6)",
          }}
        >
          My gift for you is ready to open...
        </h2>

        <p
          className="text-base mb-10"
          style={{
            color: "rgba(255,200,220,0.7)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Open it to see what I made for you ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â
        </p>

        <Btn onClick={onNext}>Open Gift ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â</Btn>
      </div>
    </div>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SCREEN 6 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â SUSPENSE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function S6({ onNext, bgPhoto }: { onNext: () => void; bgPhoto?: string }) {
  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{ ...DARK_BG, minHeight: "100dvh" }}
    >
      <div
        className="absolute inset-0 animate-bg-zoom"
        style={{
          backgroundImage: `url(${bgPhoto || DEFAULT_PHOTOS[0]})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(22px) brightness(0.22)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/65" />

      <FloatingHearts n={12} />
      <Sparkles n={18} />

      <div className="cinematic-container relative z-10 flex flex-col items-center text-center animate-fade-up">
        <div className="text-7xl mb-6 animate-pulse-heart">ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â¹</div>
        <h2
          className="font-bold text-white mb-4 leading-snug"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
            textShadow: "0 0 44px rgba(255,180,200,0.7)",
          }}
        >
          Just one last step, my love...
        </h2>
        <p
          className="text-base mb-10"
          style={{
            color: "rgba(255,200,220,0.72)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          My complete surprise for you is about to unfold
        </p>

        <Btn onClick={onNext}>Reveal Everything ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â</Btn>
      </div>
    </div>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SCREEN 7 SUB-COMPONENTS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function Confetti() {
  const pieces = useRef(
    Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: Math.random() * 10 + 4,
      h: Math.random() * 5 + 2,
      delay: Math.random() * 5,
      dur: Math.random() * 3.5 + 3,
      rot: Math.random() * 360,
    })),
  ).current

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.left}%`,
            top: "-24px",
            width: `${p.w}px`,
            height: `${p.h}px`,
            background: p.color,
            borderRadius: "2px",
            opacity: 0.88,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  )
}

function extractSpotifyTrackId(input: string): string {
  if (!input) return "4cOdK2wGLETKBW3PvgPWqT"
  const match = input.match(/(?:track\/|track:)([a-zA-Z0-9]{22})/)
  if (match && match[1]) return match[1]
  if (input.trim().length === 22 && !input.includes("/")) return input.trim()
  return "4cOdK2wGLETKBW3PvgPWqT"
}

function isAudioUrl(url?: string): boolean {
  if (!url) return false
  if (url.startsWith("blob:") || url.startsWith("data:audio")) return true
  if (url.match(/\.(mp3|m4a|wav|aac|ogg)(\?.*)?$/i)) return true
  if (url.includes("voice-notes") || url.includes("/music/")) return true
  if (
    (url.startsWith("http://") || url.startsWith("https://")) &&
    !url.includes("spotify.com")
  )
    return true
  return false
}

function SpotifyPlayer({
  trackId = "4cOdK2wGLETKBW3PvgPWqT",
  autoPlay = true,
}: {
  trackId?: string
  autoPlay?: boolean
}) {
  const isDirectAudio = isAudioUrl(trackId)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!isDirectAudio || !trackId) return
    const audio = new Audio(trackId)
    audio.loop = true
    audioRef.current = audio

    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || 0)
    const onEnded = () => {
      setIsPlaying(false)
    }

    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("loadedmetadata", onMeta)
    audio.addEventListener("ended", onEnded)

    const handlePauseUploaded = () => {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause()
        setIsPlaying(false)
      }
    }

    const handlePlayUploaded = () => {
      if (audioRef.current) {
        window.dispatchEvent(new Event("pause-bgm"))
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true)
            setIsMuted(false)
          })
          .catch(() => {})
      }
    }

    window.addEventListener("pause-uploaded-song", handlePauseUploaded)
    window.addEventListener("play-uploaded-song", handlePlayUploaded)

    // Auto-play uploaded song & stop background BGM automatically
    if (autoPlay) {
      window.dispatchEvent(new Event("pause-bgm"))
      audio
        .play()
        .then(() => {
          setIsPlaying(true)
          setIsMuted(false)
        })
        .catch(() => {
          audio.muted = true
          audio
            .play()
            .then(() => {
              setIsPlaying(true)
              setIsMuted(true)
            })
            .catch(() => setIsPlaying(false))
        })

      const handleUserGesture = () => {
        if (audioRef.current && audioRef.current.paused) {
          window.dispatchEvent(new Event("pause-bgm"))
          audioRef.current.muted = false
          audioRef.current
            .play()
            .then(() => {
              setIsPlaying(true)
              setIsMuted(false)
            })
            .catch(() => {})
        }
      }

      const gestures = ["pointerdown", "touchstart", "click"]
      gestures.forEach((evt) =>
        window.addEventListener(evt, handleUserGesture, {
          passive: true,
          once: true,
        }),
      )
    }

    return () => {
      audio.pause()
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("loadedmetadata", onMeta)
      audio.removeEventListener("ended", onEnded)
      window.removeEventListener("pause-uploaded-song", handlePauseUploaded)
      window.removeEventListener("play-uploaded-song", handlePlayUploaded)
    }
  }, [trackId, isDirectAudio, autoPlay])

  const togglePlay = () => {
    playButtonSound()
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      window.dispatchEvent(new Event("pause-bgm"))
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error("Audio playback error:", err))
    }
  }

  const toggleMute = () => {
    playButtonSound()
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = val
      setCurrentTime(val)
    }
  }

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00"
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? "0" : ""}${s}`
  }

  if (!isDirectAudio) {
    const activeId = extractSpotifyTrackId(trackId)
    return (
      <div className="rounded-2xl overflow-hidden transition-all duration-300">
        <iframe
          src={`https://open.spotify.com/embed/track/${activeId}?utm_source=generator&theme=0`}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="w-full rounded-2xl"
          style={{
            borderRadius: "14px",
            border: "none",
            minHeight: "152px",
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="mb-6 p-4 rounded-2xl shadow-2xl relative overflow-hidden transition-all duration-300"
      style={{
        background:
          "linear-gradient(135deg, rgba(30,10,40,0.95), rgba(75,15,60,0.95))",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,182,193,0.35)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-center gap-3.5">
        {/* Spinning Vinyl Record Disc */}
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform shrink-0 ${
            isPlaying ? "animate-spin" : ""
          }`}
          style={{
            background:
              "radial-gradient(circle, #ff69b4 0%, #8b008b 60%, #1a0020 100%)",
            border: "2px solid rgba(255,255,255,0.4)",
            animationDuration: "4s",
          }}
        >
          <div className="w-5 h-5 rounded-full bg-white/20 border border-white/40 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
        </div>

        {/* Title and Controls */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className="text-xs font-bold uppercase tracking-wider text-pink-300 truncate"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Âµ Your Special Song (Full Track)
            </span>
            <button
              onClick={toggleMute}
              className="text-xs text-white/70 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Â¡" : "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ…Â "}
            </button>
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-md shrink-0 cursor-pointer text-base"
              style={{
                background: "linear-gradient(135deg, #ff4081, #c2185b)",
                color: "#ffffff",
                boxShadow: "0 0 15px rgba(255,64,129,0.5)",
              }}
            >
              {isPlaying ? "ÃƒÂ¢Ã‚ÂÃ‚Â¸" : "ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¶"}
            </button>

            <div className="flex-1 min-w-0">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full accent-pink-500 cursor-pointer h-1.5 rounded-lg bg-white/20"
              />
              <div className="flex justify-between text-[10px] text-white/70 mt-1 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SparkleBurst() {
  const particles = useRef(
    Array.from({ length: 7 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 130,
      y: (Math.random() - 0.5) * 110 - 30,
      icon: ["ÃƒÂ¢Ã…â€œÃ‚Â¨", "ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â", "ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â‚¬â€œ", "ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â¸", "ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â‚¬Â¢"][i % 5],
      scale: Math.random() * 0.5 + 0.75,
      delay: i * 0.07,
    })),
  ).current

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, p.scale, 0.4],
            x: p.x,
            y: p.y,
          }}
          transition={{ duration: 1.4, delay: p.delay, ease: "easeOut" }}
          className="absolute text-sm select-none"
        >
          {p.icon}
        </motion.span>
      ))}
    </div>
  )
}

function MemoryBreak({ quoteIndex }: { quoteIndex: number }) {
  const quote = MEMORY_QUOTES[quoteIndex % MEMORY_QUOTES.length]

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 1.0 }}
      className="my-16 sm:my-20 text-center relative px-2"
    >
      {/* Animated Glowing Divider */}
      <div className="flex items-center justify-center gap-4 mb-5">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: "70px" }}
          viewport={{ once: true }}
          transition={{ duration: 1.2 }}
          className="h-px bg-gradient-to-r from-transparent via-pink-400/60 to-pink-300/80"
        />
        <motion.span
          animate={{ scale: [1, 1.25, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-xl select-none"
        >
          ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â‚¬â€œ
        </motion.span>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: "70px" }}
          viewport={{ once: true }}
          transition={{ duration: 1.2 }}
          className="h-px bg-gradient-to-l from-transparent via-pink-400/60 to-pink-300/80"
        />
      </div>

      <p
        className="text-sm sm:text-base lg:text-lg italic font-serif leading-relaxed text-pink-100/90 max-w-xs sm:max-w-md lg:max-w-2xl mx-auto drop-shadow-md"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {quote}
      </p>
    </motion.div>
  )
}

function CinematicMemoryCard({
  photo,
  index,
}: {
  photo: string
  index: number
}) {
  const caption = ROMANTIC_CAPTIONS[index % ROMANTIC_CAPTIONS.length]
  const [hasEntered, setHasEntered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.94, filter: "blur(12px)" }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      onViewportEnter={() => setHasEntered(true)}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {hasEntered && <SparkleBurst />}

      <div className="memory-card-inner group mx-auto">
        {/* Photo Card Container */}
        <motion.div
          whileHover={{ scale: 1.03, y: -4 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl p-2.5 shadow-2xl cursor-pointer transition-all duration-500"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,192,203,0.06))",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,200,220,0.25)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          }}
        >
          <div className="relative overflow-hidden rounded-2xl h-64 sm:h-72 lg:h-80 w-full">
            <motion.img
              src={photo}
              alt={`Memory ${index + 1}`}
              loading="lazy"
              className="w-full h-full object-cover rounded-2xl"
              initial={{ scale: 1.1 }}
              animate={{ scale: [1.1, 1.03] }}
              transition={{
                duration: 8,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            />
            {/* Overlay */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-70 group-hover:opacity-40 transition-opacity duration-400" />
            {/* Hover glow ring */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                boxShadow: "inset 0 0 30px rgba(232,120,154,0.2)",
              }}
            />
          </div>

          {/* Number Badge */}
          <div
            className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase text-pink-200 backdrop-blur-md border border-white/15"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            #{index + 1}
          </div>
        </motion.div>

        {/* Caption */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-3 px-4 py-3 rounded-2xl text-center"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,200,220,0.15)",
            backdropFilter: "blur(10px)",
          }}
        >
          <p
            className="text-xs sm:text-sm font-medium text-pink-100 leading-snug"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {caption}
          </p>
        </motion.div>
      </div>
    </motion.div>
  )
}

function FinalGrandMemory({ photo }: { photo: string }) {
  const [hasFiredConfetti, setHasFiredConfetti] = useState(false)

  const handleEnter = () => {
    if (!hasFiredConfetti) {
      setHasFiredConfetti(true)
      if (typeof window !== "undefined" && (window as any).confetti) {
        ;(window as any).confetti({
          particleCount: 60,
          spread: 80,
          origin: { y: 0.8 },
          colors: ["#ffc8d6", "#f4a0b5", "#c4b5fd", "#ffffff"],
        })
      }
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 60, filter: "blur(16px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      onViewportEnter={handleEnter}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      className="finale-section"
      style={{ borderTop: "1px solid rgba(255,200,220,0.07)" }}
    >
      <div className="finale-section-narrow">
        {/* Section Label */}
        <div className="text-center mb-8 md:mb-10">
          <span
            className="inline-block text-[10px] uppercase tracking-widest text-pink-300 font-bold px-4 py-1.5 rounded-full mb-4"
            style={{
              background: "rgba(232,120,154,0.12)",
              border: "1px solid rgba(232,120,154,0.25)",
            }}
          >
            ÃƒÂ¢Ã…â€œÃ‚Â¨ Our Greatest Chapter
          </span>
          <h2
            className="font-bold text-white leading-tight"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)",
              textShadow: "0 0 40px rgba(255,180,200,0.4)",
            }}
          >
            The Memory That Holds My Whole Heart
          </h2>
          <p
            className="mt-3 text-sm md:text-base"
            style={{
              color: "rgba(255,200,220,0.6)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Every time I look at this, I fall in love all over again
          </p>
        </div>

        {/* Featured Photo Frame */}
        <motion.div
          whileHover={{ scale: 1.015 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="featured-memory-frame mx-auto relative cursor-pointer"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(232,120,154,0.28), rgba(196,181,253,0.18))",
            padding: "3px",
            boxShadow:
              "0 0 60px rgba(255,105,180,0.3), 0 0 120px rgba(255,105,180,0.12), 0 30px 80px rgba(0,0,0,0.7)",
          }}
        >
          {/* Glow overlay */}
          <div
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,215,0,0.08) 0%, transparent 50%, rgba(232,120,154,0.08) 100%)",
              zIndex: 1,
            }}
          />

          {/* Image */}
          <motion.img
            src={photo}
            alt="Featured Memory"
            loading="lazy"
            className="featured-memory-img"
            style={{
              borderRadius: "inherit",
              position: "relative",
              zIndex: 0,
            }}
            initial={{ scale: 1.1 }}
            animate={{ scale: [1.1, 1.02] }}
            transition={{
              duration: 12,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          />

          {/* Bottom gradient overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)",
              zIndex: 2,
              borderRadius: "inherit",
            }}
          />

          {/* Crown badge */}
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase text-pink-100 z-10"
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,215,0,0.4)",
            }}
          >
            Ã°Å¸â€˜â€˜ Featured Memory
          </div>
        </motion.div>

        {/* Elegant Caption */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.35 }}
          className="mt-6 md:mt-8 text-center mx-auto max-w-2xl"
        >
          <p
            className="text-sm md:text-base lg:text-lg italic leading-relaxed"
            style={{
              fontFamily: "'Playfair Display', serif",
              color: "rgba(255,210,225,0.9)",
            }}
          >
            "You are my today, my tomorrow, and my entire forever." Ã¢ÂÂ¤Ã¯Â¸Â
          </p>
          <p
            className="mt-3 text-xs"
            style={{ color: "rgba(255,200,220,0.45)", fontFamily: "'DM Sans', sans-serif" }}
          >
            The day our whole world changed
          </p>
        </motion.div>
      </div>
    </motion.section>
  )
}

function Slideshow({ photos }: { photos?: string[] }) {
  const photoList = photos && photos.length > 0 ? photos : DEFAULT_PHOTOS

  return (
    <section
      className="finale-section"
      style={{ borderTop: "1px solid rgba(255,200,220,0.07)" }}
    >
      <div className="finale-section-wide">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="text-center mb-12 md:mb-16"
        >
          <span
            className="inline-block text-[10px] uppercase tracking-widest text-pink-300 font-bold px-4 py-1.5 rounded-full mb-5"
            style={{
              background: "rgba(232,120,154,0.12)",
              border: "1px solid rgba(232,120,154,0.25)",
            }}
          >
            Our Love Story Ã¢Å“Â¨
          </span>
          <h2
            className="font-bold text-white leading-tight"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.6rem, 3.5vw, 2.6rem)",
              textShadow: "0 0 40px rgba(255,180,200,0.4)",
            }}
          >
            Every Moment With You Is Unforgettable Ã¢ÂÂ¤Ã¯Â¸Â
          </h2>
          <p
            className="mt-4 text-sm md:text-base max-w-xl mx-auto"
            style={{
              color: "rgba(255,200,220,0.6)",
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.7,
            }}
          >
            These are the memories I treasure most Ã¢â‚¬â€ each one a chapter in our love story
          </p>
        </motion.div>

        {/* Memory Grid */}
        <div className="memory-grid">
          {photoList.map((photo, i) => {
            const isLast = i === photoList.length - 1
            const isMemoryBreak = i > 0 && i % 4 === 0 && !isLast

            return (
              <React.Fragment key={i}>
                {isMemoryBreak && (
                  <div className="memory-break-full">
                    <MemoryBreak quoteIndex={Math.floor(i / 4) - 1} />
                  </div>
                )}

                {isLast ? (
                  <div className="memory-final-full">
                    <FinalGrandMemory photo={photo} />
                  </div>
                ) : (
                  <CinematicMemoryCard photo={photo} index={i} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function LoveLetter({ letter }: { letter?: string }) {
  const content = letter || DEFAULT_LETTER
  const [text, setText] = useState("")
  const [on, setOn] = useState(false)
  const pos = useRef(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!on || pos.current >= content.length) return
    const t = setTimeout(() => {
      pos.current++
      setText(content.slice(0, pos.current))
    }, 18)
    return () => clearTimeout(t)
  }, [on, text, content])

  return (
    <section
      className="finale-section"
      style={{ borderTop: "1px solid rgba(255,200,220,0.07)" }}
    >
      <div className="finale-section-narrow">
        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.85 }}
          className="text-center mb-10 md:mb-12"
        >
          <span
            className="inline-block text-[10px] uppercase tracking-widest text-pink-300 font-bold px-4 py-1.5 rounded-full mb-5"
            style={{
              background: "rgba(232,120,154,0.12)",
              border: "1px solid rgba(232,120,154,0.25)",
            }}
          >
            Ã°Å¸â€™Å’ From My Heart To Yours
          </span>
          <h2
            className="font-bold text-white leading-tight"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.5rem, 3.5vw, 2.4rem)",
              textShadow: "0 0 40px rgba(255,180,200,0.4)",
            }}
          >
            Words I Could Never Say Out Loud
          </h2>
          <p
            className="mt-3 text-sm md:text-base"
            style={{
              color: "rgba(255,200,220,0.6)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            A letter written only for you, with everything I feel
          </p>
        </motion.div>

        {/* Letter Card */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.1 }}
          className="love-letter-card"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            border: "1px solid rgba(255,200,220,0.18)",
            borderRadius: "24px",
            boxShadow:
              "0 12px 60px rgba(0,0,0,0.4), 0 0 80px rgba(232,120,154,0.06), inset 0 1px 0 rgba(255,255,255,0.08)",
            padding: "clamp(1.5rem, 4vw, 2.5rem)",
          }}
        >
          {/* Letter Header */}
          <div className="flex items-center gap-3 mb-6 pb-5" style={{ borderBottom: "1px solid rgba(255,200,220,0.12)" }}>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(232,120,154,0.2), rgba(196,67,138,0.2))",
                border: "1px solid rgba(232,120,154,0.3)",
              }}
            >
              Ã°Å¸â€™Å’
            </div>
            <div>
              <p
                className="text-sm font-semibold text-white"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                My Letter From The Heart
              </p>
              <p className="text-xs" style={{ color: "rgba(255,200,220,0.5)" }}>
                Written with all my love, only for you
              </p>
            </div>
          </div>

          {/* Letter Content */}
          <div
            className="whitespace-pre-wrap"
            style={{
              color: "rgba(255,210,225,0.92)",
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontSize: "clamp(0.9rem, 1.8vw, 1.05rem)",
              lineHeight: 1.9,
              minHeight: "80px",
            }}
          >
            {text}
            {pos.current < content.length && (
              <span className="inline-block w-0.5 h-4 ml-0.5 rounded-full animate-blink-cursor align-text-bottom bg-pink-400" />
            )}
          </div>

          {/* Letter Footer */}
          {pos.current >= content.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
              className="mt-6 pt-5 flex items-center justify-center gap-2"
              style={{ borderTop: "1px solid rgba(255,200,220,0.1)" }}
            >
              <span className="text-xs" style={{ color: "rgba(255,200,220,0.45)", fontFamily: "'DM Sans', sans-serif" }}>
                Forever yours
              </span>
              <span className="text-sm animate-pulse-heart">Ã¢ÂÂ¤Ã¯Â¸Â</span>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  )
}

function VoiceNote({ voiceNoteUrl }: { voiceNoteUrl?: string }) {
  const [play, setPlay] = useState(false)
  const [prog, setProg] = useState(0)
  const audioObjRef = useRef<HTMLAudioElement | null>(null)
  const bars = useRef(
    Array.from({ length: 48 }, () => Math.random() * 36 + 8),
  ).current

  useEffect(() => {
    if (voiceNoteUrl) {
      audioObjRef.current = new Audio(voiceNoteUrl)
      const audio = audioObjRef.current

      const updateProgress = () => {
        if (audio.duration) {
          setProg((audio.currentTime / audio.duration) * 100)
        }
      }
      const handleEnded = () => {
        setPlay(false)
        setProg(0)
        window.dispatchEvent(new Event("play-uploaded-song"))
      }

      audio.addEventListener("timeupdate", updateProgress)
      audio.addEventListener("ended", handleEnded)

      return () => {
        audio.pause()
        audio.removeEventListener("timeupdate", updateProgress)
        audio.removeEventListener("ended", handleEnded)
      }
    }
  }, [voiceNoteUrl])

  useEffect(() => {
    const audio = audioObjRef.current
    if (play) {
      window.dispatchEvent(new Event("pause-bgm"))
      window.dispatchEvent(new Event("pause-uploaded-song"))
      if (audio) {
        audio.play().catch(() => setPlay(false))
      } else {
        const t = setInterval(() => {
          setProg((p) => {
            if (p >= 100) {
              setPlay(false)
              window.dispatchEvent(new Event("play-uploaded-song"))
              return 0
            }
            return p + 0.38
          })
        }, 80)
        return () => clearInterval(t)
      }
    } else {
      if (audio) audio.pause()
    }
  }, [play])


  return (
    <section
      className="finale-section"
      style={{ borderTop: "1px solid rgba(255,200,220,0.07)" }}
    >
      <div className="finale-section-narrow">
        {/* Section Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.85 }}
          className="text-center mb-10 md:mb-12"
        >
          <span
            className="inline-block text-[10px] uppercase tracking-widest text-pink-300 font-bold px-4 py-1.5 rounded-full mb-5"
            style={{
              background: "rgba(232,120,154,0.12)",
              border: "1px solid rgba(232,120,154,0.25)",
            }}
          >
            Voice Message
          </span>
          <h2
            className="font-bold text-white leading-tight"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.5rem, 3.5vw, 2.4rem)",
              textShadow: "0 0 40px rgba(255,180,200,0.4)",
            }}
          >
            A Message Straight From My Heart
          </h2>
          <p
            className="mt-3 text-sm md:text-base"
            style={{
              color: "rgba(255,200,220,0.6)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Press play to hear what I could never find words to write
          </p>
        </motion.div>

        {/* Premium Voice Player */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.1 }}
          className="voice-player-card"
          style={{
            background: "linear-gradient(135deg, rgba(28,8,42,0.96), rgba(72,12,60,0.96))",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,182,193,0.22)",
            borderRadius: "24px",
            boxShadow: play
              ? "0 0 50px rgba(255,105,180,0.25), 0 20px 60px rgba(0,0,0,0.5)"
              : "0 20px 60px rgba(0,0,0,0.5)",
            padding: "clamp(1.5rem, 4vw, 2.5rem)",
            transition: "box-shadow 0.4s ease",
          }}
        >
          {/* Player Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{
                  background: "linear-gradient(135deg, rgba(232,120,154,0.25), rgba(196,67,138,0.25))",
                  border: "1px solid rgba(232,120,154,0.35)",
                }}
              >
                {String.fromCodePoint(0x1F3A4)}
              </div>
              <div>
                <p className="text-sm font-semibold text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Voice Message For You
                </p>
                <p className="text-xs" style={{ color: "rgba(255,200,220,0.5)" }}>
                  {play ? "Playing now..." : "Tap to listen"}
                </p>
              </div>
            </div>
            {/* Reel accents */}
            <div className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full border-2 border-pink-400/60 flex items-center justify-center ${play ? "animate-spin" : ""}`}
                style={{ animationDuration: "3s" }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-pink-300" />
              </div>
              <div className="h-0.5 w-8 bg-gradient-to-r from-pink-500 to-purple-400 rounded-full" />
              <div
                className={`w-5 h-5 rounded-full border-2 border-pink-400/60 flex items-center justify-center ${play ? "animate-spin" : ""}`}
                style={{ animationDuration: "3s" }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-pink-300" />
              </div>
            </div>
          </div>

          {/* Waveform */}
          <div className="flex items-end gap-0.5 justify-center mb-6" style={{ height: "64px" }}>
            {bars.map((h, i) => (
              <div
                key={i}
                className="rounded-full flex-shrink-0"
                style={{
                  width: "3px",
                  height: play ? `${Math.min(h, 56)}px` : "4px",
                  background: `linear-gradient(to top, rgba(201,67,138,${play ? 0.8 : 0.3}), rgba(255,200,220,${play ? 1 : 0.4}))`,
                  animation: play
                    ? `waveform-bar-lg ${0.28 + (i % 7) * 0.06}s ease-in-out ${i * 0.015}s infinite alternate`
                    : "none",
                  transition: "height 0.3s ease, background 0.3s ease",
                }}
              />
            ))}
          </div>

          {/* Progress Bar */}
          <div
            className="h-1.5 rounded-full overflow-hidden mb-6"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${prog}%`,
                background: "linear-gradient(90deg, #e8789a, #c9438a)",
                transition: "width 0.08s linear",
                boxShadow: "0 0 8px rgba(232,120,154,0.6)",
              }}
            />
          </div>

          {/* Large Play Button */}
          <div className="flex justify-center">
            <button
              onClick={() => setPlay((p) => !p)}
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95 select-none"
              style={{
                background: "linear-gradient(135deg, #e8789a, #c9438a, #9e2070)",
                boxShadow: play
                  ? "0 0 40px rgba(232,120,154,0.8), 0 8px 30px rgba(156,32,112,0.5)"
                  : "0 6px 28px rgba(232,120,154,0.55), 0 3px 12px rgba(0,0,0,0.4)",
                border: "2px solid rgba(255,255,255,0.12)",
                transition: "box-shadow 0.3s ease",
              }}
            >
              {play ? "\u23F8" : "\u25B6"}
            </button>
          </div>

          <p
            className="text-center text-xs mt-5"
            style={{ color: "rgba(255,200,220,0.45)", fontFamily: "'DM Sans', sans-serif" }}
          >
            {play ? "Listening to my heart speak... \u2764\uFE0F" : "My voice note, straight from my heart \u2764\uFE0F"}
          </p>
        </motion.div>
      </div>
    </section>
  )
}


// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SCREEN 7 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â FINALE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function S7({
  onReplay,
  onDash,
  trackId,
  photos,
  letter,
  voiceNoteUrl,
}: {
  onReplay: () => void
  onDash: () => void
  trackId?: string
  photos?: string[]
  letter?: string
  voiceNoteUrl?: string
}) {
  useEffect(() => {
    window.dispatchEvent(new Event("pause-bgm"))
    window.dispatchEvent(new Event("play-uploaded-song"))
  }, [])

  return (
    <div
      className="relative overflow-hidden"
      style={{ ...DARK_BG, minHeight: "100dvh" }}
    >
      <Confetti />
      <FloatingHearts n={25} />
      <Sparkles n={35} />
      <GlowOrbs />

      {/* â”€â”€ HERO SECTION â”€â”€ */}
      <section className="relative z-10 text-center" style={{ paddingTop: "clamp(5rem, 12vw, 8rem)", paddingBottom: "clamp(3rem, 8vw, 5rem)" }}>
        <div className="finale-section-narrow">
          {/* Glow ring */}
          <div
            className="absolute left-1/2 top-1/2 pointer-events-none animate-glow-ring"
            style={{
              width: "clamp(280px, 60vw, 600px)",
              height: "clamp(280px, 60vw, 600px)",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(232,120,154,0.1) 0%, rgba(196,67,138,0.05) 50%, transparent 75%)",
              zIndex: 0,
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10"
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-5xl md:text-6xl mb-6 inline-block"
              style={{ filter: "drop-shadow(0 0 30px rgba(255,80,140,0.7))" }}
            >
              ðŸŒ¹
            </motion.div>

            <h1
              className="font-bold text-white leading-tight mb-5"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(2rem, 5.5vw, 4.5rem)",
                textShadow: "0 0 60px rgba(255,180,200,0.5), 0 0 120px rgba(255,100,160,0.2)",
                letterSpacing: "-0.01em",
              }}
            >
              A Surprise Made Only For You
            </h1>

            <p
              className="text-base md:text-lg max-w-xl mx-auto"
              style={{
                color: "rgba(255,200,220,0.65)",
                fontFamily: "'DM Sans', sans-serif",
                lineHeight: 1.7,
              }}
            >
              Every memory, every word, every note â€” crafted with love, just for you
            </p>

            {/* Scroll indicator */}
            <motion.div
              className="mt-10 flex flex-col items-center gap-2 animate-scroll-bounce"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,200,220,0.4)", fontFamily: "'DM Sans', sans-serif" }}>
                Scroll to experience
              </span>
              <div
                className="w-5 h-8 rounded-full border flex items-start justify-center pt-1.5"
                style={{ borderColor: "rgba(255,200,220,0.2)" }}
              >
                <div className="w-1 h-2 rounded-full" style={{ background: "rgba(232,120,154,0.7)" }} />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ CONTENT SECTIONS â”€â”€ */}
      <div className="relative z-10">
        {/* Our Love Story â€” Memory Gallery */}
        <Slideshow photos={photos} />

        {/* Love Letter */}
        <LoveLetter letter={letter} />

        {/* Voice Message */}
        <VoiceNote voiceNoteUrl={voiceNoteUrl} />

        {/* Our Song */}
        <section
          className="finale-section"
          style={{ borderTop: "1px solid rgba(255,200,220,0.07)" }}
        >
          <div className="finale-section-narrow">
            <motion.div
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.85 }}
              className="text-center mb-10 md:mb-12"
            >
              <span
                className="inline-block text-[10px] uppercase tracking-widest text-pink-300 font-bold px-4 py-1.5 rounded-full mb-5"
                style={{
                  background: "rgba(232,120,154,0.12)",
                  border: "1px solid rgba(232,120,154,0.25)",
                }}
              >
                ðŸŽµ Our Song
              </span>
              <h2
                className="font-bold text-white leading-tight"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "clamp(1.5rem, 3.5vw, 2.4rem)",
                  textShadow: "0 0 40px rgba(255,180,200,0.4)",
                }}
              >
                The Song That Reminds Me of Us
              </h2>
              <p
                className="mt-3 text-sm md:text-base"
                style={{
                  color: "rgba(255,200,220,0.6)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Every lyric, every note â€” I think of you
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.1 }}
              className="music-card"
              style={{
                background: "linear-gradient(135deg, rgba(20,6,32,0.95), rgba(55,10,48,0.95))",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,182,193,0.18)",
                borderRadius: "24px",
                boxShadow: "0 0 60px rgba(232,120,154,0.08), 0 20px 60px rgba(0,0,0,0.5)",
                padding: "clamp(1.25rem, 3vw, 2rem)",
              }}
            >
              <SpotifyPlayer trackId={trackId} />
            </motion.div>
          </div>
        </section>

        {/* â”€â”€ FINAL PROMISE SECTION â”€â”€ */}
        <section
          className="finale-section"
          style={{ borderTop: "1px solid rgba(255,200,220,0.07)" }}
        >
          <div className="finale-section-narrow text-center">
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="text-6xl md:text-7xl mb-8 inline-block animate-finale-heart">
                â¤ï¸
              </div>

              <h2
                className="font-bold text-white leading-tight mb-6 animate-promise-glow"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "clamp(1.8rem, 4.5vw, 3.5rem)",
                }}
              >
                Thank You For Being My Forever
              </h2>

              <p
                className="text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-4"
                style={{
                  color: "rgba(255,210,225,0.8)",
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: "italic",
                  lineHeight: 1.85,
                }}
              >
                You are my greatest adventure, my softest landing, and my whole heart. Everything beautiful in my life leads back to you.
              </p>

              <p
                className="text-sm md:text-base mb-12"
                style={{
                  color: "rgba(255,200,220,0.5)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                I love you more than words can say, forever and always â¤ï¸
              </p>

              <div className="flex items-center justify-center gap-4 mb-12">
                <div className="h-px flex-1 max-w-24" style={{ background: "linear-gradient(to right, transparent, rgba(255,180,200,0.3))" }} />
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-lg"
                >
                  âœ¨
                </motion.span>
                <div className="h-px flex-1 max-w-24" style={{ background: "linear-gradient(to left, transparent, rgba(255,180,200,0.3))" }} />
              </div>

              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, delay: 0.4 }}
                className="text-lg md:text-xl font-semibold mb-10"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: "italic",
                  color: "rgba(255,180,200,0.7)",
                  letterSpacing: "0.01em",
                }}
              >
                Our Story Will Continue...
              </motion.p>

              <Btn onClick={onReplay}>
                ðŸ”„ Replay Surprise
              </Btn>
            </motion.div>
          </div>
        </section>

        {/* â”€â”€ ELEGANT FOOTER â”€â”€ */}
        <footer
          className="text-center relative z-10"
          style={{
            paddingBlock: "2.5rem",
            borderTop: "1px solid rgba(255,200,220,0.06)",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <p
              className="text-sm"
              style={{
                color: "rgba(255,200,220,0.4)",
                fontFamily: "'Playfair Display', serif",
                fontStyle: "italic",
              }}
            >
              Made with â¤ï¸ only for you
            </p>
            <p
              className="text-xs mt-2"
              style={{
                color: "rgba(255,200,220,0.2)",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Your Love Story &copy; Forever
            </p>
          </motion.div>
        </footer>
      </div>
    </div>
  )
}


// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ WITHDRAW MODAL ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function WithdrawModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (details: { type: "upi" | "bank"; value: string }) => void
}) {
  const [method, setMethod] = useState<"upi" | "bank">("upi")
  const [upiId, setUpiId] = useState("")
  const [accountName, setAccountName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [ifscCode, setIfscCode] = useState("")
  const [error, setError] = useState("")

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (method === "upi") {
      if (!upiId.trim()) {
        setError("Please enter your UPI ID")
        return
      }
      onSubmit({ type: "upi", value: upiId.trim() })
    } else {
      if (!accountName.trim() || !accountNumber.trim() || !ifscCode.trim()) {
        setError("Please fill in all bank details")
        return
      }
      onSubmit({
        type: "bank",
        value: `${accountName} (${accountNumber}, ${ifscCode.toUpperCase()})`,
      })
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[320] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative z-10 w-full max-w-sm p-6 rounded-3xl text-white shadow-2xl overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(25, 5, 45, 0.98), rgba(65, 12, 55, 0.98))",
            backdropFilter: "blur(24px)",
            border: "1.5px solid rgba(255, 192, 203, 0.35)",
          }}
        >
          <div className="text-center mb-5">
            <div className="text-3xl mb-1">ÃƒÂ°Ã…Â¸Ã‚ÂÃ‚Â¦</div>
            <h3
              className="text-xl font-bold text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Withdraw Earnings
            </h3>
            <p className="text-xs text-pink-200/70">
              Enter your UPI ID or Bank account details below
            </p>
          </div>

          <div className="flex gap-2 p-1 rounded-2xl bg-black/40 border border-white/10 mb-4">
            <button
              type="button"
              onClick={() => {
                setMethod("upi")
                setError("")
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                method === "upi"
                  ? "bg-pink-600 text-white shadow-md"
                  : "text-pink-200/60 hover:text-white"
              }`}
            >
              UPI ID
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod("bank")
                setError("")
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                method === "bank"
                  ? "bg-pink-600 text-white shadow-md"
                  : "text-pink-200/60 hover:text-white"
              }`}
            >
              Bank Transfer
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {method === "upi" ? (
              <div>
                <label className="block text-[11px] font-semibold uppercase text-pink-200/80 mb-1">
                  UPI ID (Google Pay, PhonePe, Paytm)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. name@upi or 9876543210@paytm"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white outline-none placeholder:text-pink-200/40"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-pink-200/80 mb-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white outline-none placeholder:text-pink-200/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-pink-200/80 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Enter Account Number"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white outline-none placeholder:text-pink-200/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-pink-200/80 mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white outline-none uppercase placeholder:normal-case placeholder:text-pink-200/40"
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-xs text-red-400 text-center font-medium animate-fade-up">
                ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl text-xs font-semibold text-pink-200/70 hover:text-white bg-white/5 border border-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 shadow-lg cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                Submit Request
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ HAMBURGER MENU ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function HamburgerMenu({
  onOpenReferrals,
  onOpenDashboard,
  onPreview,
}: {
  onOpenReferrals: () => void
  onOpenDashboard: () => void
  onPreview: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed top-4 left-4 z-[200]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-11 h-11 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl select-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(26, 0, 53, 0.95), rgba(60, 10, 50, 0.95))",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1.5px solid rgba(255, 180, 210, 0.45)",
          boxShadow:
            "0 8px 25px rgba(0,0,0,0.5), 0 0 15px rgba(232,120,154,0.35)",
        }}
        aria-label="Toggle Menu"
      >
        {isOpen ? (
          /* SVG Close Icon */
          <svg
            className="w-5 h-5 text-pink-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          /* SVG Crisp 3-Lines Icon */
          <svg
            className="w-5 h-5 text-pink-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[-1]"
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-14 left-0 w-56 p-3 rounded-2xl shadow-2xl space-y-1.5 z-10 overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, rgba(25, 5, 45, 0.98), rgba(65, 12, 55, 0.98))",
                backdropFilter: "blur(24px)",
                border: "1.5px solid rgba(255, 192, 203, 0.35)",
                boxShadow: "0 15px 40px rgba(0,0,0,0.7)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  playButtonSound()
                  onOpenReferrals()
                }}
                className="w-full px-3.5 py-3 rounded-xl text-xs font-bold text-left text-pink-100 hover:bg-pink-500/20 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <span className="text-base">ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â</span> My Referrals
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  playButtonSound()
                  onOpenDashboard()
                }}
                className="w-full px-3.5 py-3 rounded-xl text-xs font-bold text-left text-pink-100 hover:bg-pink-500/20 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <span className="text-base">ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â‚¬â€œ</span> Create Surprise
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  playButtonSound()
                  onPreview()
                }}
                className="w-full px-3.5 py-3 rounded-xl text-xs font-bold text-left text-pink-100 hover:bg-pink-500/20 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <span className="text-base">ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ¢â€šÂ¬</span> Preview Flow
              </button>


            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ REFERRALS LOCKED MODAL ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function ReferralsLockedModal({
  isOpen,
  onClose,
  onCreateSurprise,
  onOpenSignIn,
}: {
  isOpen: boolean
  onClose: () => void
  onCreateSurprise: () => void
  onOpenSignIn: () => void
}) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative z-10 w-full max-w-sm p-6 sm:p-7 rounded-center text-center shadow-2xl overflow-hidden text-white"
          style={{
            background:
              "linear-gradient(135deg, rgba(25, 5, 45, 0.98), rgba(65, 12, 55, 0.98))",
            backdropFilter: "blur(24px)",
            border: "1.5px solid rgba(255, 192, 203, 0.35)",
            boxShadow:
              "0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(255,105,180,0.3)",
          }}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-400/40 flex items-center justify-center text-3xl shadow-lg animate-pulse">
            ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢
          </div>

          <h3
            className="text-xl sm:text-2xl font-bold text-white mb-2 leading-snug"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Referrals Dashboard Locked
          </h3>

          <p
            className="text-xs sm:text-sm text-pink-200/80 mb-6 font-sans leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            To unlock your{" "}
            <strong className="text-pink-300">Referral Dashboard</strong> and
            start earning <strong className="text-emerald-400">ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹10</strong> for
            every friend who purchases, first create a gift or sign in!
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                onClose()
                playButtonSound()
                onCreateSurprise()
              }}
              className="w-full py-3.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-lg shadow-pink-500/30 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              Create Gift For Her ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â
            </button>

            <button
              type="button"
              onClick={() => {
                onClose()
                playButtonSound()
                onOpenSignIn()
              }}
              className="w-full py-3 rounded-2xl text-xs font-semibold text-pink-200/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            >
              Already Have An Account? Sign In
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ REFERRAL POPUP MODAL ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function ReferralPopupModal({
  isOpen,
  onClose,
  onApply,
  errorMsg,
}: {
  isOpen: boolean
  onClose: () => void
  onApply: (code: string) => void
  errorMsg: string
}) {
  const [code, setCode] = useState("")

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative z-10 w-full max-w-xs sm:max-w-sm p-6 sm:p-7 rounded-3xl text-center shadow-2xl overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(25, 5, 45, 0.96), rgba(65, 12, 55, 0.96))",
            backdropFilter: "blur(24px)",
            border: "1.5px solid rgba(255, 192, 203, 0.35)",
            boxShadow:
              "0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(255,105,180,0.3)",
          }}
        >
          {/* Top Icon Badge */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-400/40 flex items-center justify-center text-3xl shadow-lg animate-pulse-heart">
            ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â
          </div>

          <h3
            className="text-xl sm:text-2xl font-bold text-white mb-2 leading-snug"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Have a Referral Code?
          </h3>
          <p
            className="text-xs sm:text-sm text-pink-200/80 mb-6 font-sans leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Use a friend's referral code and unlock{" "}
            <span className="text-emerald-400 font-bold">50% OFF</span>{" "}
            instantly!
          </p>

          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase())
                }}
                placeholder="Enter Referral Code (e.g. LOVE50)"
                className="w-full px-4 py-3.5 rounded-2xl text-center font-mono font-bold tracking-widest text-white text-sm outline-none transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-pink-200/40"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: errorMsg
                    ? "1.5px solid #ef4444"
                    : "1px solid rgba(255,192,203,0.3)",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onApply(code)
                }}
              />
              {errorMsg && (
                <p className="text-xs text-red-400 font-semibold mt-2 animate-fade-up">
                  ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â {errorMsg}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl text-xs font-semibold text-pink-200/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => onApply(code)}
                className="flex-1 py-3.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-lg shadow-pink-500/30 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                Apply Code ÃƒÂ¢Ã…â€œÃ‚Â¨
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

const DASHBOARD_DRAFT_KEY = "cinematic_gift_surprise_draft_v1"

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function base64ToFile(dataurl: string, filename: string): File {
  try {
    const arr = dataurl.split(",")
    const mimeMatch = arr[0].match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : "image/png"
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new File([u8arr], filename, { type: mime })
  } catch (err) {
    console.warn("Failed converting base64 to file:", err)
    return new File([], filename)
  }
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ DASHBOARD ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function Dashboard({
  onBack,
  spotifyTrackId,
  setSpotifyTrackId,
  onRequestCreateAccount,
  link,
  setLink,
  userProfile,
}: {
  onBack: () => void
  spotifyTrackId: string
  setSpotifyTrackId: (id: string) => void
  onRequestCreateAccount: (saveSurpriseFn: () => Promise<void>) => void
  link: string
  setLink: (link: string) => void
  userProfile?: UserReferralProfile | null
}) {
  const initialDraft = useMemo(() => {
    try {
      const saved = localStorage.getItem(DASHBOARD_DRAFT_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.warn("Failed to load draft from localStorage:", e)
    }
    return null
  }, [])

  const [gfName, setGfName] = useState(initialDraft?.gfName || "")
  const [bfName, setBfName] = useState(initialDraft?.bfName || "")
  const [photos, setPhotos] = useState<string[]>(initialDraft?.photoBase64s || [])
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [letter, setLetter] = useState(initialDraft?.letter || "")
  const [voiceNote, setVoiceNote] = useState(!!initialDraft?.voiceNoteBase64)
  const [voiceNoteFile, setVoiceNoteFile] = useState<File | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<any>(null)

  const nativeMicInputRef = useRef<HTMLInputElement>(null)

  // Pricing & Referral Architecture State
  const ORIGINAL_PRICE = 99
  const DISCOUNTED_PRICE = 49

  const [isReferralApplied, setIsReferralApplied] = useState(
    initialDraft?.isReferralApplied || false,
  )
  const [appliedReferralCode, setAppliedReferralCode] = useState(
    initialDraft?.appliedReferralCode || "",
  )
  const [referralCodeInput, setReferralCodeInput] = useState("")
  const [referralErrorMsg, setReferralErrorMsg] = useState("")

  const [showReferralPopup, setShowReferralPopup] = useState(() => {
    try {
      const hasSeen = localStorage.getItem("has_seen_referral_popup")
      if (hasSeen === "true") return false
    } catch {}
    return initialDraft ? !initialDraft.isReferralApplied : true
  })
  const [popupErrorMsg, setPopupErrorMsg] = useState("")

  useEffect(() => {
    try {
      localStorage.setItem("has_seen_referral_popup", "true")
    } catch {}
  }, [])

  const finalPrice = isReferralApplied ? DISCOUNTED_PRICE : ORIGINAL_PRICE

  const applyDiscountCode = async (code: string, isFromPopup = false) => {
    playButtonSound()
    console.log("[Referral Input Received] Raw Input:", code)
    const trimmed = code.trim().toUpperCase()
    console.log("[Normalized Referral Code]:", trimmed)

    if (!trimmed) {
      const errText = "Please enter a referral code."
      if (isFromPopup) setPopupErrorMsg(errText)
      else setReferralErrorMsg(errText)
      return false
    }

    const referredUserId = userProfile?.id || ""
    const referredUserEmail = userProfile?.email || ""

    console.log("[Referral Execution Arguments]:", {
      referredUserId,
      referredUserEmail,
      enteredCode: trimmed,
    })

    try {
      // Validate directly against Supabase Database
      const res = await validateAndApplyReferralCode(
        referredUserId,
        referredUserEmail,
        trimmed,
      )
      console.log("[Referral Database Query Result]:", res)

      if (res.success || trimmed === "LOVE50") {
        setIsReferralApplied(true)
        setAppliedReferralCode(trimmed)
        if (isFromPopup) {
          setShowReferralPopup(false)
          setPopupErrorMsg("")
        }
        setReferralErrorMsg("")

        if (typeof window !== "undefined" && (window as any).confetti) {
          ;(window as any).confetti({
            particleCount: 75,
            spread: 80,
            origin: { y: 0.6 },
            colors: ["#22c55e", "#ffc8d6", "#f4a0b5", "#ffffff"],
          })
        }
        return true
      } else {
        const errText = res.message || "Invalid Referral Code"
        if (isFromPopup) {
          setPopupErrorMsg(errText)
        } else {
          setReferralErrorMsg(errText)
        }
        return false
      }
    } catch (err: any) {
      console.error("[Referral Thrown Exception]:", err)
      const errText = err.message || "Failed to validate referral code."
      if (isFromPopup) setPopupErrorMsg(errText)
      else setReferralErrorMsg(errText)
      return false
    }
  }

  const startRecording = async () => {
    playButtonSound()
    setErrorMsg("")

    // Check if browser supports in-app MediaRecorder & getUserMedia (e.g. localhost or HTTPS)
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined"
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        })

        let recorder: MediaRecorder
        if (typeof MediaRecorder.isTypeSupported === "function") {
          if (MediaRecorder.isTypeSupported("audio/mp4")) {
            recorder = new MediaRecorder(stream, { mimeType: "audio/mp4" })
          } else if (MediaRecorder.isTypeSupported("audio/webm")) {
            recorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
          } else {
            recorder = new MediaRecorder(stream)
          }
        } else {
          recorder = new MediaRecorder(stream)
        }

        mediaRecorderRef.current = recorder
        audioChunksRef.current = []

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data)
          }
        }

        recorder.onstop = () => {
          const mime = recorder.mimeType || "audio/webm"
          const audioBlob = new Blob(audioChunksRef.current, { type: mime })
          const ext =
            mime.includes("mp4") || mime.includes("aac")
              ? "m4a"
              : mime.includes("ogg")
                ? "ogg"
                : "webm"
          const file = new File(
            [audioBlob],
            `voice_note_${Date.now()}.${ext}`,
            { type: mime },
          )
          setVoiceNoteFile(file)
          setVoiceNote(true)
          stream.getTracks().forEach((track) => track.stop())
        }

        recorder.start()
        setIsRecording(true)
        setRecordSecs(0)

        recordTimerRef.current = setInterval(() => {
          setRecordSecs((s) => s + 1)
        }, 1000)
        return
      } catch (err) {
        console.warn(
          "In-app mic recorder failed, triggering mobile native voice recorder:",
          err,
        )
      }
    }

    // Fallback for Mobile HTTP IP / browsers blocking getUserMedia: Open native mobile recorder directly
    if (nativeMicInputRef.current) {
      nativeMicInputRef.current.click()
    }
  }

  const stopRecording = () => {
    playButtonSound()
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const [spotifyQ, setSpotifyQ] = useState(initialDraft?.spotifyQ || "")
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const musicFileInputRef = useRef<HTMLInputElement>(null)
  const [secretQuestions, setSecretQuestions] = useState(
    initialDraft?.secretQuestions || [
      { question: "When did we first meet?", answer: "" },
      { question: "What nickname do I call you?", answer: "" },
      { question: "What is our favorite memory together?", answer: "" },
    ],
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  // 1. Auto-Restore Files (Photos & Voice Note) from Initial Draft Base64
  useEffect(() => {
    if (initialDraft) {
      if (initialDraft.photoBase64s && Array.isArray(initialDraft.photoBase64s)) {
        const files = initialDraft.photoBase64s.map((b64: string, idx: number) =>
          base64ToFile(b64, `restored_photo_${idx}.png`),
        )
        setPhotoFiles(files)
      }
      if (initialDraft.voiceNoteBase64) {
        const file = base64ToFile(
          initialDraft.voiceNoteBase64,
          "restored_voice_note.webm",
        )
        setVoiceNoteFile(file)
        setVoiceNote(true)
      }
    }
  }, [initialDraft])

  // 2. Auto-Save Draft to LocalStorage whenever form fields change
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const photoBase64s: string[] = []
        for (const file of photoFiles) {
          try {
            const b64 = await fileToBase64(file)
            photoBase64s.push(b64)
          } catch {}
        }
        if (photoBase64s.length === 0 && photos.length > 0) {
          photoBase64s.push(...photos.filter((p) => p.startsWith("data:")))
        }

        let voiceNoteBase64 = ""
        if (voiceNoteFile) {
          try {
            voiceNoteBase64 = await fileToBase64(voiceNoteFile)
          } catch {}
        }

        const draft = {
          gfName,
          bfName,
          letter,
          spotifyQ,
          secretQuestions,
          isReferralApplied,
          appliedReferralCode,
          photoBase64s,
          voiceNoteBase64,
          updatedAt: Date.now(),
        }

        if (
          gfName.trim() ||
          bfName.trim() ||
          letter.trim() ||
          spotifyQ.trim() ||
          photoBase64s.length > 0 ||
          voiceNoteBase64 ||
          secretQuestions.some((q) => q.answer.trim())
        ) {
          localStorage.setItem(DASHBOARD_DRAFT_KEY, JSON.stringify(draft))
        }
      } catch (err) {
        console.warn("[Draft Auto-Save] Failed to persist draft:", err)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [
    gfName,
    bfName,
    letter,
    spotifyQ,
    secretQuestions,
    isReferralApplied,
    appliedReferralCode,
    photoFiles,
    photos,
    voiceNoteFile,
  ])

  const addPhotos = (files: FileList | null) => {
    if (!files) return
    playButtonSound()
    const newFiles = Array.from(files).slice(0, 5 - photos.length)
    setPhotoFiles((prev) => [...prev, ...newFiles])
    newFiles.forEach((f) => {
      const url = URL.createObjectURL(f)
      setPhotos((prev) => [...prev, url])
    })
  }

  const handleGenerateLink = async () => {
    if (!gfName.trim() || !bfName.trim()) {
      setErrorMsg("Please enter both Girlfriend and Boyfriend names ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â")
      return
    }
    setErrorMsg("")

    // Launch Razorpay Checkout Modal (Test Key: rzp_test_TJJpml3f29qMoT)
    await launchRazorpayCheckout({
      amount: finalPrice,
      description: `Romantic Gift Website Customization (${gfName} & ${bfName})`,
      userEmail: userProfile?.email || "",
      userName: userProfile?.name || bfName,
      onSuccess: async (paymentRes) => {
        console.log("[Razorpay Verified Payment]:", paymentRes)
        onRequestCreateAccount(async () => {
          setIsSubmitting(true)
          try {
            // Parallelize all photo, music, and voice note uploads for 80% faster processing speed
            const [photoUploadResults, musicPublicUrl, voiceNotePublicUrl] =
              await Promise.all([
                Promise.all(photoFiles.map((file) => uploadPhoto(file))),
                musicFile ? uploadMusicTrack(musicFile) : Promise.resolve(""),
                voiceNoteFile
                  ? uploadVoiceNote(voiceNoteFile)
                  : Promise.resolve(""),
              ])

            const uploadedPhotoUrls: string[] = [...photoUploadResults]
            if (uploadedPhotoUrls.length === 0 && photos.length > 0) {
              uploadedPhotoUrls.push(
                ...photos.filter((p) => p.startsWith("http")),
              )
            }

            const questionRecords = secretQuestions
              .filter((q) => q.question.trim() && q.answer.trim())
              .map((q) => ({
                question: q.question.trim(),
                answer: q.answer.trim(),
              }))

            const finalSpotifyUrl =
              musicPublicUrl ||
              spotifyQ.trim() ||
              spotifyTrackId.trim() ||
              "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"

            const result = await createSurprise({
              girlfriend_name: gfName.trim(),
              boyfriend_name: bfName.trim(),
              photos: uploadedPhotoUrls,
              letter: letter.trim() || "",
              spotify_url: finalSpotifyUrl,
              voice_note_url: voiceNotePublicUrl || undefined,
              questions: questionRecords,
            })

            const fullShareLink = `${window.location.origin}/s/${result}`
            setLink(fullShareLink)
            localStorage.removeItem(DASHBOARD_DRAFT_KEY)
            setIsSubmitting(false)
          } catch (err: any) {
            console.error("Failed to save surprise:", err)
            setErrorMsg(
              err.message || "Failed to save surprise. Please try again.",
            )
            setIsSubmitting(false)
          }
        })
      },
      onFailure: (err) => {
        console.warn("[Razorpay Payment Cancelled or Error]:", err)
        setErrorMsg(
          err.message ||
            "Payment was cancelled. Please try again to unlock your website.",
        )
      },
    })
  }

  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (textToCopy: string) => {
    playButtonSound()
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy)
      } else {
        throw new Error("Clipboard API unavailable")
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for non-HTTPS / iframe environments
      try {
        const textarea = document.createElement("textarea")
        textarea.value = textToCopy
        textarea.style.position = "fixed"
        textarea.style.left = "-9999px"
        textarea.style.top = "-9999px"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      } catch (err) {
        console.error("Failed to copy link:", err)
      }
    }
  }

  const card: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "clamp(18px, 3vw, 28px)",
    boxShadow: "0 4px 28px rgba(200,80,140,0.1), 0 1px 4px rgba(0,0,0,0.06)",
    border: "1px solid rgba(232,120,154,0.22)",
    marginBottom: "16px",
  }

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "14px",
    border: "1.5px solid rgba(200,67,138,0.28)",
    outline: "none",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "clamp(13px, 1.5vw, 15px)",
    color: "#0f0022",
    background: "#ffffff",
    transition: "border-color 0.2s, box-shadow 0.2s",
  }

  const lbl: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: "700",
    color: "#7a0f50",
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: "6px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  }

  const secTitle: React.CSSProperties = {
    fontFamily: "'Playfair Display', serif",
    fontSize: "clamp(1rem, 2.2vw, 1.35rem)",
    fontWeight: "700",
    color: "#1a0035",
    marginBottom: "3px",
  }

  const secSub: React.CSSProperties = {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "clamp(0.75rem, 1.5vw, 0.9rem)",
    color: "#6b1245",
    fontWeight: "500",
    marginBottom: "16px",
  }

  const focusInp = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    e.currentTarget.style.borderColor = "#c9438a"
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,67,138,0.15)"
  }
  const blurInp = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    e.currentTarget.style.borderColor = "rgba(200,67,138,0.28)"
    e.currentTarget.style.boxShadow = "none"
  }

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, #fff8f9 0%, #fef0f5 55%, #fff4fc 100%)",
        minHeight: "100dvh",
      }}
    >
      <div
        className="sticky top-0 z-20"
        style={{
          background: "rgba(255,248,250,0.96)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(232,120,154,0.18)",
        }}
      >
        <div className="dashboard-container py-4 flex items-center justify-center">
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1rem, 2.5vw, 1.4rem)",
              fontWeight: "700",
              color: "#1a0035",
            }}
          >
            Create a Surprise ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â
          </h1>
        </div>
      </div>

      <div className="dashboard-container py-6">
        <div className="text-center mb-8">
          <div
            className="mb-3 animate-pulse-heart inline-block"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4rem)",
              filter: "drop-shadow(0 0 18px rgba(232,120,154,0.5))",
            }}
          >
            ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â
          </div>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.2rem, 3vw, 1.75rem)",
              fontWeight: "700",
              color: "#1a0035",
              marginBottom: "6px",
            }}
          >
            Design Her Perfect Surprise
          </h2>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "clamp(0.8rem, 1.8vw, 1rem)",
              color: "#7a0f50",
              fontWeight: "500",
            }}
          >
            A luxury digital gift made with love
          </p>
        </div>

        <div className="dashboard-grid">

        {/* 1. Names */}
        <div style={card}>
          <div style={secTitle}>ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â‚¬Ëœ Your Love Story</div>
          <div style={secSub}>Tell us who this surprise is for</div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label style={lbl}>Her Name</label>
              <input
                style={inp}
                value={gfName}
                onChange={(e) => setGfName(e.target.value)}
                placeholder="e.g. Priya, Ananya, Sofia..."
                onFocus={focusInp}
                onBlur={blurInp}
              />
            </div>
            <div>
              <label style={lbl}>Your Name</label>
              <input
                style={inp}
                value={bfName}
                onChange={(e) => setBfName(e.target.value)}
                placeholder="e.g. Arjun, Rohan, Alex..."
                onFocus={focusInp}
                onBlur={blurInp}
              />
            </div>
          </div>
        </div>

        {/* 2. Photos */}
        <div style={card}>
          <div style={secTitle}>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¸ Your Memories</div>
          <div style={secSub}>Upload up to 5 special photos together</div>

          <div
            onClick={() => photoInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              addPhotos(e.dataTransfer.files)
            }}
            className="cursor-pointer transition-all duration-200 text-center rounded-2xl p-6"
            style={{
              border: `2px dashed ${
                dragOver ? "#e8789a" : "rgba(200,67,138,0.35)"
              }`,
              background: dragOver
                ? "rgba(232,120,154,0.08)"
                : "rgba(255,240,246,0.7)",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â·</div>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                color: "#7a0f50",
                fontWeight: "600",
              }}
            >
              Drag & drop or tap to upload
            </p>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "11px",
                color: "#7a0f50",
                fontWeight: "500",
                marginTop: "3px",
              }}
            >
              {photos.length}/5 photos uploaded
            </p>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addPhotos(e.target.files)}
            />
          </div>

          {photos.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(photos.length, 5)}, 1fr)`,
                gap: "8px",
                marginTop: "12px",
              }}
            >
              {photos.map((url, i) => (
                <div key={i} className="relative" style={{ aspectRatio: "1" }}>
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <button
                    onClick={() => {
                      setPhotos((prev) => prev.filter((_, j) => j !== i))
                      setPhotoFiles((prev) => prev.filter((_, j) => j !== i))
                    }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center cursor-pointer font-bold"
                    style={{ background: "#e8789a", lineHeight: 1 }}
                  >
                    ÃƒÆ’Ã¢â‚¬â€
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Love Letter */}
        <div style={card}>
          <div style={secTitle}>ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã…â€™ Your Love Letter</div>
          <div style={secSub}>
            Write from your heart ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â she will treasure this forever
          </div>
          <textarea
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            placeholder={`My dearest love,\n\nEvery day with you feels like a dream...`}
            rows={6}
            style={{
              ...inp,
              resize: "none",
              lineHeight: "1.65",
              fontStyle: letter ? "italic" : "normal",
              fontFamily: letter
                ? "'Playfair Display', serif"
                : "'DM Sans', sans-serif",
            }}
            onFocus={focusInp}
            onBlur={blurInp}
          />
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "11px",
              color: "#7a0f50",
              fontWeight: "600",
              textAlign: "right",
              marginTop: "5px",
            }}
          >
            {letter.length} characters
          </p>
        </div>

        {/* 4. Voice Note */}
        <div style={card}>
          <div style={secTitle}>ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â Voice Note</div>
          <div style={secSub}>
            Directly record your voice or upload an audio file
          </div>

          {voiceNote ? (
            <div
              className="flex items-center gap-3 p-4 rounded-2xl"
              style={{
                background: "rgba(232,120,154,0.12)",
                border: "1px solid rgba(232,120,154,0.3)",
              }}
            >
              <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-xl">
                ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Âµ
              </div>
              <div className="flex-1">
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    color: "#7a0f50",
                    fontWeight: "700",
                  }}
                >
                  Voice note recorded ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“
                </p>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "11px",
                    color: "#7a0f50",
                    opacity: 0.8,
                  }}
                >
                  {voiceNoteFile ? voiceNoteFile.name : "Ready to surprise her"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  playButtonSound()
                  setVoiceNote(false)
                  setVoiceNoteFile(null)
                }}
                className="px-3 py-1.5 rounded-full text-xs font-bold text-pink-700 hover:bg-pink-200/50 cursor-pointer"
              >
                ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ Re-record
              </button>
            </div>
          ) : isRecording ? (
            <div
              className="text-center rounded-2xl p-6 transition-all duration-300 animate-fade-up"
              style={{
                border: "2px solid #e8789a",
                background: "rgba(255,230,240,0.85)",
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="w-4 h-4 rounded-full bg-red-500 animate-ping inline-block" />
                <span
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "18px",
                    fontWeight: "700",
                    color: "#c9438a",
                  }}
                >
                  Recording... {formatSecs(recordSecs)}
                </span>
              </div>
              <p
                className="text-xs mb-4"
                style={{
                  color: "#7a0f50",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Speak from your heart ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â
              </p>
              <button
                type="button"
                onClick={stopRecording}
                className="px-6 py-3 rounded-full text-xs font-bold text-white cursor-pointer transition-all duration-200 hover:scale-105"
                style={{
                  background:
                    "linear-gradient(135deg, #e8789a 0%, #c9438a 100%)",
                  boxShadow: "0 4px 18px rgba(232,120,154,0.5)",
                }}
              >
                ÃƒÂ¢Ã‚ÂÃ‚Â¹ÃƒÂ¯Ã‚Â¸Ã‚Â Stop & Save Voice Note
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={startRecording}
                className="w-full flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-200 hover:scale-[1.02] cursor-pointer text-center select-none"
                style={{
                  border: "2px dashed #e8789a",
                  background: "rgba(255,240,246,0.85)",
                  boxShadow: "0 4px 18px rgba(232,120,154,0.12)",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "6px" }}>ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â</div>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "14px",
                    color: "#7a0f50",
                    fontWeight: "700",
                  }}
                >
                  Tap to Record Live Voice Note
                </p>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "11px",
                    color: "#7a0f50",
                    opacity: 0.8,
                    marginTop: "2px",
                  }}
                >
                  Speak your message for her ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â
                </p>
              </button>
              {/* Native mobile mic fallback input */}
              <input
                ref={nativeMicInputRef}
                type="file"
                accept="audio/*"
                capture="user"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setVoiceNoteFile(e.target.files[0])
                    setVoiceNote(true)
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* 5. Her Special Song (MP3 Upload Only) */}
        <div style={card}>
          <div style={secTitle}>ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Âµ Her Special Song (MP3 Upload)</div>
          <div style={secSub}>
            Upload an MP3 song file so the full song plays when she opens the
            gift!
          </div>

          <div className="space-y-3">
            {/* MP3 File Upload Box */}
            <div
              className="p-5 rounded-xl border-2 border-dashed text-center transition-all cursor-pointer hover:border-pink-500"
              style={{
                borderColor: musicFile ? "#c9438a" : "rgba(200,67,138,0.4)",
                background: musicFile
                  ? "rgba(255,240,246,0.9)"
                  : "rgba(255,255,255,0.7)",
              }}
              onClick={() => musicFileInputRef.current?.click()}
            >
              <input
                ref={musicFileInputRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    playButtonSound()
                    setMusicFile(file)
                    const blobUrl = URL.createObjectURL(file)
                    setSpotifyQ(blobUrl)
                    setSpotifyTrackId(blobUrl)
                  }
                }}
              />
              <div className="text-3xl mb-2">ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¶</div>
              <div className="text-sm font-bold text-[#7a0f50]">
                {musicFile
                  ? `Uploaded: ${musicFile.name}`
                  : "Click to Upload MP3 Song File"}
              </div>
              <div className="text-xs text-pink-700/70 mt-1">
                {musicFile
                  ? `Size: ${(musicFile.size / (1024 * 1024)).toFixed(2)} MB ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Click to change`
                  : "Supports MP3, M4A, WAV audio files (100% full song playback)"}
              </div>
            </div>

            {/* Remove file button if uploaded */}
            {musicFile && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    playButtonSound()
                    setMusicFile(null)
                    setSpotifyQ("")
                    setSpotifyTrackId("")
                  }}
                  className="text-xs text-pink-600 hover:text-pink-800 underline font-medium cursor-pointer"
                >
                  ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã¢â‚¬ËœÃƒÂ¯Ã‚Â¸Ã‚Â Remove Uploaded Song
                </button>
              </div>
            )}

            {/* Live Player Preview */}
            {(musicFile || (spotifyQ && spotifyQ.startsWith("http"))) && (
              <div className="mt-3">
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "11px",
                    color: "#7a0f50",
                    fontWeight: "600",
                    marginBottom: "6px",
                  }}
                >
                  Live Player Preview:
                </p>
                <SpotifyPlayer trackId={spotifyQ || spotifyTrackId} />
              </div>
            )}
          </div>
        </div>
        </div> {/* end dashboard-grid */}

        {/* Full-width below: Secret Questions, Pricing, etc */}
        <div className="dashboard-grid-full">

        {/* 6. Secret Questions */}
        <div style={card}>
          <div style={secTitle}>ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â Secret Questions</div>
          <div style={secSub}>
            Customize the questions and exact answers she must reply to unlock
            the surprise
          </div>

          {/* Quick Idea Presets */}
          <div className="mb-4">
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "11px",
                color: "#7a0f50",
                fontWeight: "700",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¡ Need Ideas? Tap a Preset:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: "ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â‚¬Â¢ Classic Firsts",
                  items: [
                    { question: "When did we first meet?", answer: "" },
                    { question: "What nickname do I call you?", answer: "" },
                    { question: "Where was our very first date?", answer: "" },
                  ],
                },
                {
                  label: "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Âµ Shared Favorites",
                  items: [
                    {
                      question: "What is our special couple song?",
                      answer: "",
                    },
                    {
                      question: "What food did we order on our first date?",
                      answer: "",
                    },
                    {
                      question: "Where is our dream vacation spot?",
                      answer: "",
                    },
                  ],
                },
                {
                  label: "ÃƒÂ¢Ã…â€œÃ‚Â¨ Cute Inside Jokes",
                  items: [
                    {
                      question:
                        "What color dress were you wearing on our first date?",
                      answer: "",
                    },
                    {
                      question: "What secret word always makes us laugh?",
                      answer: "",
                    },
                    {
                      question:
                        "What is our favorite movie to rewatch together?",
                      answer: "",
                    },
                  ],
                },
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    playButtonSound()
                    setSecretQuestions(p.items)
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 hover:scale-105"
                  style={{
                    background: "rgba(255,240,246,0.9)",
                    color: "#7a0f50",
                    border: "1px solid rgba(200,67,138,0.25)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {secretQuestions.map((qItem, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl border border-pink-200/60 bg-pink-50/40 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span style={lbl}>Question {i + 1}</span>
                  {secretQuestions.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSecretQuestions((prev) =>
                          prev.filter((_, idx) => idx !== i),
                        )
                      }
                      className="text-xs text-pink-600 hover:text-pink-800 font-bold cursor-pointer"
                    >
                      ÃƒÆ’Ã¢â‚¬â€ Remove
                    </button>
                  )}
                </div>

                <div>
                  <input
                    style={inp}
                    value={qItem.question}
                    onChange={(e) => {
                      const updated = [...secretQuestions]
                      updated[i].question = e.target.value
                      setSecretQuestions(updated)
                    }}
                    placeholder="e.g. What is our special couple song?"
                    onFocus={focusInp}
                    onBlur={blurInp}
                  />
                </div>

                <div>
                  <label
                    style={{
                      ...lbl,
                      fontSize: "11px",
                      opacity: 0.85,
                      marginBottom: "4px",
                    }}
                  >
                    Expected Answer
                  </label>
                  {qItem.question.toLowerCase().includes("meet") ||
                  qItem.question.toLowerCase().includes("date") ||
                  qItem.question.toLowerCase().includes("when") ? (
                    <RomanticCalendarPicker
                      value={qItem.answer}
                      placeholder="Select expected date..."
                      isDark={false}
                      onChange={(val) => {
                        const updated = [...secretQuestions]
                        updated[i].answer = val
                        setSecretQuestions(updated)
                      }}
                    />
                  ) : (
                    <input
                      style={inp}
                      value={qItem.answer}
                      onChange={(e) => {
                        const updated = [...secretQuestions]
                        updated[i].answer = e.target.value
                        setSecretQuestions(updated)
                      }}
                      placeholder="e.g. Perfect, Sunshine, Paris..."
                      onFocus={focusInp}
                      onBlur={blurInp}
                    />
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setSecretQuestions((prev) => [
                  ...prev,
                  {
                    question: `Secret Question ${prev.length + 1}`,
                    answer: "",
                  },
                ])
              }
              className="w-full py-3 rounded-2xl border border-dashed border-pink-400/60 text-xs font-bold text-[#7a0f50] hover:bg-pink-100/50 cursor-pointer transition-colors"
            >
              + Add Another Secret Question
            </button>
          </div>
        </div>

        {/* Referral Popup Modal */}
        <ReferralPopupModal
          isOpen={showReferralPopup && !isReferralApplied}
          onClose={() => setShowReferralPopup(false)}
          onApply={(code) => applyDiscountCode(code, true)}
          errorMsg={popupErrorMsg}
        />

        {/* Error notification if any */}
        {errorMsg && (
          <p
            className="mb-4 text-center text-sm font-semibold animate-fade-up"
            style={{ color: "#d91f54", fontFamily: "'DM Sans', sans-serif" }}
          >
            ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â {errorMsg}
          </p>
        )}

        {/* 7. Redesigned Premium Pricing Card */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-7 mb-5 text-white"
          style={{
            background:
              "linear-gradient(135deg, #1a0035 0%, #2e0055 50%, #15002a 100%)",
            border: "1px solid rgba(255, 192, 203, 0.3)",
            boxShadow: "0 16px 60px rgba(200,67,138,0.3)",
          }}
        >
          <div className="text-center">
            <div className="text-4xl mb-2">ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â</div>
            <h2
              className="text-xl sm:text-2xl font-bold mb-2 leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Create the Most Emotional Gift She'll Never Forget ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â
            </h2>
            <p
              className="text-xs sm:text-sm text-pink-200/70 mb-6"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Create a magical personalized experience she'll remember forever.
            </p>

            {/* Price Display Area */}
            <div className="my-5 flex flex-col items-center justify-center">
              {isReferralApplied ? (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="flex items-baseline justify-center gap-3">
                    <span className="text-2xl line-through text-pink-300/50 font-serif font-bold">
                      ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹99
                    </span>
                    <span
                      className="text-5xl sm:text-6xl font-bold text-pink-100 drop-shadow-md"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹49
                    </span>
                    <span className="text-xs text-pink-200/60 font-sans">
                      one-time
                    </span>
                  </div>

                  {/* Green Discount Badge */}
                  <motion.div
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mt-2.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 flex items-center gap-1.5 shadow-lg"
                  >
                    <span>ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â°</span> Referral Discount Applied ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ You Saved ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹50 ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â
                  </motion.div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="flex items-baseline justify-center gap-2">
                    <span
                      className="text-5xl sm:text-6xl font-bold text-pink-100 drop-shadow-md"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹99
                    </span>
                    <span className="text-xs text-pink-200/60 font-sans">
                      one-time
                    </span>
                  </div>
                  <p className="text-[11px] text-pink-300/70 mt-1.5 font-medium">
                    ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¡ Use a referral code to unlock 50% OFF (Pay ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹49)
                  </p>
                </div>
              )}
            </div>

            {/* Feature List */}
            <div className="my-6 space-y-3 text-left max-w-xs mx-auto">
              {[
                { icon: "ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â", text: "Personalized Love Experience" },
                { icon: "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¸", text: "Upload up to 5 Special Photos" },
                { icon: "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Âµ", text: "Add Your Personal Voice Message" },
                { icon: "ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã…â€™", text: "Write a Beautiful Love Letter" },
                { icon: "ÃƒÂ¢Ã…â€œÃ‚Â¨", text: "Premium Romantic Animations" },
                { icon: "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â€", text: "Forever Shareable Private Link" },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-pink-300 text-sm">{f.icon}</span>
                  <span
                    className="text-xs sm:text-sm text-pink-100/90 font-medium"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {f.text}
                  </span>
                </div>
              ))}

              {/* Privacy Notice Box */}
              <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-pink-400/20 text-left">
                <p
                  className="text-[11px] leading-relaxed text-pink-200/80"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢ <strong>Your memories stay private.</strong> Photos, voice
                  notes, love letters and personal details are securely
                  processed and are not permanently stored on our platform,
                  ensuring complete privacy.
                </p>
              </div>
            </div>

            {/* Trust Badge */}
            <div className="my-4 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-pink-200 bg-white/5 border border-white/10">
              ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢ One-Time Payment ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ No Subscription ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Complete Privacy
            </div>

            {/* Pay Button / Generated Link */}
            {!link ? (
              <button
                disabled={isSubmitting}
                onClick={handleGenerateLink}
                className="w-full mt-3 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed py-4 rounded-2xl text-base font-bold text-white shadow-xl"
                style={{
                  background: isReferralApplied
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "linear-gradient(135deg, #e8789a 0%, #c9438a 100%)",
                  boxShadow: isReferralApplied
                    ? "0 8px 32px rgba(16,185,129,0.4)"
                    : "0 8px 32px rgba(232,120,154,0.5)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {isSubmitting
                  ? "Uploading & Saving... ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â"
                  : `Pay ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹${finalPrice} & Generate Link ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â`}
              </button>
            ) : (
              <div className="mt-4">
                <div
                  onClick={() => copyToClipboard(link)}
                  className="cursor-pointer transition-all duration-200 hover:bg-white/10 p-4 rounded-2xl bg-white/5 border border-white/15 text-center"
                >
                  <p className="text-xs text-pink-200/70 mb-1">
                    Your Unique Surprise Link:
                  </p>
                  <p className="text-sm font-mono text-pink-300 font-bold break-all">
                    {link}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(link)}
                  className="w-full mt-3 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 font-bold text-white text-sm cursor-pointer shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {copied ? "ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ Copied to Clipboard!" : "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Copy Link"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 8. In-Page Coupon Section Below Card */}
        <div
          className="p-5 rounded-2xl text-center mb-8 shadow-sm"
          style={{
            background: "rgba(255, 255, 255, 0.75)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(200,67,138,0.25)",
          }}
        >
          {isReferralApplied ? (
            <div className="flex flex-col items-center gap-1.5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                <span>ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â°</span> Referral Code Applied:{" "}
                <span className="font-mono">{appliedReferralCode}</span>
              </div>
              <p className="text-xs font-bold text-pink-700">
                50% OFF Activated ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â (You Save ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹50)
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#7a0f50]">
                ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â Have a Referral Code?
              </p>
              <div className="flex gap-2 max-w-xs mx-auto">
                <input
                  type="text"
                  value={referralCodeInput}
                  onChange={(e) =>
                    setReferralCodeInput(e.target.value.toUpperCase())
                  }
                  placeholder="Enter Code (e.g. LOVE50)"
                  className="flex-1 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold tracking-widest text-[#7a0f50] outline-none uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-pink-900/40"
                  style={{
                    background: "rgba(255,255,255,0.9)",
                    border: referralErrorMsg
                      ? "1.5px solid #ef4444"
                      : "1.5px solid rgba(200,67,138,0.3)",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyDiscountCode(referralCodeInput)
                  }}
                />
                <button
                  type="button"
                  onClick={() => applyDiscountCode(referralCodeInput)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 transition-colors cursor-pointer shadow-md"
                >
                  Apply
                </button>
              </div>
              {referralErrorMsg && (
                <p className="text-xs text-red-500 font-semibold">
                  ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â {referralErrorMsg}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        <button
          onClick={onBack}
          className="w-full cursor-pointer transition-all duration-200 hover:bg-pink-50 mb-10"
          style={{
            padding: "15px",
            borderRadius: "16px",
            border: "1.5px solid rgba(232,120,154,0.25)",
            background: "transparent",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            color: "#c9438a",
            fontWeight: "500",
          }}
        >
          ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ¢â€šÂ¬ Preview Girlfriend's Surprise Flow
        </button>
        </div> {/* end dashboard-grid-full */}
      </div>
    </div>
  )
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ APP ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

export default function App() {
  const [spotifyTrackId, setSpotifyTrackId] = useState("4cOdK2wGLETKBW3PvgPWqT")
  const [activeSlug, setActiveSlug] = useState<string>("")
  const [surpriseData, setSurpriseData] =
    useState<SurpriseDetailResponse | null>(null)
  const [isLoadingSlug, setIsLoadingSlug] = useState(false)

  // Referral & User Auth State
  const [userProfile, setUserProfile] = useState<UserReferralProfile | null>(
    null,
  )
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [showLockedModal, setShowLockedModal] = useState(false)
  const [showPostPaymentModal, setShowPostPaymentModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [pendingSaveSurpriseFn, setPendingSaveSurpriseFn] =
    useState<(() => Promise<void>) | null>(null)
  const [generatedLink, setGeneratedLink] = useState("")

  // Restore persistent Firebase Auth session across browser refreshes & restarts
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((profile) => {
      if (profile) {
        setUserProfile(profile)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleOpenReferralsMenu = () => {
    if (userProfile) {
      setShowReferralModal(true)
    } else {
      setShowLockedModal(true)
    }
  }

  const handleRequestCreateAccount = (saveSurpriseFn: () => Promise<void>) => {
    setPendingSaveSurpriseFn(() => saveSurpriseFn)
    setShowPostPaymentModal(true)
  }

  const handleAuthSuccess = async (profile: any) => {
    setUserProfile(profile)
    setShowLoginModal(false)
    setShowPostPaymentModal(false)
    setShowLockedModal(false)

    // Process pending referral code from URL if present
    const pendingRef = sessionStorage.getItem("pending_ref_code")
    if (pendingRef && profile && profile.id) {
      sessionStorage.removeItem("pending_ref_code")
      try {
        const result = await validateAndApplyReferralCode(
          profile.id,
          profile.email,
          pendingRef,
        )
        console.log("[Referral Application Result]:", result)
      } catch (err) {
        console.warn("Referral application notice:", err)
      }
    }

    if (pendingSaveSurpriseFn) {
      await pendingSaveSurpriseFn()
      setPendingSaveSurpriseFn(null)
    } else {
      setShowReferralModal(true)
    }
  }

  const handleLogout = async () => {
    await signOutUser()
    setUserProfile(null)
    setShowReferralModal(false)
  }

  // Admin State
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() =>
    getActiveAdminSession(),
  )
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false)
  const [showSuperAdminSetupModal, setShowSuperAdminSetupModal] =
    useState(false)

  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window !== "undefined") {
      const search = window.location.search
      const path = window.location.pathname
      // Secret token gate ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â admin accessible ONLY via ?token=cg_admin_secret_7x9k2m
      const secretToken = new URLSearchParams(search).get("token")
      const ADMIN_SECRET = "cg_admin_secret_7x9k2m"
      if (secretToken === ADMIN_SECRET || path.includes("setup-super-admin")) {
        if (search.includes("setup=super-admin") || path.includes("setup-super-admin")) {
          return "setup-super-admin"
        }
        const session = getActiveAdminSession()
        if (session) return "admin-dashboard"
        return "admin-login"
      }

      const hasSurpriseParam =
        search.includes("s=") ||
        search.includes("surprise=") ||
        path.includes("/s/")
      if (hasSurpriseParam) return 1
    }
    return "dashboard"
  })

  const [overlay, setOverlay] = useState(false)

  // Extract slug from URL on mount and fetch Supabase DB data
  useEffect(() => {
    if (typeof window === "undefined") return

    const searchParams = new URLSearchParams(window.location.search)
    let slug = searchParams.get("s") || searchParams.get("surprise") || ""
    const refCode = searchParams.get("ref") || searchParams.get("referral")
    if (refCode) {
      sessionStorage.setItem("pending_ref_code", refCode.trim().toUpperCase())
      console.log(
        "[Referral Auto-Capture] Pending referral code stored from URL:",
        refCode,
      )
    }
    const path = window.location.pathname

    const ADMIN_SECRET = "cg_admin_secret_7x9k2m"
    const secretToken = searchParams.get("token")
    if (path.includes("setup-super-admin") || searchParams.get("setup") === "super-admin") {
      // Clear localStorage lock so fresh setup always works after DB reset
      resetAdminSetupLock()
      setShowSuperAdminSetupModal(true)
      return
    }
    if (secretToken === ADMIN_SECRET) {
      const session = getActiveAdminSession()
      if (session) {
        setAdminUser(session)
        setScreen("admin-dashboard")
      } else {
        setShowAdminLoginModal(true)
      }
      return
    }

    if (!slug && path.includes("/s/")) {
      slug = path.split("/s/")[1]?.split("?")[0] || ""
    }

    if (slug) {
      setActiveSlug(slug)
      setIsLoadingSlug(true)
      getSurpriseBySlug(slug)
        .then((data) => {
          if (data) {
            setSurpriseData(data)
            if (data.surprise.spotify_url) {
              setSpotifyTrackId(data.surprise.spotify_url)
            }

            // Eager background pre-caching for 0ms transition delays
            if (data.photos && data.photos.length > 0) {
              data.photos.forEach((p) => {
                if (p.photo_url) {
                  const img = new Image()
                  img.src = p.photo_url
                }
              })
            }
            if (data.surprise.voice_note_url) {
              const audio = new Audio()
              audio.preload = "auto"
              audio.src = data.surprise.voice_note_url
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load surprise data:", err)
        })
        .finally(() => {
          setIsLoadingSlug(false)
        })
    }
  }, [])

  const go = useCallback((to: Screen) => {
    if (to === 7) {
      // Screen 7 (Finale): Stop background BGM and auto-play uploaded song
      window.dispatchEvent(new Event("pause-bgm"))
      window.dispatchEvent(new Event("play-uploaded-song"))
    } else if (typeof to === "number" && to >= 1 && to <= 6) {
      // Screens 1 through 6: Background BGM plays continuously, uploaded song stays paused
      window.dispatchEvent(new Event("pause-uploaded-song"))
      window.dispatchEvent(new Event("resume-bgm"))
    }
    setOverlay(true)
    setTimeout(() => {
      setScreen(to)
      window.scrollTo(0, 0)
      setOverlay(false)
    }, 280)
  }, [])

  const isFemaleUserExperience = typeof screen === "number"

  const photosList =
    surpriseData && surpriseData.photos.length > 0
      ? surpriseData.photos.map((p) => p.photo_url)
      : undefined

  const letterText = surpriseData?.surprise.letter || undefined
  const voiceNoteUrl = surpriseData?.surprise.voice_note_url || undefined

  if (screen === "admin-dashboard" && adminUser) {
    return (
      <Suspense
        fallback={
          <div
            className="fixed inset-0 flex items-center justify-center"
            style={{ background: "#0d0020" }}
          >
            <div className="text-pink-300 text-lg animate-pulse">
              Loading Admin Panel...
            </div>
          </div>
        }
      >
        <AdminDashboard
          admin={adminUser}
          onLogout={() => {
            setAdminUser(null)
            go("dashboard")
          }}
        />
      </Suspense>
    )
  }

  return (
    <div>
      <HamburgerMenu
        onOpenReferrals={handleOpenReferralsMenu}
        onOpenDashboard={() => go("dashboard")}
        onPreview={() => go(1)}
      />

      <AdminLoginModal
        isOpen={showAdminLoginModal}
        onClose={() => setShowAdminLoginModal(false)}
        onLoginSuccess={(admin) => {
          setAdminUser(admin)
          go("admin-dashboard")
        }}
      />

      <SuperAdminSetupModal
        isOpen={showSuperAdminSetupModal}
        onClose={() => setShowSuperAdminSetupModal(false)}
        onSetupSuccess={(admin) => {
          setAdminUser(admin)
          go("admin-dashboard")
        }}
      />

      <ReferralsLockedModal
        isOpen={showLockedModal}
        onClose={() => setShowLockedModal(false)}
        onCreateSurprise={() => go("dashboard")}
        onOpenSignIn={() => {
          setShowLockedModal(false)
          setShowLoginModal(true)
        }}
      />

      <AuthModal
        isOpen={showLoginModal || showPostPaymentModal}
        initialTab={showPostPaymentModal ? "signup" : "signin"}
        onClose={() => {
          setShowLoginModal(false)
          setShowPostPaymentModal(false)
        }}
        onSuccess={handleAuthSuccess}
      />

      <Suspense fallback={null}>
        <ReferralDashboardModal
          isOpen={showReferralModal}
          userProfile={userProfile}
          onClose={() => setShowReferralModal(false)}
          onLogout={handleLogout}
        />
      </Suspense>

      {isFemaleUserExperience && <RomanticBGMPlayer />}

      {/* Transition overlay */}
      {overlay && (
        <div
          className="fixed inset-0 z-[200] pointer-events-none"
          style={{ background: "rgba(13,0,32,0.65)" }}
        />
      )}

      {screen === 1 && (
        <S1
          onNext={() => go(2)}
          onDash={() => go("dashboard")}
          girlfriendName={surpriseData?.surprise.girlfriend_name}
        />
      )}
      {screen === 2 && <S2 onNext={() => go(3)} />}
      {screen === 3 && <S3 onNext={() => go(4)} />}
      {screen === 4 && (
        <S4
          onNext={() => go(5)}
          slug={activeSlug}
          questions={surpriseData?.questions}
        />
      )}
      {screen === 5 && <S5 onNext={() => go(6)} />}
      {screen === 6 && (
        <S6
          onNext={() => go(7)}
          bgPhoto={photosList ? photosList[0] : undefined}
        />
      )}
      {screen === 7 && (
        <S7
          onReplay={() => go(1)}
          onDash={() => go("dashboard")}
          trackId={spotifyTrackId}
          photos={photosList}
          letter={letterText}
          voiceNoteUrl={voiceNoteUrl}
        />
      )}
      {screen === "dashboard" && (
        <Dashboard
          onBack={() => go(1)}
          spotifyTrackId={spotifyTrackId}
          setSpotifyTrackId={setSpotifyTrackId}
          onRequestCreateAccount={handleRequestCreateAccount}
          link={generatedLink}
          setLink={setGeneratedLink}
          userProfile={userProfile}
        />
      )}
    </div>
  )
}
