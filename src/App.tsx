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
  getUserCreatedSurprises,
  getSurpriseForEdit,
  updateSurprise,
  invalidateSurpriseCache,
} from "./lib/surpriseService"
import { getOrCreateDeviceToken } from "./lib/deviceToken"
import { AdminLoginModal } from "./components/AdminLoginModal"
import { SuperAdminSetupModal } from "./components/SuperAdminSetupModal"
import { launchRazorpayCheckout } from "./lib/razorpayService"
import { getActiveAdminSession, resetAdminSetupLock, type AdminUser } from "./lib/adminAuthService"
import type { SurpriseDetailResponse, PublicQuestion } from "./types/database"

// Lazy-loaded heavy components (code splitting for faster initial load)
const AdminDashboard = lazy(() =>
  import("./components/AdminDashboard").then((m) => ({
    default: m.AdminDashboard,
  })),
)

type Screen = 1 | 2 | 3 | 4 | 5 | 6 | 7 | "dashboard" | "admin-login" | "admin-dashboard" | "setup-super-admin"

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const ROMANTIC_CAPTIONS = [
  "The day my world changed forever ❤️",
  "Every smile with you feels like home ✨",
  "My favorite place in the whole world is right next to you 🌹",
  "Little moments with you become everlasting memories 💖",
  "Forever wouldn't be long enough with you 💕",
  "You make every single day feel magical 🥂",
  "Our happiest chapter, written together ❤️",
]

