"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type Note = {
  id: string
  x: number
  y: number
  text: string
  color: string
  createdAt: number
  lifetimeMs: number
}

const DURATION_MS = 60_000

// Swap these to your real files when you add assets.
// You can use .mp4/.webm for video, or .gif/.jpg/.png images.
// The media component adapts automatically based on extension.
const SERENE_SRC = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Train_Passing_Scenery_Loop-epsE2fa00kJeWNstkD96eMCMdFGSeF.mp4"
const RUINS_SRC = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Anime_Loss_Destruction_View-ftmpchoxfzjsEWEdYPpWQ1xKGQHlvG.mp4"

const STORAGE_KEYS = {
  startedAt: "borrowed-time:startedAt",
  expired: "borrowed-time:expired",
  endedAt: "borrowed-time:endedAt",
}

const POETIC_LINES = [
  "A hush gathers on the edge of light.",
  "Leaves carry secrets in their veins.",
  "Waves write letters no shore can keep.",
  "The wind braids memory into branches.",
  "Footsteps soften the ribs of the earth.",
  "Time dissolves like salt on the tongue.",
  "Clouds unspool thread from the horizon.",
  "Silence blooms where names fade.",
  "The sun rehearses its slow confession.",
  "Stones remember our weight kindly.",
  "Shadows drink the last of the dawn.",
  "A gull stitches sky to water.",
  "Distant hills wear the day’s first fire.",
  "Your breath is a tide, arriving, leaving.",
  "Moss keeps the minutes in green.",
  "Here, even endings learn to listen.",
  "Light loosens the knots of night.",
  "Every ripple is a word for 'almost'.",
  "We live between two open hands.",
  "What you touch touches you back.",
  "The path forgets where it started.",
  "A petal perfects its fall.",
  "Sky leans in to hear the ocean.",
  "Roots map the rumor of rain.",
  "Softly, the world turns toward you.",
  "Your quiet is a harbor.",
  "The moment is a cup, drink slowly.",
  "Ash remembers the shape of flame.",
  "The horizon practices return.",
  "Stay, and let the stillness move.",
]

