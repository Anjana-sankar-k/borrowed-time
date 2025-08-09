import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-black text-white">
      {/* Soft gradient background */}
      <div
        className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,214,255,0.12)_0%,rgba(0,0,0,0)_60%),linear-gradient(to_bottom,rgba(0,0,0,0.2),rgba(0,0,0,0.85))]"
        aria-hidden="true"
      />

      {/* Content */}
      <section className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
        <h1 className="font-zen text-4xl sm:text-5xl tracking-tight">
          <span className="bg-gradient-to-r from-fuchsia-200 via-rose-200 to-amber-200 bg-clip-text text-transparent">
            Borrowed Time
          </span>
        </h1>

        <p className="text-white/85 text-balance max-w-xl leading-relaxed">
          After you enter, you will have 60 seconds to reminisce. Click or tap anywhere to reveal drifting verses. When
          the minute ends, the world remains—changed by absence.
        </p>

        <div className="mt-2">
          <Button
            asChild
            size="lg"
            className="bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur rounded-full px-8"
            aria-label="Enter the world"
          >
            <Link href="/world">Enter</Link>
          </Button>
        </div>

        <p className="text-xs text-white/50 mt-4">Minimal motion. Sound optional.</p>
      </section>
    </main>
  )
}
