import { Globe, Leaf, Rocket, Stack } from "@phosphor-icons/react"

const STATS = [
  { icon: Globe, title: "Global Coverage", body: "Analyze imagery anywhere on Earth" },
  { icon: Stack, title: "Multi-Modal", body: "Optical, SAR, and bi-temporal pairs" },
  { icon: Rocket, title: "Agentic Pipeline", body: "One system, routed automatically" },
  { icon: Leaf, title: "Evidence-Backed", body: "Answers checked against the sensor data" },
]

export function StatsStrip() {
  return (
    // A contained floating card, not a full-bleed bar -- it sits over the page (overlapping the
    // hero's lower edge slightly) with its own rounded box and shadow, rather than a hard opaque
    // strip that spans edge-to-edge and cuts the view off.
    <section className="relative z-10 -mt-8 px-4 sm:px-8">
      <div className="mx-auto max-w-5xl rounded-2xl border border-border bg-card px-6 py-6 smooth-shadow-ring-sm sm:px-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4 lg:gap-4">
          {STATS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-center gap-3">
              <Icon className="size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="truncate text-xs text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
