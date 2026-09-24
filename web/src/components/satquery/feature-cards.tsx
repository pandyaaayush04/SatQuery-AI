import { GitBranch, Image, Intersect, TreeStructure } from "@phosphor-icons/react"

const FEATURES = [
  { icon: Image, title: "Single Image Analysis" },
  { icon: GitBranch, title: "Bi-temporal Analysis" },
  { icon: Intersect, title: "Optical + SAR Fusion" },
  { icon: TreeStructure, title: "Agentic Intelligence" },
]

export function FeatureCards() {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {FEATURES.map(({ icon: Icon, title }) => (
        <div key={title} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 smooth-shadow-ring-xs">
          <Icon className="size-4 shrink-0 text-primary" />
          <p className="truncate text-xs font-medium text-foreground">{title}</p>
        </div>
      ))}
    </div>
  )
}
