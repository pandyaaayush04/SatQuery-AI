import { ArrowRight, Buildings, Drop, FirstAid, GraduationCap, Leaf, Plant, Thermometer, Tree } from "@phosphor-icons/react"
import mountainImg from "@/assets/vision-bg3.png"
import { Button } from "@/components/ui/button"

const SECTORS = [
  { icon: Plant, title: "Agriculture", body: "Crop monitoring, yield estimation" },
  { icon: Tree, title: "Forestry", body: "Deforestation, forest health" },
  { icon: Drop, title: "Water Resources", body: "Water bodies, flood monitoring" },
  { icon: Buildings, title: "Urban Planning", body: "Urban growth, infrastructure" },
  { icon: FirstAid, title: "Disaster Response", body: "Floods, fires, landslides" },
  { icon: Thermometer, title: "Climate Action", body: "Carbon monitoring, resilience" },
  { icon: Leaf, title: "Biodiversity", body: "Habitat mapping, ecosystem tracking" },
  { icon: GraduationCap, title: "Research & Education", body: "Open, explainable geospatial AI" },
]

export function ImpactVisionSection({ onLaunch }: { onLaunch: () => void }) {
  return (
    // One continuous section: the "where this helps" content and the closing vision quote used to
    // be two separate sections with a hard seam between them -- now they flow into each other, the
    // photo starting immediately where the sector grid ends, no gap or border between.
    <section id="vision" className="relative">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-8 sm:pt-12">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.4fr] lg:items-start">
          <div className="space-y-4">
            <p className="font-mono text-[11px] tracking-widest text-primary uppercase">Built for a Better Tomorrow</p>
            <h2 className="font-serif text-4xl leading-[1.1] text-foreground">
              Where This Kind
              <br />
              of Insight Helps
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              The same core capabilities -- land cover, water and vegetation detection, change analysis -- apply
              wherever the question is "what's happening on the ground, and did it change."
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SECTORS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="space-y-1 rounded-xl border border-border bg-card p-3">
                <Icon className="size-5 text-primary" />
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-10 overflow-hidden py-20 sm:mt-12 sm:py-28">
        <img src={mountainImg} alt="" className="absolute inset-0 size-full object-cover brightness-150" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--teal-950)]/85 via-[var(--teal-950)]/58 to-[var(--teal-950)]/28" />
        {/* The photo's own top edge was a hard rectangle line against the sector grid above it --
           fade it into the page background so the two zones dissolve into each other instead of
           meeting at a visible seam. */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--paper)] to-transparent sm:h-32" />

        <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-8">
          <p className="font-mono text-[11px] tracking-widest text-primary-foreground/60 uppercase">Our Vision</p>
          <h2 className="mt-4 font-serif text-4xl text-primary-foreground italic sm:text-5xl">"Earth's data. A better tomorrow."</h2>
          <p className="mt-4 text-sm text-primary-foreground/75">
            We believe satellite data, combined with AI that shows its work, can help build a safer, more
            sustainable, and more informed world.
          </p>
          <Button className="mt-7 bg-primary-foreground text-primary hover:bg-primary-foreground/85" onClick={onLaunch}>
            Be Part of the Journey
            <ArrowRight />
          </Button>
        </div>
      </div>
    </section>
  )
}
