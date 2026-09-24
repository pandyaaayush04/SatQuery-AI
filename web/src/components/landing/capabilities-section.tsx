import { ArrowRight, GitBranch, Image, Intersect, TreeStructure } from "@phosphor-icons/react"
import { BeforeAfter } from "@/components/landing/before-after"
import thumbSingle from "@/assets/cap-single.jpg"
import changeAfter from "@/assets/cap-change-after.jpg"
import changeBefore from "@/assets/cap-change-before.jpg"
import thumbFusion from "@/assets/cap-fusion.jpg"
import thumbAgentic from "@/assets/cap-agentic.jpg"

const CAPABILITIES = [
  { icon: Image, title: "Single Image Analysis", body: "VQA, captioning, and grounding on a single optical or SAR image.", thumb: thumbSingle },
  { icon: GitBranch, title: "Bi-temporal Analysis", body: "Detect and describe changes across time, verified against index math.", thumb: null },
  { icon: Intersect, title: "Optical + SAR Fusion", body: "Combine both sensors for evidence neither gives alone.", thumb: thumbFusion },
  { icon: TreeStructure, title: "Agentic Intelligence", body: "Automatically routes each question to the right tool.", thumb: thumbAgentic },
]

export function CapabilitiesSection() {
  return (
    <section id="capabilities" className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-8">
        <div className="space-y-4 lg:w-64 lg:shrink-0">
          <p className="font-mono text-[11px] tracking-widest text-primary uppercase">Powerful Capabilities</p>
          <h2 className="font-serif text-4xl leading-[1.1] text-foreground">
            One Platform.
            <br />
            Multiple Perspectives.
          </h2>
          <p className="text-sm text-muted-foreground">
            From single-image understanding to multi-temporal change analysis, SatQuery AI routes each question to
            the tool that can actually answer it -- and checks the answer against the sensor data before showing it
            to you.
          </p>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 self-center lg:grid-cols-4">
          {CAPABILITIES.map(({ icon: Icon, title, body, thumb }) => (
            <div key={title} className="group flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3.5 smooth-shadow-ring-xs">
              <Icon className="size-6 text-primary" />
              <p className="text-sm leading-tight font-medium text-foreground">{title}</p>
              <p className="flex-1 text-[11px] leading-snug text-muted-foreground">{body}</p>
              <div className="relative aspect-[8/5] overflow-hidden rounded-lg">
                {thumb ? (
                  <img src={thumb} alt="" className="size-full object-cover" />
                ) : (
                  <BeforeAfter before={changeBefore} after={changeAfter} beforeLabel="APR" afterLabel="AUG" />
                )}
                <div className="absolute right-2.5 bottom-2 flex size-9 items-center justify-center rounded-full bg-card/90 text-foreground transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="size-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
