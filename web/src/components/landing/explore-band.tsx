import { ArrowRight } from "@phosphor-icons/react"
import exploreBg from "@/assets/explore-bg.png"
import thumbLandcover from "@/assets/ex-landcover.jpg"
import thumbWater from "@/assets/ex-water.jpg"
import changeAfter from "@/assets/ex-change-after.jpg"
import changeBefore from "@/assets/ex-change-before.jpg"
import thumbForest from "@/assets/ex-forest.jpg"
import { BeforeAfter } from "@/components/landing/before-after"
import { Button } from "@/components/ui/button"

const EXAMPLES = [
  { q: "What are the dominant land cover types in this area?", thumb: thumbLandcover },
  { q: "Are there any water bodies in this image?", thumb: thumbWater },
  { q: "What changed between these two dates?", thumb: null },
  { q: "Identify the deforestation areas in this region.", thumb: thumbForest },
]

export function ExploreBand({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section id="explore" className="relative overflow-hidden bg-[var(--teal-950)] py-16 text-primary-foreground sm:py-20">
      <img src={exploreBg} alt="" className="absolute inset-0 size-full object-cover" />
      {/* Two-axis fade: strong on the left where the heading sits (for contrast), fading toward the
         right so more of the image shows -- plus a light overall wash so the cards stay legible. */}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--teal-950)] via-[var(--teal-950)]/55 to-[var(--teal-950)]/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--teal-950)]/60 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-8">
          <div className="lg:w-72 lg:shrink-0">
            <p className="font-mono text-[11px] tracking-widest text-primary-foreground/60 uppercase">Real Questions. Real Answers.</p>
            <h2 className="mt-3 font-serif text-4xl leading-[1.1]">Explore What You Can Do</h2>
            <p className="mt-3 text-sm text-primary-foreground/70">
              Ask complex questions, get evidence-backed answers, and turn satellite data into something you can act
              on.
            </p>
            <Button className="mt-6 bg-primary-foreground text-primary hover:bg-primary-foreground/85" onClick={onLaunch}>
              Try Live Demo
              <ArrowRight />
            </Button>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3 self-end lg:grid-cols-4">
            {EXAMPLES.map(({ q, thumb }) => (
              <div key={q} className="group overflow-hidden rounded-2xl border border-white/20 bg-primary-foreground/5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/40 hover:bg-primary-foreground/10 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <div className="aspect-[8/5]">
                  {thumb ? (
                    <img src={thumb} alt="" className="size-full object-cover" />
                  ) : (
                    <BeforeAfter before={changeBefore} after={changeAfter} beforeLabel="2000" afterLabel="2006" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 p-2.5">
                  <p className="text-xs leading-snug text-primary-foreground/90">{q}</p>
                  <ArrowRight className="size-3.5 shrink-0 text-primary-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
