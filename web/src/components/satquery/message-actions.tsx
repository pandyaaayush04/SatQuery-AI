import { Check, Copy, EnvelopeSimple, Link as LinkIcon, PencilSimple, ShareNetwork, WhatsappLogo } from "@phosphor-icons/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ChatMessage } from "@/lib/types"

/** The assistant's answer as plain text, for copying and sharing. */
export function answerText(m: ChatMessage): string {
  const parts: string[] = []
  if (m.place) parts.push(`${m.place.name}${m.place.country ? ", " + m.place.country : ""}`)
  if (m.reply) parts.push(m.reply.replace(/\*\*?/g, ""))
  if (m.trace?.answer) parts.push(`${m.trace.answer}${m.trace.confidence != null ? ` (confidence ${Math.round(m.trace.confidence * 100)}%)` : ""}`)
  if (!parts.length && m.trace) parts.push("SatQuery AI couldn't give a confident answer to this one.")
  return parts.join("\n\n")
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // older browsers / non-secure pages: fall back to a hidden textarea
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.cssText = "position:fixed;opacity:0"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  }
}

const btn =
  "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"

// Copy / share (and edit, for your own questions). Shown on hover or keyboard focus on a mouse; always shown on touch screens.
export function MessageActions({ text, kind, onEdit, editDisabled, leading }: { text: string; kind: "question" | "answer"; onEdit?: () => void; editDisabled?: boolean; leading?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  if (!text.trim()) return null

  const link = typeof window !== "undefined" ? window.location.origin : ""
  const shared = `${kind === "question" ? "I asked SatQuery AI:" : "SatQuery AI answered:"}\n\n${text}\n\n${link}`
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function"

  async function copy(t = text) {
    if (await copyText(t)) {
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <div className={`flex items-center gap-0.5 transition-opacity ${leading ? "opacity-100" : "opacity-100 md:opacity-0 md:group-focus-within/msg:opacity-100 md:group-hover/msg:opacity-100"}`}>
      {leading}
      <button type="button" onClick={() => copy()} aria-label={copied ? "Copied" : `Copy this ${kind}`} title={copied ? "Copied" : "Copy"} className={btn}>
        {copied ? <Check className="size-4 text-primary" weight="bold" /> : <Copy className="size-4" />}
      </button>
      {onEdit && (
        <button type="button" onClick={onEdit} disabled={editDisabled} aria-label="Edit this question" title="Edit" className={`${btn} disabled:opacity-40`}>
          <PencilSimple className="size-4" />
        </button>
      )}
      <Popover open={shareOpen} onOpenChange={setShareOpen}>
        <PopoverTrigger aria-label={`Share this ${kind}`} title="Share" className={btn}>
          <ShareNetwork className="size-4" />
        </PopoverTrigger>
        <PopoverContent className="w-52 space-y-0.5 p-1.5" align={kind === "question" ? "end" : "start"}>
          {canNativeShare && (
            <button
              type="button"
              className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
              onClick={() => {
                setShareOpen(false)
                navigator.share({ title: "SatQuery AI", text: shared }).catch(() => {})
              }}
            >
              <ShareNetwork className="size-4 text-primary" />
              Share…
            </button>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shared)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setShareOpen(false)}
            className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <WhatsappLogo className="size-4 text-primary" />
            WhatsApp
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent("SatQuery AI")}&body=${encodeURIComponent(shared)}`}
            onClick={() => setShareOpen(false)}
            className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <EnvelopeSimple className="size-4 text-primary" />
            Email
          </a>
          <button
            type="button"
            className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            onClick={() => {
              void copy(shared)
              setShareOpen(false)
            }}
          >
            <LinkIcon className="size-4 text-primary" />
            Copy as shareable text
          </button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
