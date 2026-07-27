import { useState, useEffect, useRef, useCallback } from "react"
import { uploadPhoto, uploadVoiceNote } from "./lib/storage"
import {
  createSurprise,
  getSurpriseBySlug,
  verifyQuestions,
} from "./lib/surpriseService"
import type { SurpriseDetailResponse, PublicQuestion } from "./types/database"

type Screen = 1 | 2 | 3 | 4 | 5 | 6 | 7 | "dashboard"

// ── CONSTANTS ──────────────────────────────────────────────────────────────

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

function FloatingHearts({ n = 20 }: { n?: number }) {
  const items = useRef(
    Array.from({ length: n }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      sz: Math.random() * 18 + 9,
      delay: Math.random() * 14,
      dur: Math.random() * 9 + 7,
      op: Math.random() * 0.38 + 0.08,
    })),
  ).current

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((h) => (
        <div
          key={h.id}
          className="absolute animate-float-heart select-none"
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

function Sparkles({ n = 24 }: { n?: number }) {
  const items = useRef(
    Array.from({ length: n }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      sz: Math.random() * 5 + 2,
      delay: Math.random() * 5,
      dur: Math.random() * 2 + 1.4,
    })),
  ).current

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full animate-sparkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.sz}px`,
            height: `${s.sz}px`,
            background:
              "radial-gradient(circle, rgba(255,255,255,0.96) 0%, rgba(255,200,220,0.65) 55%, transparent 100%)",
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

    const events = ["pointerdown", "touchstart", "click", "keydown", "scroll", "mousemove"]
    events.forEach((evt) =>
      window.addEventListener(evt, handleGesture, { passive: true }),
    )

    return () => {
      audio.pause()
      events.forEach((evt) => window.removeEventListener(evt, handleGesture))
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
      } px-8 py-4 rounded-full font-medium text-base transition-all duration-300 ${
        disabled ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.04] active:scale-[0.97] cursor-pointer"
      } select-none ${
        !outline && !disabled ? "animate-btn-glow" : ""
      }`}
      style={
        outline
          ? {
              border: "1.5px solid rgba(232,120,154,0.38)",
              color: "#ffc8d6",
              background: "transparent",
              fontFamily: "'DM Sans', sans-serif",
            }
          : {
              background:
                "linear-gradient(135deg, #e8789a 0%, #c9438a 60%, #9e2070 100%)",
              boxShadow:
                "0 6px 24px rgba(232,120,154,0.5), 0 0 55px rgba(200,67,138,0.18)",
              color: "white",
              fontFamily: "'DM Sans', sans-serif",
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
  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{ ...DARK_BG, minHeight: "100dvh" }}
    >
      <FloatingHearts n={30} />
      <Sparkles n={36} />
      <GlowOrbs />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-xs mx-auto animate-fade-up">
        <div
          className="mb-8 text-8xl animate-pulse-heart"
          style={{
            filter:
              "drop-shadow(0 0 32px rgba(255,80,140,0.85)) drop-shadow(0 0 75px rgba(255,80,140,0.45))",
          }}
        >
          ❤️
        </div>

        <h1
          className="text-[2rem] font-bold text-white mb-4 leading-tight"
          style={{
            fontFamily: "'Playfair Display', serif",
            textShadow: "0 0 40px rgba(255,180,200,0.55)",
          }}
        >
          {girlfriendName
            ? `${girlfriendName}, someone who loves you has prepared something special...`
            : "Someone who loves you has prepared something special..."}
        </h1>

        <p
          className="text-pink-200 text-base mb-10 opacity-75"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          A surprise is waiting just for you.
        </p>

        <Btn onClick={onNext}>Unlock ❤️</Btn>

        <p
          className="mt-14 text-xs"
          style={{
            color: "rgba(255,180,200,0.28)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Made with love.
        </p>
      </div>

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
    "Finding your surprise",
    "Verifying relationship",
    "Unlocking memories",
    "Preparing something special",
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

      <div className="relative z-10 flex flex-col items-center max-w-xs w-full animate-fade-up">
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
                {checks.has(i) ? "✓" : ""}
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

      <div className="relative z-10 max-w-xs w-full animate-fade-up">
        <Glass className="p-8 text-center">
          <div className="text-6xl mb-5">🔒</div>
          <h2
            className="text-2xl font-bold text-white mb-4 leading-snug"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Only the real girlfriend can unlock this secret.
          </h2>
          <p
            className="text-sm mb-8"
            style={{
              color: "rgba(255,200,220,0.65)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            This surprise was made just for you, with love. Are you ready?
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
        className="relative z-10 max-w-xs w-full animate-fade-up"
      >
        <Glass className="p-8">
          <h2
            className="text-2xl font-bold text-white mb-1 text-center"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Prove your love ❤️
          </h2>
          <p
            className="text-xs text-center mb-8"
            style={{
              color: "rgba(255,200,220,0.5)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Answer to unlock your surprise
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

      <div className="relative z-10 flex flex-col items-center text-center max-w-xs mx-auto animate-fade-up">
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
          className="text-3xl font-bold text-white mb-4 leading-tight"
          style={{
            fontFamily: "'Playfair Display', serif",
            textShadow: "0 0 40px rgba(255,180,200,0.6)",
          }}
        >
          Your gift is ready to open...
        </h2>

        <p
          className="text-base mb-10"
          style={{
            color: "rgba(255,200,220,0.7)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Something magical awaits you
        </p>

        <Btn onClick={onNext}>Open Gift ❤️</Btn>
      </div>
    </div>
  )
}

// ── SCREEN 6 — SUSPENSE ────────────────────────────────────────────────────

function S6({
  onNext,
  bgPhoto,
}: {
  onNext: () => void
  bgPhoto?: string
}) {
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

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-xs mx-auto animate-fade-up">
        <div className="text-7xl mb-6 animate-pulse-heart">🌹</div>
        <h2
          className="text-3xl font-bold text-white mb-4 leading-snug"
          style={{
            fontFamily: "'Playfair Display', serif",
            textShadow: "0 0 44px rgba(255,180,200,0.7)",
          }}
        >
          One last step...
        </h2>
        <p
          className="text-base mb-10"
          style={{
            color: "rgba(255,200,220,0.72)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Your complete surprise is about to be revealed
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

function SpotifyPlayer({
  trackId = "4cOdK2wGLETKBW3PvgPWqT",
}: {
  trackId?: string
}) {
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
        }}
      />
    </div>
  )
}

function Slideshow({ photos }: { photos?: string[] }) {
  const photoList = photos && photos.length > 0 ? photos : DEFAULT_PHOTOS
  const [active, setActive] = useState(0)

  return (
    <div className="mb-8">
      <p
        className="text-xs text-center mb-4"
        style={{
          color: "rgba(255,200,220,0.45)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Our Memories ✨
      </p>

      <div className="relative h-72 mb-5">
        {photoList.map((photo, i) => {
          const d = i - active
          let tx = "0px",
            sc = "0.55",
            op = 0,
            z = 0,
            rot = "0deg"
          if (d === 0) {
            tx = "0px"
            sc = "1"
            op = 1
            z = 10
            rot = "0deg"
          } else if (d === -1) {
            tx = "-78%"
            sc = "0.8"
            op = 0.48
            z = 5
            rot = "-8deg"
          } else if (d === 1) {
            tx = "78%"
            sc = "0.8"
            op = 0.48
            z = 5
            rot = "8deg"
          } else {
            op = 0
            z = 0
          }

          return (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out"
              style={{
                transform: `translateX(${tx}) scale(${sc}) rotate(${rot})`,
                opacity: op,
                zIndex: z,
              }}
              onClick={() => {
                if (d === 1) setActive(i)
                else if (d === -1) setActive(i)
              }}
            >
              <div
                className="bg-white p-3 pb-10"
                style={{
                  borderRadius: "3px",
                  boxShadow:
                    "0 22px 65px rgba(0,0,0,0.55), 0 4px 18px rgba(232,120,154,0.28)",
                  maxWidth: "224px",
                  width: "100%",
                }}
              >
                <img
                  src={photo}
                  alt=""
                  className="w-full h-56 object-cover rounded-sm mb-2"
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center gap-2">
        {photoList.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className="w-2.5 h-2.5 rounded-full transition-all duration-300 cursor-pointer"
            style={{
              background:
                active === i ? "#e8789a" : "rgba(255,255,255,0.18)",
              transform: active === i ? "scale(1.3)" : "scale(1)",
            }}
          />
        ))}
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
    <div ref={ref} className="mb-8">
      <Glass className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">💌</span>
          <span
            className="text-white text-sm font-semibold"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            A Letter From His Heart
          </span>
        </div>
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{
            color: "rgba(255,210,225,0.9)",
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            minHeight: "100px",
          }}
        >
          {text}
          {pos.current < content.length && (
            <span className="inline-block w-0.5 h-3.5 ml-0.5 rounded-full animate-blink-cursor align-text-bottom bg-pink-400" />
          )}
        </div>
      </Glass>
    </div>
  )
}

function VoiceNote({ voiceNoteUrl }: { voiceNoteUrl?: string }) {
  const [play, setPlay] = useState(false)
  const [prog, setProg] = useState(0)
  const audioObjRef = useRef<HTMLAudioElement | null>(null)
  const bars = useRef(
    Array.from({ length: 32 }, () => Math.random() * 26 + 6),
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
      if (audio) {
        audio.play().catch(() => setPlay(false))
      } else {
        const t = setInterval(() => {
          setProg((p) => {
            if (p >= 100) {
              setPlay(false)
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
    <div className="mb-8">
      <Glass className="p-6">
        <p
          className="text-center text-sm mb-5"
          style={{
            color: "rgba(255,200,220,0.62)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          A message from his heart ❤️
        </p>

        <div className="flex justify-center mb-5">
          <button
            onClick={() => setPlay((p) => !p)}
            className="relative w-20 h-20 cursor-pointer hover:scale-105 transition-transform duration-200"
          >
            <svg viewBox="0 0 100 90" className="w-full h-full">
              <defs>
                <linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e8789a" />
                  <stop offset="100%" stopColor="#c9438a" />
                </linearGradient>
                <clipPath id="hc">
                  <path d="M50 85C50 85 5 55 5 28C5 14 14 5 28 5C36 5 44 9 50 16C56 9 64 5 72 5C86 5 95 14 95 28C95 55 50 85 50 85Z" />
                </clipPath>
              </defs>
              <path
                d="M50 85C50 85 5 55 5 28C5 14 14 5 28 5C36 5 44 9 50 16C56 9 64 5 72 5C86 5 95 14 95 28C95 55 50 85 50 85Z"
                fill="url(#hg)"
                style={{
                  filter: "drop-shadow(0 0 20px rgba(232,120,154,0.75))",
                }}
              />
              <image
                href="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&auto=format"
                x="5"
                y="5"
                width="90"
                height="80"
                clipPath="url(#hc)"
                preserveAspectRatio="xMidYMid slice"
              />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-px justify-center h-10 mb-3">
          {bars.map((h, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: "3px",
                height: play ? `${h}px` : "3px",
                background:
                  "linear-gradient(to top, rgba(232,120,154,0.5), rgba(255,200,220,0.92))",
                animation: play
                  ? `waveform-bar ${0.32 + (i % 7) * 0.07}s ease-in-out ${i * 0.018}s infinite alternate`
                  : "none",
                transition: "height 0.28s ease",
              }}
            />
          ))}
        </div>

        <div
          className="h-1 rounded-full overflow-hidden mb-5"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${prog}%`,
              background: "linear-gradient(90deg, #e8789a, #c9438a)",
              transition: "width 0.08s linear",
            }}
          />
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => setPlay((p) => !p)}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #e8789a, #c9438a)",
              boxShadow: "0 4px 22px rgba(232,120,154,0.65)",
            }}
          >
            {play ? "⏸" : "▶"}
          </button>
        </div>
      </Glass>
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
  return (
    <div
      className="relative overflow-hidden"
      style={{ ...DARK_BG, minHeight: "100dvh" }}
    >
      <Confetti />
      <FloatingHearts n={25} />
      <Sparkles n={35} />
      <GlowOrbs />

      <div className="relative z-10 max-w-sm mx-auto px-4 py-10">
        <SpotifyPlayer trackId={trackId} />
        <Slideshow photos={photos} />
        <LoveLetter letter={letter} />
        <VoiceNote voiceNoteUrl={voiceNoteUrl} />

        {/* Grand Finale */}
        <div className="text-center py-10">
          <div className="text-6xl mb-5 animate-pulse-heart">❤️</div>
          <h1
            className="font-bold text-white mb-3 leading-tight"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(2rem, 8vw, 2.6rem)",
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
            Made with endless love, just for you.
          </p>

          <div className="flex flex-col gap-4">
            <Btn onClick={onReplay} full>
              🔄 Replay Surprise
            </Btn>
            <Btn onClick={onDash} full outline>
              Create One For Your Girlfriend ❤️
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────

function Dashboard({
  onBack,
  spotifyTrackId,
  setSpotifyTrackId,
}: {
  onBack: () => void
  spotifyTrackId: string
  setSpotifyTrackId: (id: string) => void
}) {
  const [gfName, setGfName] = useState("")
  const [bfName, setBfName] = useState("")
  const [photos, setPhotos] = useState<string[]>([])
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [letter, setLetter] = useState("")
  const [voiceNote, setVoiceNote] = useState(false)
  const [voiceNoteFile, setVoiceNoteFile] = useState<File | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<any>(null)

  const nativeMicInputRef = useRef<HTMLInputElement>(null)

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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

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
          const ext = mime.includes("mp4") || mime.includes("aac")
            ? "m4a"
            : mime.includes("ogg")
            ? "ogg"
            : "webm"
          const file = new File(
            [audioBlob],
            `voice_note_${Date.now()}.${ext}`,
            { type: mime }
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
        console.warn("In-app mic recorder failed, triggering mobile native voice recorder:", err)
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

  const [spotifyQ, setSpotifyQ] = useState("")
  const [secretQuestions, setSecretQuestions] = useState([
    { question: "When did we first meet?", answer: "" },
    { question: "What nickname do I call you?", answer: "" },
    { question: "What is our favorite memory together?", answer: "" },
  ])
  const [link, setLink] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  const addPhotos = (files: FileList | null) => {
    if (!files) return
    const newFiles = Array.from(files).slice(0, 5 - photos.length)
    setPhotoFiles((prev) => [...prev, ...newFiles])
    newFiles.forEach((f) => {
      const url = URL.createObjectURL(f)
      setPhotos((prev) => [...prev, url])
    })
  }

  const handleGenerateLink = async () => {
    if (!gfName.trim() || !bfName.trim()) {
      setErrorMsg("Please enter both Girlfriend and Boyfriend names ❤️")
      return
    }

    setIsSubmitting(true)
    setErrorMsg("")

    try {
      // 1. Upload Photos to Supabase Storage
      const uploadedPhotoUrls: string[] = []
      for (const file of photoFiles) {
        const publicUrl = await uploadPhoto(file)
        uploadedPhotoUrls.push(publicUrl)
      }

      // If user provided photos via preview but no new files, include pre-existing URLs
      if (uploadedPhotoUrls.length === 0 && photos.length > 0) {
        uploadedPhotoUrls.push(...photos.filter((p) => p.startsWith("http")))
      }

      // 2. Upload Voice Note to Supabase Storage if provided
      let voiceNotePublicUrl = ""
      if (voiceNoteFile) {
        voiceNotePublicUrl = await uploadVoiceNote(voiceNoteFile)
      }

      // 3. Prepare Questions & Answers
      const questionRecords = secretQuestions
        .filter((q) => q.question.trim() && q.answer.trim())
        .map((q) => ({
          question: q.question.trim(),
          answer: q.answer.trim(),
        }))

      // 4. Save Surprise to Supabase Database
      const finalSpotifyUrl =
        spotifyQ.trim() ||
        `https://open.spotify.com/track/${spotifyTrackId}`

      let slug = ""
      try {
        slug = await createSurprise({
          boyfriend_name: bfName.trim(),
          girlfriend_name: gfName.trim(),
          letter: letter.trim(),
          spotify_url: finalSpotifyUrl,
          voice_note_url: voiceNotePublicUrl || undefined,
          photos: uploadedPhotoUrls,
          questions: questionRecords,
        })
      } catch (dbErr) {
        console.warn("Supabase insert error (falling back to demo slug):", dbErr)
        // If DB tables aren't created yet in user's Supabase dashboard, generate a local working demo slug
        slug = Math.random().toString(36).substring(2, 10).toUpperCase()
        setErrorMsg("Note: Database table not ready yet. Created local link preview. Please run schema.sql in Supabase SQL editor!")
      }

      const host = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1")
        ? "http://localhost:8443"
        : window.location.origin
      const generatedUrl = `${host}/?s=${slug}`
      setLink(generatedUrl)
    } catch (err) {
      console.error("Error creating surprise:", err)
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to generate surprise link",
      )
    } finally {
      setIsSubmitting(false)
    }
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
    padding: "22px",
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
    fontSize: "14px",
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
    fontSize: "19px",
    fontWeight: "700",
    color: "#1a0035",
    marginBottom: "3px",
  }

  const secSub: React.CSSProperties = {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "13px",
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
        <div className="max-w-sm mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="cursor-pointer transition-opacity hover:opacity-60 text-sm flex items-center gap-1 font-semibold"
            style={{ color: "#7a0f50", fontFamily: "'DM Sans', sans-serif" }}
          >
            ← Back
          </button>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "18px",
              fontWeight: "700",
              color: "#1a0035",
            }}
          >
            Create a Surprise ❤️
          </h1>
          <div className="w-14" />
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <div
            className="text-5xl mb-3 animate-pulse-heart inline-block"
            style={{ filter: "drop-shadow(0 0 18px rgba(232,120,154,0.5))" }}
          >
            💝
          </div>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "22px",
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
              fontSize: "13px",
              color: "#7a0f50",
              fontWeight: "500",
            }}
          >
            A luxury digital gift made with love
          </p>
        </div>

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
                    ×
                  </button>
                </div>
              ))}
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
          <div style={secSub}>Directly record your voice or upload an audio file</div>

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
                  background: "linear-gradient(135deg, #e8789a 0%, #c9438a 100%)",
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
                capture="microphone"
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

        {/* 5. Spotify Link */}
        <div style={card}>
          <div style={secTitle}>🎵 Her Special Song</div>
          <div style={secSub}>
            Paste ANY Spotify song link or select a romantic favorite
          </div>

          <div className="space-y-3">
            <div>
              <label style={lbl}>Spotify Song Link</label>
              <input
                style={inp}
                value={spotifyQ}
                onChange={(e) => {
                  playTypeSound()
                  const val = e.target.value
                  setSpotifyQ(val)
                  const extracted = extractSpotifyTrackId(val)
                  if (extracted) setSpotifyTrackId(extracted)
                }}
                placeholder="https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"
                onFocus={focusInp}
                onBlur={blurInp}
              />
            </div>

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
                Live Spotify Preview:
              </p>
              <div
                className="rounded-2xl overflow-hidden shadow-sm"
                style={{ border: "1px solid rgba(200,67,138,0.2)" }}
              >
                <iframe
                  src={`https://open.spotify.com/embed/track/${extractSpotifyTrackId(spotifyQ || spotifyTrackId)}?utm_source=generator&theme=0`}
                  width="100%"
                  height="152"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="w-full rounded-2xl"
                />
              </div>
            </div>

            <div>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "11px",
                  color: "#7a0f50",
                  fontWeight: "600",
                  marginTop: "10px",
                  marginBottom: "6px",
                }}
              >
                Or Select Romantic Favorites:
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    title: "Perfect - Ed Sheeran",
                    id: "4cOdK2wGLETKBW3PvgPWqT",
                  },
                  {
                    title: "All of Me - John Legend",
                    id: "3U4isOIWM3VvDubwSI3y7a",
                  },
                  { title: "A Thousand Years", id: "6RUKwULelqY2FmRUt5K3wE" },
                  { title: "Die With A Smile", id: "2plbrEY59IikOBgBGLjaoe" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      playButtonSound()
                      setSpotifyTrackId(s.id)
                      setSpotifyQ(`https://open.spotify.com/track/${s.id}`)
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-200"
                    style={{
                      background:
                        extractSpotifyTrackId(spotifyQ || spotifyTrackId) ===
                        s.id
                          ? "#c9438a"
                          : "rgba(255,240,246,0.9)",
                      color:
                        extractSpotifyTrackId(spotifyQ || spotifyTrackId) ===
                        s.id
                          ? "#ffffff"
                          : "#7a0f50",
                      border: "1px solid rgba(200,67,138,0.2)",
                    }}
                  >
                    🎵 {s.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 6. Secret Questions */}
        <div style={card}>
          <div style={secTitle}>🔐 Secret Questions</div>
          <div style={secSub}>
            Customize the questions and exact answers she must reply to unlock the surprise
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
                    { question: "What is our special couple song?", answer: "" },
                    { question: "What food did we order on our first date?", answer: "" },
                    { question: "Where is our dream vacation spot?", answer: "" },
                  ],
                },
                {
                  label: "✨ Cute Inside Jokes",
                  items: [
                    { question: "What color dress were you wearing on our first date?", answer: "" },
                    { question: "What secret word always makes us laugh?", answer: "" },
                    { question: "What is our favorite movie to rewatch together?", answer: "" },
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
                          prev.filter((_, idx) => idx !== i)
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

        {/* Error notification if any */}
        {errorMsg && (
          <p
            className="mb-4 text-center text-sm font-semibold animate-fade-up"
            style={{ color: "#d91f54", fontFamily: "'DM Sans', sans-serif" }}
          >
            ⚠️ {errorMsg}
          </p>
        )}

        {/* 7. Save & Generate Link */}
        <div
          style={{
            borderRadius: "24px",
            padding: "28px 22px",
            marginBottom: "16px",
            background: "linear-gradient(135deg, #1a0035 0%, #2e0055 100%)",
            boxShadow: "0 12px 50px rgba(200,67,138,0.25)",
          }}
        >
          <div className="text-center text-white">
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>✨</div>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "22px",
                fontWeight: "700",
                marginBottom: "5px",
              }}
            >
              Ready to surprise her?
            </div>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                opacity: 0.6,
                marginBottom: "20px",
              }}
            >
              One-time setup to generate your exclusive dynamic link
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                gap: "8px",
                marginBottom: "22px",
              }}
            >
              <span
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "44px",
                  fontWeight: "700",
                  color: "#ffc8d6",
                }}
              >
                ₹49
              </span>
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  color: "rgba(255,200,220,0.5)",
                }}
              >
                one-time
              </span>
            </div>

            <div style={{ marginBottom: "24px", textAlign: "left" }}>
              {[
                "Personalized gift experience",
                "Unlimited views for her",
                "Forever shareable link",
                "Premium animations included",
              ].map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ color: "#ffc8d6", fontSize: "14px" }}>✓</span>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "13px",
                      color: "rgba(255,210,228,0.78)",
                    }}
                  >
                    {f}
                  </span>
                </div>
              ))}
            </div>

            {!link ? (
              <button
                disabled={isSubmitting}
                onClick={handleGenerateLink}
                className="w-full cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  background:
                    "linear-gradient(135deg, #e8789a 0%, #c9438a 100%)",
                  boxShadow: "0 8px 32px rgba(232,120,154,0.5)",
                  color: "white",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "15px",
                  fontWeight: "600",
                  border: "none",
                }}
              >
                {isSubmitting
                  ? "Uploading & Saving... ❤️"
                  : "Pay ₹49 & Generate Link ❤️"}
              </button>
            ) : (
              <div>
                <div
                  onClick={() => copyToClipboard(link)}
                  className="cursor-pointer transition-all duration-200 hover:bg-white/10"
                  style={{
                    borderRadius: "16px",
                    padding: "16px",
                    marginBottom: "12px",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.13)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "11px",
                      color: "rgba(255,200,220,0.6)",
                      marginBottom: "6px",
                    }}
                  >
                    Your exclusive surprise link (tap to copy):
                  </p>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "13px",
                      color: "#ffc8d6",
                      wordBreak: "break-all",
                      fontWeight: "500",
                    }}
                  >
                    {link}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(link)}
                  className="w-full cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    padding: "13px",
                    borderRadius: "14px",
                    border: copied
                      ? "1.5px solid #22c55e"
                      : "1.5px solid rgba(255,200,220,0.28)",
                    background: copied ? "rgba(34,197,94,0.15)" : "transparent",
                    color: copied ? "#4ade80" : "#ffc8d6",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  {copied ? "✓ Copied to Clipboard!" : "📋 Copy Link"}
                </button>
              </div>
            )}
          </div>
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
      </div>
    </div>
  )
}

// ── APP ────────────────────────────────────────────────────────────────────

export default function App() {
  const [spotifyTrackId, setSpotifyTrackId] = useState("4cOdK2wGLETKBW3PvgPWqT")
  const [activeSlug, setActiveSlug] = useState<string>("")
  const [surpriseData, setSurpriseData] = useState<SurpriseDetailResponse | null>(null)
  const [isLoadingSlug, setIsLoadingSlug] = useState(false)

  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window !== "undefined") {
      const search = window.location.search
      const path = window.location.pathname
      const hasSurpriseParam =
        search.includes("s=") || search.includes("surprise=") || path.includes("/s/")
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

    if (!slug && window.location.pathname.includes("/s/")) {
      slug = window.location.pathname.split("/s/")[1]?.split("?")[0] || ""
    }

    if (slug) {
      setActiveSlug(slug)
      setIsLoadingSlug(true)
      getSurpriseBySlug(slug)
        .then((data) => {
          if (data) {
            setSurpriseData(data)
            if (data.surprise.spotify_url) {
              setSpotifyTrackId(extractSpotifyTrackId(data.surprise.spotify_url))
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

  return (
    <div>
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
        />
      )}
    </div>
  )
}
