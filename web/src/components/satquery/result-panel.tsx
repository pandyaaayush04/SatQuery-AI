import { ArrowDown, ArrowUp, Minus, WarningCircle } from "@phosphor-icons/react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { FindingsList } from "./findings-list"
import type { Trace } from "@/lib/types"

const CONFIDENCE = (c: number | null) => {
  if (c === null) return null
  if (c >= 0.8) return { label: "High confidence", className: "bg-primary text-primary-foreground" }
  if (c >= 0.5) return { label: "Moderate confidence", className: "bg-secondary text-secondary-foreground" }
  return { label: "Low confidence", className: "bg-destructive text-destructive-foreground" }
}

const TREND_ICON = { increased: ArrowUp, decreased: ArrowDown, unchanged: Minus }

function VerdictBadge({ verdict }: { verdict: string }) {
  const map: Record<string, string> = {
    supports: "bg-primary/10 text-primary",
    contradicts: "bg-destructive/10 text-destructive",
    inconclusive: "bg-warning/10 text-warning",
    unavailable: "bg-muted text-muted-foreground",
  }
  return <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${map[verdict] ?? map.unavailable}`}>{verdict}</span>
}

export function ResultPanel({ trace }: { trace: Trace }) {
  const confidence = CONFIDENCE(trace.confidence)
  const { physics, change, per_sensor } = trace.evidence

  if (trace.answer === null) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 smooth-shadow-ring-xs">
        <WarningCircle className="mt-0.5 size-5 shrink-0 text-warning" weight="fill" />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Can't answer this yet</p>
          <p className="text-sm text-muted-foreground">
            The language model couldn't produce an answer for this question. Presence questions (water, vegetation,
            built-up) and before/after change are answered from sensor data alone; details are below.
          </p>
          <FindingsList findings={trace.findings} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border border-border bg-card p-5 smooth-shadow-ring-sm">
        {confidence && <Badge className={confidence.className}>{confidence.label}</Badge>}
        <p className="font-serif text-2xl leading-snug text-foreground">{trace.answer}</p>
      </div>

      <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-1 smooth-shadow-ring-xs">
        <AccordionItem value="trace" className="border-none">
          <AccordionTrigger className="px-3 text-sm text-muted-foreground hover:no-underline">
            How this was answered
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-3 font-mono text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground">task:</span>
              <span className="rounded bg-muted px-1.5 py-0.5">{trace.task}</span>
              {trace.tools.map((t) => (
                <span key={t} className="rounded bg-muted px-1.5 py-0.5">
                  {t}
                </span>
              ))}
            </div>

            {physics && (
              <div className="space-y-1.5 border-t border-border pt-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">physics check:</span>
                  <VerdictBadge verdict={physics.verdict} />
                </div>
                {Object.entries(physics.tests).map(([sensor, t]) => (
                  <div key={sensor} className="pl-2 text-muted-foreground">
                    {sensor}: {t.says} ({(t.coverage * 100).toFixed(1)}% coverage)
                  </div>
                ))}
              </div>
            )}

            {per_sensor && (
              <div className="space-y-1 border-t border-border pt-2.5">
                <span className="text-muted-foreground">per-sensor:</span>
                {Object.entries(per_sensor).map(([sensor, a]) => (
                  <div key={sensor} className="pl-2 text-muted-foreground">
                    {sensor}: "{a}"
                  </div>
                ))}
              </div>
            )}

            {change && change.available && (
              <div className="space-y-2 border-t border-border pt-2.5">
                <div className="text-muted-foreground">changed area: {change.changed_pct}% of scene</div>
                {change.regions?.map((r, i) => (
                  <div key={i} className="pl-2 text-muted-foreground">
                    region {i + 1}: {r.area_pct}% · {r.where}
                  </div>
                ))}
                {change.trends &&
                  Object.entries(change.trends).map(([concept, t]) => {
                    const Icon = TREND_ICON[t.trend]
                    return (
                      <div key={concept} className="flex items-center gap-1.5 pl-2 text-muted-foreground">
                        <Icon className="size-3" />
                        {concept}: {t.before_pct}% → {t.after_pct}%
                      </div>
                    )
                  })}
              </div>
            )}

            {trace.findings.length > 0 && (
              <div className="border-t border-border pt-2.5">
                <FindingsList findings={trace.findings} />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