function formatSeconds(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${s}s`
}

export default function BorrowedTime() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [secondChance, setSecondChance] = useState(false)
  const [isExpired, setIsExpired] = useState<boolean | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(DURATION_MS)
  const [notes, setNotes] = useState<Note[]>([])
  const [introVisible, setIntroVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)
  const linesIndex = useRef(0)
  const reducedMotion = usePrefersReducedMotion()

  // Boot/persist logic
  useEffect(() => {
    if (typeof window === "undefined") return

    const expired = localStorage.getItem(STORAGE_KEYS.expired) === "true"
    if (expired) {
      setIsExpired(true)
      setIntroVisible(false)
      setTimeLeft(0)
      return
    }

    const savedStart = Number(localStorage.getItem(STORAGE_KEYS.startedAt) || 0)
    const now = Date.now()

    if (!savedStart) {
      localStorage.setItem(STORAGE_KEYS.startedAt, String(now))
      setIsExpired(false)
      setTimeLeft(DURATION_MS)
    } else {
      const elapsed = now - savedStart
      if (elapsed >= DURATION_MS) {
        localStorage.setItem(STORAGE_KEYS.expired, "true")
        localStorage.setItem(STORAGE_KEYS.endedAt, String(now))
        setIsExpired(true)
        setIntroVisible(false)
        setTimeLeft(0)
      } else {
        setIsExpired(false)
        setTimeLeft(DURATION_MS - elapsed)
      }
    }

    const introTimer = window.setTimeout(() => setIntroVisible(false), 2600)
    return () => window.clearTimeout(introTimer)
  }, [])

  // Countdown tick
  useEffect(() => {
    if (isExpired !== false) return
    let raf: number | null = null
    const start = performance.now()
    const baseLeft = timeLeft

    const step = (now: number) => {
      const delta = now - start
      const newLeft = baseLeft - delta
      if (newLeft <= 0) {
        setTimeLeft(0)
        endExperience()
        return
      }
      setTimeLeft(newLeft)
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpired])

  const endExperience = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.expired, "true")
      localStorage.setItem(STORAGE_KEYS.endedAt, String(Date.now()))
    }
    // Fade to black then reveal ruins
    setFadeOut(true)
    setTimeout(
      () => {
        setIsExpired(true)
        setFadeOut(false)
      },
      reducedMotion ? 0 : 1800,
    )
  }

  function resetExperience() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEYS.expired)
      localStorage.removeItem(STORAGE_KEYS.endedAt)
      localStorage.setItem(STORAGE_KEYS.startedAt, String(Date.now()))
    }
    // Reset local state
    setNotes([])
    setFadeOut(false)
    setTimeLeft(DURATION_MS)
    setIsExpired(false)
    setIntroVisible(true)
    linesIndex.current = 0
    // Hide intro after a moment (like on mount)
    window.setTimeout(() => setIntroVisible(false), 2600)
  }

  function handleSecretReset() {
    // Show loading overlay
    setSecondChance(true)
    // Give a brief "loading" feel, then reset and hide overlay
    window.setTimeout(() => {
      resetExperience()
      window.setTimeout(() => setSecondChance(false), 900)
    }, 1200)
  }

  const serene = isExpired === false
  const ruins = isExpired === true

  const onSceneClick = (e: React.MouseEvent) => {
    if (!serene) return
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const text = POETIC_LINES[linesIndex.current % POETIC_LINES.length]
    linesIndex.current += 1

    const colors = ["#111111", "#262626", "#3f3f46", "#14532d", "#1f2937", "#374151"]
    const color = colors[Math.floor(Math.random() * colors.length)]

    const note: Note = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      x,
      y,
      text,
      color,
      createdAt: Date.now(),
      lifetimeMs: reducedMotion ? 2000 : 5000,
    }

    setNotes((prev) => {
      const next = [...prev, note]
      // Limit on-screen notes to avoid clutter
      if (next.length > 12) next.shift()
      return next
    })

    // Clean up note after its lifetime
    window.setTimeout(() => {
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
    }, note.lifetimeMs + 100)
  }

  const lastNoteText = notes.length ? notes[notes.length - 1].text : ""

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-dvh overflow-hidden bg-black"
      onClick={onSceneClick}
      aria-label="Borrowed Time experience"
    >
      {/* Scene layer */}
      <SceneMedia src={serene ? SERENE_SRC : RUINS_SRC} serene={serene} ruins={ruins} reducedMotion={reducedMotion} />

      {/* Subtle gradient overlay for legibility */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_70%,rgba(0,0,0,0.65)_100%)]"
        aria-hidden="true"
      />

      {/* Top UI: Timer or Final message */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
        <div className="flex flex-col gap-1 text-white/80">
          {serene && (
            <div className="rounded-full bg-black/30 backdrop-blur px-3 py-1 text-xs sm:text-sm font-medium tracking-wide">
              {"Time left: "}
              {formatSeconds(timeLeft)}
            </div>
          )}
          <span className="sr-only" aria-live="polite">
            {serene ? `Time left ${formatSeconds(timeLeft)}` : "Time expired"}
          </span>
        </div>
        <div className="text-right text-white/70 text-xs sm:text-sm">
          {serene ? (
            <span className="rounded-full bg-black/30 backdrop-blur px-3 py-1">{"Click or tap to reveal lines"}</span>
          ) : (
            <span className="rounded-full bg-black/30 backdrop-blur px-3 py-1">{"Your time here has passed."}</span>
          )}
        </div>
      </div>

      {/* Intro line */}
      {serene && introVisible && (
        <FadeInOut className="absolute inset-x-0 top-1/4 flex justify-center">
          <div className="mx-4 max-w-2xl rounded-2xl bg-black/30 px-4 sm:px-6 py-3 sm:py-4 backdrop-blur">
            <p className="text-center text-white text-base sm:text-lg md:text-xl font-medium">
              {"You have 60 seconds with this world."}
            </p>
          </div>
        </FadeInOut>
      )}

      {/* Click notes */}
      {notes.map((n) => (
        <FloatingNote key={n.id} note={n} reducedMotion={reducedMotion} />
      ))}

      {/* End fade to black */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-black transition-opacity duration-[1800ms] ease-out",
          fadeOut ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />

      {/* Ruins caption center (only when expired) */}
      {ruins && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="mx-4 max-w-xl rounded-2xl bg-black/40 px-6 py-4 backdrop-blur">
            <p className="text-center text-white text-lg sm:text-xl md:text-2xl font-medium">
              {"Your time here has passed."}
            </p>
            <p className="mt-2 text-center text-white/70 text-sm">{"The place remains, changed by absence."}</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 right-0 p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="secondary"
          className="opacity-0 pointer-events-auto focus:opacity-0 hover:opacity-0 active:opacity-0 bg-transparent text-transparent border-transparent shadow-none focus:outline-none"
          onClick={handleSecretReset}
          aria-label="Reset scene (invisible hot area)"
        >
          {"Reset scene"}
        </Button>
      </div>

      {secondChance && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-6 max-w-md text-center">
            <div
              className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-white/30 border-l-transparent animate-spin"
              aria-hidden="true"
            />
            <p className="text-white text-base sm:text-lg">
              {"I guess, some do get a  second chance. Use it wisely now."}
            </p>
            <span className="sr-only" aria-live="polite">
              {"Second chance loading"}
            </span>
          </div>
        </div>
      )}

      {/* SR-only announcement for last revealed line */}
      <span className="sr-only" aria-live="polite">
        {lastNoteText ? `New line: ${lastNoteText}` : ""}
      </span>
    </div>
  )
}

function FloatingNote({ note, reducedMotion }: { note: Note; reducedMotion: boolean }) {
  // Avoid jitter near the edges
  const offsetX = useMemo(() => (Math.random() - 0.5) * 20, [])
  const offsetY = useMemo(() => (Math.random() - 0.5) * 12, [])
  const lifetime = Math.max(800, note.lifetimeMs)

  return (
    <span
      className="pointer-events-none absolute select-none will-change-transform"
      style={{
        left: note.x,
        top: note.y,
        transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
        animation: reducedMotion
          ? `bt-fade ${Math.round(lifetime)}ms ease-out forwards`
          : `bt-float ${Math.round(lifetime)}ms ease-out forwards`,
      }}
    >
      <span
        className="rounded-md bg-white/70 px-2 py-1 text-[11px] sm:text-xs font-medium shadow-sm"
        style={{ color: note.color }}
      >
        {note.text}
      </span>
    </span>
  )
}

function SceneMedia({
  src,
  serene,
  ruins,
  reducedMotion,
}: {
  src: string
  serene: boolean
  ruins: boolean
  reducedMotion: boolean
}) {
  const isVideo = /\.mp4$|\.webm$/i.test(src)
  const [errored, setErrored] = useState(false)

  if (errored) {
    return (
      <div
        className={cn(
          "absolute inset-0",
          serene
            ? "bg-gradient-to-b from-emerald-900 via-emerald-800 to-slate-900"
            : "bg-gradient-to-b from-stone-900 via-zinc-900 to-black",
        )}
        aria-hidden="true"
      />
    )
  }

  if (isVideo) {
    return (
      <video
        key={src}
        className="absolute inset-0 size-full object-cover"
        src={src}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        onError={() => setErrored(true)}
        aria-label={serene ? "Serene scene background" : "Ruins scene background"}
      />
    )
  }

  return (
    // Image / GIF
    // If image fails, fallback to palette background.
    <img
      className="absolute inset-0 size-full object-cover"
      src={src || "/placeholder.svg"}
      alt={serene ? "Serene scene background" : "Ruins scene background"}
      onError={() => setErrored(true)}
    />
  )
}

function FadeInOut({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("animate-[bt-in_400ms_ease-out,bt-out_400ms_ease-in_1800ms_forwards]", className)}
      aria-hidden="true"
    >
      {children}
    </div>
  )
}

function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setPrefers(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])
  return prefers
}
