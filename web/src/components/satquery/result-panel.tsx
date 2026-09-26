import { ArrowDown, ArrowUp, Compass, Info, Minus, Warning } from "@phosphor-icons/react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { DIPLOMATIC_TITLES, DIPLOMATIC_TRY, pickStable } from "@/lib/phrases"
import type { Finding, Trace } from "@/lib/types"

// Confidence in everyday words. Never red: being unsure is honest, not an error.
function confidenceInfo(c: number | null) {
  if (c === null) return null
  if (c >= 0.8) return { label: "Confident", note: "Backed up by clear evidence", className: "bg-primary text-primary-foreground" }
  if (c >= 0.5) return { label: "Fairly sure", note: "Reasonable evidence, but not clear-cut", className: "bg-secondary text-secondary-foreground" }
  return { label: "Not very sure", note: "The evidence is thin, so treat this with care", className: "bg-warning/10 text-warning" }
}

const TASKS: Record<string, string> = {
  change: "Comparing your two images to see what changed",
  fusion: "Combining the optical and radar images",
  vqa: "Looking at the image to answer your question",
  caption: "Describing the scene in words",
  grounding: "Finding something in the image and outlining it",
}
const TOOLS: Record<string, string> = {
  "physics.verify": "Checked the answer against the satellite's own measurements",
  "change.change_report": "Compared the two dates pixel by pixel",
  "place.stats": "Measured how much of the area is water, greenery and buildings",
  vlm: "Asked the AI vision model to look at the image",
}
const SENSOR: Record<string, string> = { optical: "Optical camera", sar: "Radar (SAR)" }
const CONCEPT: Record<string, string> = { vegetation: "Vegetation", water: "Water", built: "Built-up area" }
const VERDICT: Record<string, string> = {
  supports: "The measurements agree with this answer.",
  contradicts: "The measurements disagree with the AI's first answer, so I lowered my confidence.",
  inconclusive: "The measurements couldn't settle it either way.",
  unavailable: "There weren't enough measurements to double-check it.",
}
const TREND_ICON = { increased: ArrowUp, decreased: ArrowDown, unchanged: Minus }
const TREND_WORD = { increased: "went up", decreased: "went down", unchanged: "stayed about the same" }

const isAbstain = (t: Trace) => t.answer === null || /^(unable to determine|cannot determine|can't determine|could not determine|not enough)/i.test(t.answer.trim())

function FindingsNote({ findings }: { findings: Finding[] }) {
  const shown = findings.filter((f) => f.msg)
  if (!shown.length) return null
  return (
    <ul className="space-y-1.5 text-sm">
      {shown.map((f, i) => (
        <li key={i} className="flex items-start gap-2 text-muted-foreground">
          {f.level === "INFO" ? <Info className="mt-0.5 size-4 shrink-0" /> : <Warning className="mt-0.5 size-4 shrink-0 text-warning" weight="fill" />}
          <span>{f.msg}</span>
        </li>
      ))}
    </ul>
  )
}

export function ResultPanel({ trace, messageId }: { trace: Trace; messageId: string }) {
  const conf = confidenceInfo(trace.confidence)
  const { physics, change, per_sensor } = trace.evidence
  const abstain = isAbstain(trace)

  const steps = (
    <div className="space-y-3 text-sm">
      <ol className="list-decimal space-y-1.5 pl-5 text-foreground">
        {trace.task && <li>{TASKS[trace.task] ?? "Working out what kind of question this is"}</li>}
        {trace.tools.map((t) => TOOLS[t] && <li key={t}>{TOOLS[t]}</li>)}
      </ol>

      {physics && (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="font-medium text-foreground">Measurement check</p>
          <p className="text-muted-foreground">{VERDICT[physics.verdict] ?? VERDICT.unavailable}</p>
          {Object.entries(physics.tests).map(([sensor, t]) => (
            <p key={sensor} className="pl-2 text-muted-foreground">
              {SENSOR[sensor] ?? sensor}: {t.says === "present" ? "found a clear signal" : t.says === "absent" ? "found no clear signal" : "the signal was unclear"} ({(t.coverage * 100).toFixed(1)}% of the scene)
            </p>
          ))}
        </div>
      )}

      {per_sensor && Object.keys(per_sensor).length > 0 && (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="font-medium text-foreground">What each image said on its own</p>
          {Object.entries(per_sensor).map(([sensor, a]) => (
            <p key={sensor} className="pl-2 text-muted-foreground">
              {SENSOR[sensor] ?? sensor}: “{a}”
            </p>
          ))}
        </div>
      )}

      {change && change.available && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="font-medium text-foreground">What changed</p>
          <p className="text-muted-foreground">About {change.changed_pct}% of the scene is different between the two dates.</p>
          {change.regions?.map((r, i) => (
            <p key={i} className="pl-2 text-muted-foreground">
              Area {i + 1}: {r.area_pct}% of the scene, {r.where}
            </p>
          ))}
          {change.trends &&
            Object.entries(change.trends).map(([concept, t]) => {
              const Icon = TREND_ICON[t.trend]
              return (
                <p key={concept} className="flex items-center gap-1.5 pl-2 text-muted-foreground">
                  <Icon className="size-3.5 shrink-0" />
                  {CONCEPT[concept] ?? concept} {TREND_WORD[t.trend]} ({t.before_pct}% → {t.after_pct}%)
                </p>
              )
            })}
        </div>
      )}

      {trace.findings.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="font-medium text-foreground">Good to know</p>
          <FindingsNote findings={trace.findings} />
        </div>
      )}

      <details className="border-t border-border pt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">Technical details</summary>
        <p className="mt-1.5 font-mono break-words">
          task: {trace.task ?? "-"} · tools: {trace.tools.join(", ") || "-"} · mode: {trace.mode}
          {trace.findings.length > 0 && <> · notes: {trace.findings.map((f) => f.code).join(", ")}</>}
        </p>
      </details>
    </div>
  )

  return (
    <div className="space-y-3">
      {abstain ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 smooth-shadow-ring-xs">
          <div className="flex items-start gap-3">
            <Compass className="mt-1 size-6 shrink-0 text-primary" weight="duotone" />
            <div className="space-y-1.5">
              <p className="font-serif text-xl leading-snug text-foreground">{pickStable(DIPLOMATIC_TITLES, messageId)}</p>
              <p className="text-sm text-muted-foreground">{pickStable(DIPLOMATIC_TRY, messageId + "x")}</p>
            </div>
          </div>
          {trace.findings.some((f) => f.level !== "INFO") && <FindingsNote findings={trace.findings.filter((f) => f.level !== "INFO")} />}
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-border bg-card p-5 smooth-shadow-ring-sm">
          {conf && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${conf.className}`}>{conf.label}</span>
              <span className="text-xs text-muted-foreground">{conf.note}</span>
            </div>
          )}
          <p className="font-serif text-2xl leading-snug text-foreground first-letter:uppercase">{trace.answer}</p>
        </div>
      )}

      <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-1 smooth-shadow-ring-xs">
        <AccordionItem value="trace" className="border-none">
          <AccordionTrigger className="px-3 text-sm text-muted-foreground hover:no-underline">How I worked this out</AccordionTrigger>
          <AccordionContent className="px-3">{steps}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
