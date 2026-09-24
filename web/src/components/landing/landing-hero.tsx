import { ArrowRight, ChatCircleText, Play, Stack, Waveform } from "@phosphor-icons/react"
import heroBackdrop from "@/assets/hero-backdrop.png"
import { SatQueryGlobe } from "@/components/globe/SatQueryGlobe"
import { Button } from "@/components/ui/button"

const CHIPS = [
  { icon: Waveform, label: "Optical + SAR Support" },
  { icon: Stack, label: "Multi-temporal Analysis" },
  { icon: ChatCircleText, label: "Natural Language Queries" },
]

export function LandingHero({ onLaunch, onSeeExamples }: { onLaunch: () => void; onSeeExamples: () => void }) {
  return (
    <section className="relative overflow-hidden">
      {/* Fades from near-white (left, blends into the page) to a dark cosmic backdrop (right,
         behind the globe) on its own -- spans the whole hero, no extra gradient overlay needed. */}
      <img src={heroBackdrop} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" />
      {/* The backdrop image itself has a hard bottom edge -- fade it into the page background
         instead of letting the section cut off abruptly into whatever comes next. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--paper)]" />

      <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-8 sm:pt-16 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-8">
          <div className="relative z-10 space-y-6">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
              <span className="h-px w-6 bg-border" />
              Geospatial AI for a Brighter Tomorrow
            </p>

            <h1 className="font-serif text-5xl leading-[1.08] text-foreground sm:text-6xl">
              The Earth Speaks
              <br />
              in Images.
              <br />
              <span className="text-primary">You Ask, We Understand.</span>
            </h1>

            <p className="max-w-md text-base text-muted-foreground sm:text-lg">
              An agentic AI system that reads satellite imagery, cross-checks its own answers against the sensor
              data, and tells you plainly when it can't be sure.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button size="lg" className="h-11 px-5 text-base" onClick={onLaunch}>
                Start Exploring
                <ArrowRight />
              </Button>
              <Button size="lg" variant="outline" className="h-11 px-5 text-base" onClick={onSeeExamples}>
                <Play />
                See It In Action
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {CHIPS.map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                  <Icon className="size-3.5 text-primary" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative hidden aspect-square sm:block">
            {/* No clipping wrapper any more: the globe canvas is 1.45x the globe (room for satellites to fly past the rim) and is
               absolutely positioned, so it never affects layout. Position = the old 28% right shift: (0.5 - 0.28/1.45) = 30.7%.
               The soft white rim now lives inside SatQueryGlobe. Original version: web/backups/globe-working/. */}
            <div className="absolute top-1/2 left-1/2 aspect-square w-[145%] -translate-x-[30.7%] -translate-y-1/2">
              <SatQueryGlobe offset={[0, 0]} satellites viewScale={1.45} className="size-full [&>div]:size-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