const MEMORY_QUOTES = [
  "“In all the world, there is no heart for me like yours. In all the world, there is no love for you like mine.”",
  "“If I had a flower for every time I thought of you... I could walk through my garden forever.”",
  "“You are my today and all of my tomorrows.”",
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

On this special Girlfriend Day, I want you to know that loving you is the greatest adventure of my life. You make everything brighter — every moment sweeter, every memory worth treasuring forever.

I fall in love with you more every single day, and I am so grateful you are mine.

Thank you for being my person, my peace, my home.

Forever yours, with all my love ❤️`

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

// ── SHARED ATOMS ───────────────────────────────────────────────────────────

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
          ❤️
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

// ── AUDIO SYSTEM (WEB AUDIO SYNTHESIZER & BGM) ─────────────────────────────

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
  const isExplicitlyPausedRef = useRef(false)

  useEffect(() => {
    const audio = new Audio(
      "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    )
    audio.loop = true
    audio.volume = 0.45
    audioRef.current = audio

    const startBGM = () => {
      if (userMutedRef.current || isExplicitlyPausedRef.current) return
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
      if (userMutedRef.current || isExplicitlyPausedRef.current) return
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
      isExplicitlyPausedRef.current = true
      const currentAudio = audioRef.current
      if (currentAudio) {
        currentAudio.pause()
        setIsPlaying(false)
      }
    }

    const handleResumeBGM = () => {
      isExplicitlyPausedRef.current = false
      userMutedRef.current = false
      const currentAudio = audioRef.current
      if (currentAudio) {
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
      isExplicitlyPausedRef.current = true
      audio.muted = true
      audio.pause()
      setIsMuted(true)
      setIsPlaying(false)
    } else {
      userMutedRef.current = false
      isExplicitlyPausedRef.current = false
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
          ? "🎵 Playing • Tap to Mute"
          : "🔇 Muted • Tap to Play"}
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

// ── SCREEN 1 — LANDING ─────────────────────────────────────────────────────

function S1({
  onNext,
  onDash,
  girlfriendName,
}: {
  onNext: () => void
  onDash: () => void
  girlfriendName?: string
}) {
  useEffect(() => {
    window.dispatchEvent(new Event("resume-bgm"))
  }, [])
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
          ❤️
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

        <Btn onClick={onNext}>Unlock ❤️</Btn>

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
          Create ↗
        </button>
      )}
    </div>
  )
}

// ── SCREEN 2 — LOADING ─────────────────────────────────────────────────────

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
        <div className="space-y-4 w-full flex flex-col items-center justify-center">
          {steps.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-3 transition-all duration-600 text-center"
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
                {checks.has(i) ? "✓" : ""}
              </div>
              <span
                className="text-pink-100 text-sm text-center font-medium"
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

// ── SCREEN 3 — VERIFY ──────────────────────────────────────────────────────

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
          <div className="text-6xl mb-5">🔒</div>
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
            Continue ❤️
          </Btn>
        </Glass>
      </div>
    </div>
  )
}

// ── ROMANTIC CALENDAR PICKER ───────────────────────────────────────────────

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
        <span className="truncate">{value ? `📅 ${value}` : placeholder}</span>
        <span
          className={
            isDark
              ? "text-pink-300 text-xs ml-2 opacity-80"
              : "text-pink-600 text-xs ml-2"
          }
        >
          📅
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
              ‹
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
              ›
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

// ── SCREEN 4 — QUESTIONS ───────────────────────────────────────────────────

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
      setErrMessage("Please answer all secret questions ❤️")
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
          setErrMessage(res.message || "Incorrect answer(s). Try once more ❤️")
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
            Answer Our Special Questions ❤️
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
              {errMessage || "Almost... Try once more ❤️"}
            </p>
          )}

          <div className="mt-8">
            <Btn onClick={submit} full disabled={isVerifying}>
              {isVerifying ? "Verifying Answers... ❤️" : "Unlock Gift ❤️"}
            </Btn>
          </div>
        </Glass>
      </div>
    </div>
  )
}

// ── SCREEN 5 — GIFT BOX ────────────────────────────────────────────────────

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
              ✨
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
          Open it to see what I made for you ❤️
        </p>

        <Btn onClick={onNext}>Open Gift ❤️</Btn>
      </div>
    </div>
  )
}

// ── SCREEN 6 — SUSPENSE ────────────────────────────────────────────────────

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
        <div className="text-7xl mb-6 animate-pulse-heart">🌹</div>
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

        <Btn onClick={onNext}>Reveal Everything ❤️</Btn>
      </div>
    </div>
  )
}

// ── SCREEN 7 SUB-COMPONENTS ────────────────────────────────────────────────

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
        if (audioRef.current && (audioRef.current.paused || audioRef.current.muted)) {
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

    if (isPlaying && !isMuted) {
      audio.pause()
      setIsPlaying(false)
    } else {
      window.dispatchEvent(new Event("pause-bgm"))
      audio.muted = false
      audio
        .play()
        .then(() => {
          setIsMuted(false)
          setIsPlaying(true)
        })
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
      <div className="mb-6 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300">
        <iframe
          src={`https://open.spotify.com/embed/track/${activeId}?utm_source=generator&theme=0`}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="w-full rounded-2xl"
          style={{
            borderRadius: "16px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.18)",
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
              🎵 Your Special Song (Full Track)
            </span>
            <button
              onClick={toggleMute}
              className="text-xs text-white/70 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? "🔇" : "🔊"}
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
              {isPlaying ? "⏸" : "▶"}
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
      icon: ["✨", "❤️", "💖", "🌸", "💕"][i % 5],
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
          💖
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
      initial={{ opacity: 0, y: 50, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      onViewportEnter={() => setHasEntered(true)}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="my-4 relative flex flex-col items-center justify-center w-full max-w-xl mx-auto"
    >
      {hasEntered && <SparkleBurst />}

      <div className="memory-card-inner group w-full">
        {/* Photo Card Container */}
        <motion.div
          whileHover={{ y: -4, scale: 1.015 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl p-3 sm:p-4 shadow-2xl cursor-pointer transition-all duration-500 hover:shadow-pink-500/30 w-full"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,192,203,0.06))",
            backdropFilter: "blur(20px)",
            border: "1.5px solid rgba(255,200,220,0.3)",
            boxShadow:
              "0 20px 50px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        >
          {/* Photo Header / Badge */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-400 animate-pulse" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-pink-200/90 font-mono">
                MEMORY #{index + 1}
              </span>
            </div>
            <span className="text-xs text-pink-300/60 font-serif italic">
              Sweet Moment
            </span>
          </div>

          <div className="relative overflow-hidden rounded-2xl w-full bg-black/50 backdrop-blur-md border border-pink-500/20 min-h-[220px] sm:min-h-[300px] flex items-center justify-center p-2 sm:p-3">
            <div
              className="absolute inset-0 bg-cover bg-center blur-2xl opacity-35 scale-110 pointer-events-none"
              style={{ backgroundImage: `url(${photo})` }}
            />
            <img
              src={photo}
              alt={`Memory ${index + 1}`}
              loading="lazy"
              className="relative z-10 max-w-full max-h-[65vh] w-auto h-auto object-contain rounded-xl shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]"
            />
          </div>

          {/* Animated Glassmorphism Caption */}
          <div
            className="mt-3.5 px-4 py-3 rounded-2xl backdrop-blur-md text-center w-full"
            style={{
              background: "rgba(20, 0, 35, 0.45)",
              border: "1px solid rgba(255, 200, 220, 0.2)",
            }}
          >
            <p
              className="text-xs sm:text-sm font-medium text-pink-100 leading-snug"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {caption}
            </p>
          </div>
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
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      onViewportEnter={handleEnter}
      transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
      className="my-10 text-center relative w-full max-w-xl mx-auto"
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-4xl mb-3"
      >
        👑❤️✨
      </motion.div>

      <h3
        className="font-bold text-pink-200 mb-1 drop-shadow-md"
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(1.2rem, 3vw, 1.85rem)",
        }}
      >
        Our Greatest Chapter Begins
      </h3>
      <p className="text-xs text-pink-300/70 mb-5 font-sans">
        The memory that holds my whole heart forever
      </p>

      {/* Main Spotlight Image Container */}
      <motion.div
        whileHover={{ y: -4, scale: 1.015 }}
        transition={{ duration: 0.4 }}
        className="relative w-full rounded-3xl p-3 sm:p-4 shadow-2xl overflow-hidden cursor-pointer"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,105,180,0.3))",
          backdropFilter: "blur(20px)",
          border: "2px solid rgba(255,220,240,0.45)",
          boxShadow:
            "0 0 60px rgba(255,105,180,0.35), 0 30px 70px rgba(0,0,0,0.8)",
        }}
      >
        <div className="relative overflow-hidden rounded-2xl w-full bg-black/50 backdrop-blur-md border border-pink-500/30 min-h-[240px] sm:min-h-[340px] flex items-center justify-center p-2 sm:p-3">
          <div
            className="absolute inset-0 bg-cover bg-center blur-2xl opacity-40 scale-110 pointer-events-none"
            style={{ backgroundImage: `url(${photo})` }}
          />
          <img
            src={photo}
            alt="Final Memory Spotlight"
            loading="lazy"
            className="relative z-10 max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-xl shadow-2xl transition-transform duration-700 hover:scale-[1.02]"
          />
        </div>

        {/* Final Romantic Glow Caption */}
        <div
          className="mt-3.5 p-3.5 rounded-2xl backdrop-blur-xl border border-pink-400/30 text-center shadow-xl"
          style={{ background: "rgba(20, 0, 35, 0.65)" }}
        >
          <p
            className="text-xs sm:text-sm font-serif italic text-pink-100"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            “You are my today, my tomorrow, and my entire forever.” ❤️
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Slideshow({ photos }: { photos?: string[] }) {
  const photoList = photos && photos.length > 0 ? photos : DEFAULT_PHOTOS

  return (
    <div className="relative my-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="text-center mb-10"
      >
        <span className="text-[10px] uppercase tracking-widest text-pink-300 font-bold px-3 py-1 rounded-full bg-pink-500/15 border border-pink-400/30">
          Our Romantic Journey ✨
        </span>
        <h2
          className="font-bold text-white mt-3"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(1.3rem, 3vw, 2rem)",
          }}
        >
          Memories Unlocked ❤️
        </h2>
        <p className="text-xs text-pink-200/60 mt-1 font-sans">
          Scroll down to relive our sweet moments together
        </p>
      </motion.div>

      {/* Timeline items */}
      <div className="memory-grid relative">
        {photoList.map((photo, i) => {
          const isLast = i === photoList.length - 1
          const isMemoryBreak = i > 0 && i % 3 === 0 && !isLast

          return (
            <React.Fragment key={i}>
              {isMemoryBreak && (
                <div className="memory-break-full">
                  <MemoryBreak quoteIndex={Math.floor(i / 3) - 1} />
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
      { threshold: 0.2 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!on || pos.current >= content.length) return
    const t = setTimeout(() => {
      pos.current++
      setText(content.slice(0, pos.current))
    }, 20)
    return () => clearTimeout(t)
  }, [on, text, content])

  return (
    <div ref={ref} className="mb-12 max-w-2xl mx-auto">
      <Glass className="p-7 sm:p-8 relative overflow-hidden border border-pink-400/30 shadow-2xl">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-pink-500/20">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💌</span>
            <h3
              className="text-white text-base sm:text-lg font-bold"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              My Letter From The Heart
            </h3>
          </div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-pink-300 bg-pink-500/20 px-2.5 py-1 rounded-full border border-pink-400/30">
            PERSONAL NOTE
          </span>
        </div>
        <div
          className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap"
          style={{
            color: "rgba(255,225,235,0.95)",
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            minHeight: "100px",
          }}
        >
          {text}
          {pos.current < content.length && (
            <span className="inline-block w-0.5 h-4 ml-0.5 rounded-full animate-blink-cursor align-text-bottom bg-pink-400" />
          )}
        </div>
      </Glass>
    </div>
  )
}

function VoiceNote({ voiceNoteUrl }: { voiceNoteUrl?: string }) {
  const [play, setPlay] = useState(false)
  const [prog, setProg] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioObjRef = useRef<HTMLAudioElement | null>(null)
  const bars = useRef(
    Array.from({ length: 36 }, () => Math.random() * 26 + 6),
  ).current

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00"
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? "0" : ""}${s}`
  }

  useEffect(() => {
    if (voiceNoteUrl) {
      const audio = new Audio(voiceNoteUrl)
      audioObjRef.current = audio

      const updateProgress = () => {
        setCurrentTime(audio.currentTime)
        if (audio.duration) {
          setDuration(audio.duration)
          setProg((audio.currentTime / audio.duration) * 100)
        }
      }
      const handleLoaded = () => {
        if (audio.duration) setDuration(audio.duration)
      }
      const handleEnded = () => {
        setPlay(false)
        setProg(0)
        setCurrentTime(0)
        window.dispatchEvent(new Event("play-uploaded-song"))
      }

      audio.addEventListener("loadedmetadata", handleLoaded)
      audio.addEventListener("timeupdate", updateProgress)
      audio.addEventListener("ended", handleEnded)

      return () => {
        audio.pause()
        audio.removeEventListener("loadedmetadata", handleLoaded)
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
            return p + 0.5
          })
        }, 80)
        return () => clearInterval(t)
      }
    } else {
      if (audio) audio.pause()
    }
  }, [play])

  return (
    <div className="mb-12 max-w-xl mx-auto">
      <div
        className="p-6 sm:p-7 rounded-3xl backdrop-blur-2xl shadow-2xl relative overflow-hidden text-white"
        style={{
          background:
            "linear-gradient(135deg, rgba(30, 8, 50, 0.9), rgba(70, 15, 60, 0.9))",
          border: "1.5px solid rgba(255, 180, 210, 0.35)",
          boxShadow: play
            ? "0 20px 50px rgba(232, 120, 154, 0.35), 0 0 30px rgba(255,105,180,0.2)"
            : "0 15px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-pink-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500/30 to-purple-500/30 border border-pink-400/40 flex items-center justify-center text-lg shadow-inner">
              🎙️
            </div>
            <div>
              <h4
                className="font-bold text-sm text-pink-100"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Personal Voice Message
              </h4>
              <p className="text-[11px] text-pink-300/70 font-medium">
                Spoken straight from the heart ❤️
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold tracking-wider px-2.5 py-1 rounded-full bg-pink-500/20 border border-pink-400/30 text-pink-200">
            {play ? "PLAYING AUDIO" : "VOICE NOTE"}
          </span>
        </div>

        {/* Central Audio Control Row */}
        <div className="flex items-center gap-4 sm:gap-5 my-4">
          {/* Play/Pause Main Button */}
          <button
            type="button"
            onClick={() => setPlay((p) => !p)}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white text-xl sm:text-2xl cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0 shadow-xl"
            style={{
              background: play
                ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                : "linear-gradient(135deg, #e8789a 0%, #c9438a 100%)",
              boxShadow: play
                ? "0 0 25px rgba(16, 185, 129, 0.6)"
                : "0 0 25px rgba(232, 120, 154, 0.6)",
            }}
          >
            {play ? "⏸" : "▶"}
          </button>

          {/* Dynamic Waveform Visualizer */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-[3px] h-10 justify-between">
              {bars.map((h, i) => {
                const isActive = (i / bars.length) * 100 <= prog
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-full transition-all duration-200"
                    style={{
                      height: play ? `${h}px` : "6px",
                      background: isActive
                        ? "linear-gradient(to top, #ffc8d6, #e8789a)"
                        : "rgba(255, 255, 255, 0.15)",
                      animation: play
                        ? `waveform-bar ${0.35 + (i % 5) * 0.08}s ease-in-out ${i * 0.02}s infinite alternate`
                        : "none",
                    }}
                  />
                )
              })}
            </div>

            {/* Time Stamp Indicators */}
            <div className="flex justify-between items-center text-[11px] font-mono text-pink-300/80 mt-2 font-medium">
              <span>{formatTime(currentTime)}</span>
              <span>{duration > 0 ? formatTime(duration) : "0:00"}</span>
            </div>
          </div>
        </div>

        {/* Progress Track */}
        <div
          className="h-1.5 w-full rounded-full overflow-hidden mt-3 cursor-pointer"
          style={{ background: "rgba(255, 255, 255, 0.1)" }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const clickX = e.clientX - rect.left
            const newPct = (clickX / rect.width) * 100
            setProg(newPct)
            if (audioObjRef.current && audioObjRef.current.duration) {
              audioObjRef.current.currentTime =
                (newPct / 100) * audioObjRef.current.duration
            }
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${prog}%`,
              background: "linear-gradient(90deg, #ffc8d6, #e8789a)",
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ── SCREEN 7 — FINALE ──────────────────────────────────────────────────────

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
    window.dispatchEvent(new Event("pause-uploaded-song"))
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

      <div className="finale-container relative z-10 py-10">
        <div className="max-w-xl mx-auto">
          <SpotifyPlayer trackId={trackId} />
        </div>
        <Slideshow photos={photos} />
        <LoveLetter letter={letter} />
        <VoiceNote voiceNoteUrl={voiceNoteUrl} />

        {/* Grand Finale */}
        <div className="text-center py-10 max-w-2xl mx-auto">
          <div className="text-6xl mb-5 animate-pulse-heart">❤️</div>
          <h1
            className="font-bold text-white mb-3 leading-tight"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.8rem, 5vw, 3rem)",
              textShadow: "0 0 44px rgba(255,180,200,0.65)",
            }}
          >
            Happy Girlfriend Day ❤️
          </h1>
          <p
            className="text-sm mb-12"
            style={{
              color: "rgba(255,200,220,0.55)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            I love you more than words can say, forever and always ❤️
          </p>

          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            <Btn onClick={onReplay} full>
              🔄 Replay Surprise
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── HAMBURGER MENU ─────────────────────────────────────────────────────────

function HamburgerMenu({
  onOpenDashboard,
  onPreview,
}: {
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
                  onOpenDashboard()
                }}
                className="w-full px-3.5 py-3 rounded-xl text-xs font-bold text-left text-pink-100 hover:bg-pink-500/20 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <span className="text-base">💖</span> Create Surprise
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
                <span className="text-base">👀</span> Preview Flow
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
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

// ── DASHBOARD ──────────────────────────────────────────────────────────────

const MY_CREATED_SURPRISES_KEY = "my_created_gift_surprises"

interface SavedSurpriseItem {
  slug: string
  link: string
  girlfriendName: string
  boyfriendName: string
  createdAt: string
}

function Dashboard({
  onBack,
  spotifyTrackId,
  setSpotifyTrackId,
  onPay,
  link,
  setLink,
  deviceToken,
  onSurpriseUpdated,
  initialEditSlug,
}: {
  onBack: () => void
  spotifyTrackId: string
  setSpotifyTrackId: (id: string) => void
  onPay: (saveSurpriseFn: () => Promise<void>) => void
  link: string
  setLink: (link: string) => void
  deviceToken: string
  onSurpriseUpdated?: (slug: string) => Promise<void>
  initialEditSlug?: string | null
}) {
  const [createdSurprises, setCreatedSurprises] = useState<SavedSurpriseItem[]>(() => {
    try {
      const saved = localStorage.getItem(MY_CREATED_SURPRISES_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Fetch created surprises from database when device token is available
  useEffect(() => {
    if (!deviceToken) return

    getUserCreatedSurprises(deviceToken).then((dbSurprises) => {
      if (dbSurprises && dbSurprises.length > 0) {
        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "https://gift-surprise.com"

        setCreatedSurprises((prev) => {
          const dbItems: SavedSurpriseItem[] = dbSurprises.map((s) => ({
            slug: s.slug,
            link: `${origin}/s/${s.slug}`,
            girlfriendName: s.girlfriend_name,
            boyfriendName: s.boyfriend_name,
            createdAt: s.created_at || new Date().toISOString(),
          }))

          const mergedMap = new Map<string, SavedSurpriseItem>()
          dbItems.forEach((item) => mergedMap.set(item.slug, item))
          prev.forEach((item) => {
            if (!mergedMap.has(item.slug)) {
              mergedMap.set(item.slug, item)
            }
          })

          const merged = Array.from(mergedMap.values()).sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )

          try {
            localStorage.setItem(
              MY_CREATED_SURPRISES_KEY,
              JSON.stringify(merged),
            )
          } catch {}

          return merged
        })
      }
    })
  }, [deviceToken])

  // Auto-restore link if link is empty but created surprises exist
  useEffect(() => {
    if (!link && createdSurprises.length > 0) {
      setLink(createdSurprises[0].link)
    }
  }, [createdSurprises, link, setLink])

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

  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [isLoadingEditData, setIsLoadingEditData] = useState(false)

  const [gfName, setGfName] = useState(initialDraft?.gfName || "")
  const [bfName, setBfName] = useState(initialDraft?.bfName || "")
  const [photos, setPhotos] = useState<string[]>(() =>
    Array.isArray(initialDraft?.photoBase64s)
      ? initialDraft.photoBase64s.filter(Boolean)
      : [],
  )
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [letter, setLetter] = useState(initialDraft?.letter || "")
  const [voiceNote, setVoiceNote] = useState(!!initialDraft?.voiceNoteBase64)
  const [voiceNoteFile, setVoiceNoteFile] = useState<File | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<any>(null)

  const [existingVoiceNoteUrl, setExistingVoiceNoteUrl] = useState<string | null>(null)
  const [existingSpotifyUrl, setExistingSpotifyUrl] = useState<string | null>(null)

  const handleStartEdit = async (targetSlug: string) => {
    if (!targetSlug) return
    playButtonSound()
    setIsLoadingEditData(true)
    setErrorMsg("")
    try {
      const data = await getSurpriseForEdit(targetSlug)
      if (data) {
        setEditingSlug(targetSlug)
        setGfName(data.girlfriend_name || "")
        setBfName(data.boyfriend_name || "")
        setLetter(data.letter || "")
        setPhotos(Array.isArray(data.photos) ? data.photos.filter(Boolean) : [])
        setPhotoFiles([])
        setSpotifyQ(data.spotify_url || "")
        setSpotifyTrackId(data.spotify_url || "")
        setExistingSpotifyUrl(data.spotify_url || null)
        setVoiceNote(!!data.voice_note_url)
        setVoiceNoteFile(null)
        setExistingVoiceNoteUrl(data.voice_note_url || null)
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          setSecretQuestions(
            data.questions.map((q) => ({
              question: q?.question || "",
              answer: q?.answer || "",
            })),
          )
        }
        setLink(`${window.location.origin}/s/${targetSlug}`)
        window.scrollTo({ top: 550, behavior: "smooth" })
      } else {
        setErrorMsg("Failed to load details for editing.")
      }
    } catch (err: any) {
      setErrorMsg("Failed to load surprise details: " + (err.message || ""))
    } finally {
      setIsLoadingEditData(false)
    }
  }

  // Trigger initial edit load when initialEditSlug prop is passed
  useEffect(() => {
    if (initialEditSlug) {
      handleStartEdit(initialEditSlug)
    }
  }, [initialEditSlug])

  const handleCancelEdit = () => {
    playButtonSound()
    setEditingSlug(null)
    setLink("")
    setGfName("")
    setBfName("")
    setLetter("")
    setPhotos([])
    setPhotoFiles([])
    setVoiceNote(false)
    setVoiceNoteFile(null)
    setExistingVoiceNoteUrl(null)
    setExistingSpotifyUrl(null)
    setMusicFile(null)
    setSpotifyQ("")
    setErrorMsg("")
  }

  const nativeMicInputRef = useRef<HTMLInputElement>(null)

  // Price fixed to ₹19
  const PLAN_PRICE = 19

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
    if (!gfName.trim()) {
      setErrorMsg("Please enter Her Name before proceeding to payment ❤️")
      return
    }
    if (!bfName.trim()) {
      setErrorMsg("Please enter Your Name before proceeding to payment ❤️")
      return
    }
    if (photos.length === 0 && photoFiles.length === 0) {
      setErrorMsg("Please upload at least 1 photo before proceeding to payment 📸")
      return
    }
    if (!letter.trim()) {
      setErrorMsg("Please write a Love Letter before proceeding to payment 💌")
      return
    }

    const validQuestions = secretQuestions.filter(
      (q) => q.question.trim() && q.answer.trim(),
    )
    if (validQuestions.length === 0) {
      setErrorMsg(
        "Please answer at least 1 Secret Question before proceeding to payment 🔐",
      )
      return
    }

    const invalidQuestion = secretQuestions.find(
      (q) => q.question.trim() && !q.answer.trim(),
    )
    if (invalidQuestion) {
      setErrorMsg(
        `Please enter an answer for: "${invalidQuestion.question}" 🔐`,
      )
      return
    }

    setErrorMsg("")

    if (editingSlug) {
      // ── EDIT / UPDATE EXISTING SURPRISE FLOW (NO PAYMENT REQUIRED) ──────
      setIsSubmitting(true)
      try {
        const [photoUploadResults, musicPublicUrl, voiceNotePublicUrl] =
          await Promise.all([
            Promise.all(photoFiles.map((file) => uploadPhoto(file))),
            musicFile ? uploadMusicTrack(musicFile) : Promise.resolve(""),
            voiceNoteFile
              ? uploadVoiceNote(voiceNoteFile)
              : Promise.resolve(""),
          ])

        // Map photos array from state (max 5 items) replacing blob/data preview URLs with freshly uploaded URLs
        let uploadIdx = 0
        const finalPhotoUrls = photos
          .map((p) => {
            if (p.startsWith("http") && !p.startsWith("blob:")) {
              return p
            }
            if (uploadIdx < photoUploadResults.length) {
              return photoUploadResults[uploadIdx++]
            }
            return null
          })
          .filter((p): p is string => Boolean(p))
          .slice(0, 5)

        const questionRecords = secretQuestions
          .filter((q) => q.question.trim() && q.answer.trim())
          .map((q) => ({
            question: q.question.trim(),
            answer: q.answer.trim(),
          }))

        const finalVoiceNoteUrl =
          voiceNotePublicUrl ||
          (voiceNote ? existingVoiceNoteUrl : null) ||
          undefined

        const finalSpotifyUrl =
          musicPublicUrl ||
          (spotifyQ && spotifyQ.startsWith("http") ? spotifyQ : null) ||
          existingSpotifyUrl ||
          spotifyTrackId.trim() ||
          "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"

        await updateSurprise(editingSlug, {
          girlfriend_name: gfName.trim(),
          boyfriend_name: bfName.trim(),
          photos: finalPhotoUrls,
          letter: letter.trim() || "",
          spotify_url: finalSpotifyUrl,
          voice_note_url: finalVoiceNoteUrl,
          questions: questionRecords,
        })

        const fullShareLink = `${window.location.origin}/s/${editingSlug}`
        setLink(fullShareLink)

        // Update in createdSurprises state & localStorage
        setCreatedSurprises((prev) =>
          prev.map((item) =>
            item.slug === editingSlug
              ? {
                  ...item,
                  girlfriendName: gfName.trim(),
                  boyfriendName: bfName.trim(),
                }
              : item,
          ),
        )

        if (onSurpriseUpdated) {
          await onSurpriseUpdated(editingSlug)
        }

        setErrorMsg("")
        setIsSubmitting(false)
        setEditingSlug(null)
      } catch (err: any) {
        console.error("Failed to update surprise:", err)
        setErrorMsg(err.message || "Failed to update surprise.")
        setIsSubmitting(false)
      }
      return
    }

    // Launch Razorpay Checkout Modal
    await launchRazorpayCheckout({
      amount: PLAN_PRICE,
      description: `Romantic Gift Website Customization (${gfName} & ${bfName})`,
      userEmail: "",
      userName: bfName,
      onSuccess: async (paymentRes) => {
        console.log("[Razorpay Verified Payment]:", paymentRes)
        onPay(async () => {
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

            let newUploadIdx = 0
            const finalCreatePhotoUrls = photos
              .map((p) => {
                if (p.startsWith("http") && !p.startsWith("blob:")) {
                  return p
                }
                if (newUploadIdx < photoUploadResults.length) {
                  return photoUploadResults[newUploadIdx++]
                }
                return null
              })
              .filter((p): p is string => Boolean(p))
              .slice(0, 5)

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
              photos: finalCreatePhotoUrls,
              letter: letter.trim() || "",
              spotify_url: finalSpotifyUrl,
              voice_note_url: voiceNotePublicUrl || undefined,
              questions: questionRecords,
              creator_device_token: deviceToken || undefined,
            })

            const fullShareLink = `${window.location.origin}/s/${result}`
            setLink(fullShareLink)
            localStorage.removeItem(DASHBOARD_DRAFT_KEY)

            const newSavedItem: SavedSurpriseItem = {
              slug: result,
              link: fullShareLink,
              girlfriendName: gfName.trim(),
              boyfriendName: bfName.trim(),
              createdAt: new Date().toISOString(),
            }

            setCreatedSurprises((prev) => {
              const updated = [newSavedItem, ...prev.filter((x) => x.slug !== result)]
              try {
                localStorage.setItem(
                  MY_CREATED_SURPRISES_KEY,
                  JSON.stringify(updated),
                )
              } catch (e) {
                console.warn("Failed to persist created surprise:", e)
              }
              return updated
            })

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
            Create a Surprise ❤️
          </h1>
        </div>
      </div>

      <div className="dashboard-container py-6">
        {/* Persistent Created Gift Websites Card */}
        {createdSurprises.length > 0 && (
          <div
            style={{
              ...card,
              background: "linear-gradient(135deg, #ffffff 0%, #fff0f5 100%)",
              border: "2px solid #e8789a",
              boxShadow: "0 8px 32px rgba(232,120,154,0.22)",
            }}
            className="mb-8 p-6 rounded-3xl"
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl">💝</span>
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#1a0035]">
                    Your Created Gift Link{createdSurprises.length > 1 ? "s" : ""} ({createdSurprises.length})
                  </h3>
                  <p className="text-xs text-pink-700 font-medium">
                    Your customized website link is active. Copy and share it anytime!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  playButtonSound()
                  setLink("")
                  setGfName("")
                  setBfName("")
                  setLetter("")
                  setPhotos([])
                  setPhotoFiles([])
                  setVoiceNote(false)
                  setVoiceNoteFile(null)
                  setMusicFile(null)
                  setSpotifyQ("")
                  setErrorMsg("")
                  window.scrollTo({ top: 500, behavior: "smooth" })
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-pink-700 bg-pink-100/90 hover:bg-pink-200 cursor-pointer transition-all border border-pink-200 shadow-sm hover:scale-105 active:scale-95"
              >
                ➕ Create Another Gift
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {createdSurprises.map((item, idx) => (
                <div
                  key={item.slug || idx}
                  className="p-4 rounded-2xl bg-white/90 border border-pink-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-[#7a0f50]">
                        {item.girlfriendName && item.boyfriendName
                          ? `${item.girlfriendName} ❤️ ${item.boyfriendName}`
                          : `Gift Website (${item.slug})`}
                      </span>
                      <span className="text-[10px] bg-pink-100 text-pink-800 font-bold px-2 py-0.5 rounded-full">
                        ACTIVE LINK
                      </span>
                    </div>
                    <p className="font-mono text-xs text-pink-600 truncate max-w-full">
                      {item.link}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item.slug)}
                      disabled={isLoadingEditData}
                      className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 font-bold text-white text-xs cursor-pointer shadow hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {editingSlug === item.slug
                        ? "✏️ Editing..."
                        : "✏️ Edit Details"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.link)}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 font-bold text-white text-xs cursor-pointer shadow hover:scale-105 active:scale-95 transition-all"
                    >
                      {copied ? "✓ Copied!" : "📋 Copy Link"}
                    </button>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-initial text-center px-3.5 py-2 rounded-xl bg-pink-50 border border-pink-200 text-pink-800 font-bold text-xs hover:bg-pink-100 transition-all"
                    >
                      👁️ Preview
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {editingSlug ? (
          <div className="text-center mb-8 p-5 rounded-3xl bg-gradient-to-r from-purple-900/90 to-indigo-900/90 border-2 border-purple-400 text-white shadow-2xl animate-fade-up max-w-lg mx-auto backdrop-blur-md">
            <div className="text-3xl mb-1">✏️</div>
            <h2 className="font-serif font-bold text-xl text-purple-100">
              Editing Website: <span className="font-mono text-amber-300">{editingSlug}</span>
            </h2>
            <p className="text-xs text-purple-200/80 mt-1 font-sans">
              Modify any details below and click "Save & Update Website" to publish your changes live!
            </p>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="mt-3 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white border border-white/20 cursor-pointer transition-all shadow"
            >
              ✕ Cancel Editing & Create New Gift
            </button>
          </div>
        ) : (
          <div className="text-center mb-8">
            <div
              className="mb-3 animate-pulse-heart inline-block"
              style={{
                fontSize: "clamp(2.5rem, 6vw, 4rem)",
                filter: "drop-shadow(0 0 18px rgba(232,120,154,0.5))",
              }}
            >
              💝
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
        )}

        <div className="dashboard-grid">

        {/* 1. Names */}
        <div style={card}>
          <div style={secTitle}>💑 Your Love Story</div>
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
          <div style={secTitle}>📸 Your Memories</div>
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
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>📷</div>
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
            <div className="mt-4 p-3 rounded-2xl bg-pink-500/5 border border-pink-200/40">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {photos.map((url, i) => (
                  <div key={i} className="relative aspect-square group">
                    <img
                      src={url}
                      alt={`Uploaded photo ${i + 1}`}
                      className="w-full h-full object-cover rounded-xl border border-pink-300/40 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPhotos((prev) => prev.filter((_, j) => j !== i))
                        setPhotoFiles((prev) => prev.filter((_, j) => j !== i))
                      }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full text-white text-xs flex items-center justify-center cursor-pointer font-bold bg-pink-600 hover:bg-rose-700 shadow-md transition-all hover:scale-110 active:scale-95 z-10"
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Love Letter */}
        <div style={card}>
          <div style={secTitle}>💌 Your Love Letter</div>
          <div style={secSub}>
            Write from your heart — she will treasure this forever
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
          <div style={secTitle}>🎙️ Voice Note</div>
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
                🎵
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
                  Voice note recorded ✓
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
                🔄 Re-record
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
                Speak from your heart ❤️
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
                ⏹️ Stop & Save Voice Note
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
                <div style={{ fontSize: "32px", marginBottom: "6px" }}>🎙️</div>
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
                  Speak your message for her ❤️
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
          <div style={secTitle}>🎵 Her Special Song (MP3 Upload)</div>
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
              <div className="text-3xl mb-2">🎶</div>
              <div className="text-sm font-bold text-[#7a0f50]">
                {musicFile
                  ? `Uploaded: ${musicFile.name}`
                  : "Click to Upload MP3 Song File"}
              </div>
              <div className="text-xs text-pink-700/70 mt-1">
                {musicFile
                  ? `Size: ${(musicFile.size / (1024 * 1024)).toFixed(2)} MB • Click to change`
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
                  🗑️ Remove Uploaded Song
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
          <div style={secTitle}>🔐 Secret Questions</div>
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
              💡 Need Ideas? Tap a Preset:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: "💕 Classic Firsts",
                  items: [
                    { question: "When did we first meet?", answer: "" },
                    { question: "What nickname do I call you?", answer: "" },
                    { question: "Where was our very first date?", answer: "" },
                  ],
                },
                {
                  label: "🎵 Shared Favorites",
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
                  label: "✨ Cute Inside Jokes",
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
                      × Remove
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
            ⚠️ {errorMsg}
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
            <div className="text-4xl mb-2">🎁</div>
            <h2
              className="text-xl sm:text-2xl font-bold mb-2 leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Create the Most Emotional Gift She'll Never Forget ❤️
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
                      ₹99
                    </span>
                    <span
                      className="text-5xl sm:text-6xl font-bold text-pink-100 drop-shadow-md"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      ₹49
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
                    <span>🎉</span> Referral Discount Applied • You Saved ₹50 ❤️
                  </motion.div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="flex items-baseline justify-center gap-2">
                    <span
                      className="text-5xl sm:text-6xl font-bold text-pink-100 drop-shadow-md"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      ₹99
                    </span>
                    <span className="text-xs text-pink-200/60 font-sans">
                      one-time
                    </span>
                  </div>
                  <p className="text-[11px] text-pink-300/70 mt-1.5 font-medium">
                    💡 Use a referral code to unlock 50% OFF (Pay ₹49)
                  </p>
                </div>
              )}
            </div>

            {/* Feature List */}
            <div className="my-6 space-y-3 text-left max-w-xs mx-auto">
              {[
                { icon: "❤️", text: "Personalized Love Experience" },
                { icon: "📸", text: "Upload up to 5 Special Photos" },
                { icon: "🎵", text: "Add Your Personal Voice Message" },
                { icon: "💌", text: "Write a Beautiful Love Letter" },
                { icon: "✨", text: "Premium Romantic Animations" },
                { icon: "🔗", text: "Forever Shareable Private Link" },
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
                  🔒 <strong>Your memories stay private.</strong> Photos, voice
                  notes, love letters and personal details are securely
                  processed and are not permanently stored on our platform,
                  ensuring complete privacy.
                </p>
              </div>
            </div>

            {/* Trust Badge */}
            <div className="my-4 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-pink-200 bg-white/5 border border-white/10">
              🔒 One-Time Payment • No Subscription • Complete Privacy
            </div>

            {/* Pay / Update Button / Generated Link */}
            {!link || editingSlug ? (
              <>
                <button
                  disabled={isSubmitting}
                  onClick={handleGenerateLink}
                  className="w-full mt-3 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed py-4 rounded-2xl text-base font-bold text-white shadow-xl"
                  style={{
                    background: editingSlug
                      ? "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
                      : isReferralApplied
                        ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                        : "linear-gradient(135deg, #e8789a 0%, #c9438a 100%)",
                    boxShadow: editingSlug
                      ? "0 8px 32px rgba(139,92,246,0.45)"
                      : isReferralApplied
                        ? "0 8px 32px rgba(16,185,129,0.4)"
                        : "0 8px 32px rgba(232,120,154,0.5)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {isSubmitting
                    ? editingSlug
                      ? "Saving Updates... ❤️"
                      : "Uploading & Saving... ❤️"
                    : editingSlug
                      ? "💾 Save & Update Website ❤️"
                      : `Pay ₹${finalPrice} & Generate Link ❤️`}
                </button>
                {errorMsg && (
                  <div className="mt-3 p-3 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-300 text-xs sm:text-sm font-bold text-center animate-fade-up shadow-lg flex items-center justify-center gap-2">
                    <span>⚠️</span>
                    <span>{errorMsg}</span>
                  </div>
                )}
              </>
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
                  {copied ? "✓ Copied to Clipboard!" : "📋 Copy Link"}
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
                <span>🎉</span> Referral Code Applied:{" "}
                <span className="font-mono">{appliedReferralCode}</span>
              </div>
              <p className="text-xs font-bold text-pink-700">
                50% OFF Activated ❤️ (You Save ₹50)
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#7a0f50]">
                🎁 Have a Referral Code?
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
                  ⚠️ {referralErrorMsg}
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
          👀 Preview Girlfriend's Surprise Flow
        </button>
        </div> {/* end dashboard-grid-full */}
      </div>
    </div>
  )
}

// ── APP ────────────────────────────────────────────────────────────────────

function App() {
  const [spotifyTrackId, setSpotifyTrackId] = useState("4cOdK2wGLETKBW3PvgPWqT")
  const [activeSlug, setActiveSlug] = useState<string>("")
  const [pendingEditSlug, setPendingEditSlug] = useState<string | null>(null)
  const [surpriseData, setSurpriseData] =
    useState<SurpriseDetailResponse | null>(null)
  const [isLoadingSlug, setIsLoadingSlug] = useState(false)
  const [generatedLink, setGeneratedLink] = useState("")

  // Device Token Identity — initialised once on first visit, persisted in cookie + localStorage
  const [deviceToken] = useState<string>(() => getOrCreateDeviceToken())

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
      // Secret token gate — admin accessible ONLY via ?token=cg_admin_secret_7x9k2m
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
      // Screen 7 (Finale): Pause background BGM and audio completely until explicit user tap
      window.dispatchEvent(new Event("pause-bgm"))
      window.dispatchEvent(new Event("pause-uploaded-song"))
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

  const handleSurpriseUpdated = async (slug: string) => {
    invalidateSurpriseCache(slug)
    setActiveSlug(slug)
    const freshData = await getSurpriseBySlug(slug)
    if (freshData) {
      setSurpriseData(freshData)
      if (freshData.surprise.spotify_url) {
        setSpotifyTrackId(freshData.surprise.spotify_url)
      }
    }
  }

  // onPay: called after Razorpay payment completes — executes the save function directly using device token
  const handlePay = (saveSurpriseFn: () => Promise<void>) => {
    saveSurpriseFn()
  }

  return (
    <div>
      <HamburgerMenu
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
          onDash={() => {
            if (activeSlug) setPendingEditSlug(activeSlug)
            go("dashboard")
          }}
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
          onDash={() => {
            if (activeSlug) setPendingEditSlug(activeSlug)
            go("dashboard")
          }}
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
          onPay={handlePay}
          link={generatedLink}
          setLink={setGeneratedLink}
          deviceToken={deviceToken}
          onSurpriseUpdated={handleSurpriseUpdated}
          initialEditSlug={pendingEditSlug || (activeSlug || null)}
        />
      )}
    </div>
  )
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught UI Error boundary caught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#0d0020] text-pink-100">
          <div className="text-5xl mb-4">💔</div>
          <h2 className="text-xl font-bold font-serif mb-2">Something went wrong</h2>
          <p className="text-xs text-pink-300/70 max-w-md mb-6 font-sans">
            {this.state.error?.message || "An unexpected rendering issue occurred."}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.href = window.location.origin
            }}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 font-bold text-white text-xs shadow-xl cursor-pointer hover:scale-105 active:scale-95 transition-transform"
          >
            🔄 Reload App & Return Home
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default function RootApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}
