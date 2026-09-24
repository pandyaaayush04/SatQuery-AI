import { Info, Warning, XCircle } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { Finding } from "@/lib/types"

const STYLE = {
  INFO: { icon: Info, className: "text-muted-foreground" },
  WARN: { icon: Warning, className: "text-warning" },
  BLOCK: { icon: XCircle, className: "text-destructive" },
} as const

export function FindingsList({ findings }: { findings: Finding[] }) {
  if (!findings.length) return null
  return (
    <ul className="space-y-1.5 rounded-lg border border-border bg-card p-3 smooth-shadow-ring-xs">
      {findings.map((f, i) => {
        const { icon: Icon, className } = STYLE[f.level]
        return (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Icon className={cn("mt-0.5 size-4 shrink-0", className)} weight={f.level === "INFO" ? "regular" : "fill"} />
            <span>
              <span className="font-mono text-xs text-muted-foreground">{f.code}</span>{" "}
              <span className="text-foreground">{f.msg}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
