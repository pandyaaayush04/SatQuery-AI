import { ArrowClockwise, CaretLeft, CaretRight, CircleNotch, Image, Planet, WarningCircle } from "@phosphor-icons/react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ImageLightbox } from "./lightbox"
import { answerText, MessageActions } from "./message-actions"
import { PlaceCard } from "./place-card"
import { PreviewPanel } from "./preview-panel"
import { ReplyText } from "./reply-text"
import { ResultPanel } from "./result-panel"
import { friendlyError } from "@/lib/api"
import { nextWaiting, slowHint } from "@/lib/phrases"
import type { ChatMessage, SessionFile } from "@/lib/types"

// A different line every few seconds while the model works, so waiting never feels like a frozen screen.
function Thinking() {
  const [line, setLine] = useState(() => nextWaiting())
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const swap = window.setInterval(() => setLine((l) => nextWaiting(l)), 3200)
    const tick = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => {
      window.clearInterval(swap)
      window.clearInterval(tick)
    }
  }, [])
  const hint = slowHint(seconds)
  return (
    <div className="space-y-1 text-sm text-muted-foreground" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <CircleNotch className="size-4 shrink-0 animate-spin" />
        <span key={line} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {line}
        </span>
      </div>
      {hint && <p className="pl-6 text-xs">{hint}</p>}
    </div>
  )
}

function UserBubble({ m, onEdit, onSwitch, busy, me }: { m: ChatMessage; onEdit: (id: string, text: string) => void; onSwitch: (id: string, dir: -1 | 1) => void; busy: boolean; me?: string }) {
  const thumbs = m.imageThumbs ?? []
  const [open, setOpen] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(m.text ?? "")
  const taRef = useRef<HTMLTextAreaElement>(null)
  const current = open !== null ? thumbs[open] : null
  const versions = m.branches?.length ?? 1
  const at = m.branchIndex ?? 0

  useLayoutEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [draft, editing])

  function save() {
    const t = draft.trim()
    if (!t || busy) return
    setEditing(false)
    if (t !== (m.text ?? "").trim()) onEdit(m.id, t)
  }

  return (
    <div className="space-y-1">
      {m.author && m.author !== me && <p className="pr-1 text-right text-[11px] text-muted-foreground">{m.author}</p>}
      <div className="space-y-2.5 rounded-2xl rounded-tr-sm bg-secondary px-4 py-3 text-secondary-foreground">
        {thumbs.length > 0 ? (
          <ul className="flex flex-wrap gap-2.5">
            {thumbs.map((t, i) => (
              <li key={i} className="w-20 space-y-1 sm:w-24">
                <button
                  type="button"
                  disabled={!t.url}
                  onClick={() => setOpen(i)}
                  aria-label={`Enlarge preview of ${t.name}`}
                  className="relative block aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {t.url ? <img src={t.url} alt={`Preview of ${t.name}`} className="size-full object-contain" /> : <span className="flex size-full items-center justify-center"><Image className="size-5 text-muted-foreground" /></span>}
                  {t.modality && <span className="absolute bottom-1 left-1 rounded bg-foreground/70 px-1 py-0.5 font-mono text-[8px] text-background uppercase">{t.modality === "sar" ? "Radar" : "Optical"}</span>}
                </button>
                <p className="truncate text-[11px] opacity-80" title={t.name}>
                  {t.name}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          m.imageNames &&
          m.imageNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {m.imageNames.map((n) => (
                <span key={n} className="flex items-center gap-1 rounded-full bg-card/60 px-2 py-1 font-mono text-[11px]">
                  <Image className="size-3" />
                  {n}
                </span>
              ))}
            </div>
          )
        )}

        {editing ? (
          <div className="space-y-2">
            <textarea
              ref={taRef}
              value={draft}
              maxLength={2000}
              autoFocus
              aria-label="Edit your question"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false)
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  save()
                }
              }}
              className="no-scrollbar block w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setEditing(false); setDraft(m.text ?? "") }} className="min-h-9 rounded-lg px-3 text-sm text-secondary-foreground transition-colors hover:bg-card/60">
                Cancel
              </button>
              <button type="button" onClick={save} disabled={!draft.trim() || busy} className="min-h-9 rounded-lg bg-primary px-3 text-sm text-primary-foreground transition-opacity disabled:opacity-40">
                Save and resend
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>
        )}
        {current && <ImageLightbox open onOpenChange={(o) => !o && setOpen(null)} src={current.url} title={current.name} />}
      </div>
      {!editing && (
        <div className="flex justify-end">
          <MessageActions
            kind="question"
            text={m.text ?? ""}
            onEdit={() => { setDraft(m.text ?? ""); setEditing(true) }}
            editDisabled={busy}
            leading={
              versions > 1 ? (
                <span className="mr-1 flex items-center rounded-lg bg-muted/60 text-xs text-muted-foreground" role="group" aria-label="Versions of this question">
                  <button type="button" onClick={() => onSwitch(m.id, -1)} disabled={busy || at <= 0} aria-label="Previous version of this question" title="Previous version" className="flex size-8 items-center justify-center rounded-lg transition-colors hover:text-foreground disabled:opacity-30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                    <CaretLeft className="size-3.5" weight="bold" />
                  </button>
                  <span className="min-w-8 text-center font-mono tabular-nums" aria-live="polite">
                    {at + 1} / {versions}
                  </span>
                  <button type="button" onClick={() => onSwitch(m.id, 1)} disabled={busy || at >= versions - 1} aria-label="Next version of this question" title="Next version" className="flex size-8 items-center justify-center rounded-lg transition-colors hover:text-foreground disabled:opacity-30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                    <CaretRight className="size-3.5" weight="bold" />
                  </button>
                </span>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  )
}

// A slim column of small marks on the right edge, one per question. Hover (or tab into) it and a panel lists every question you have
// asked in this chat; click one to jump straight to it.
function PromptRail({ prompts, activeId }: { prompts: ChatMessage[]; activeId: string | null }) {
  if (prompts.length < 2) return null
  const jump = (id: string) => document.getElementById(`msg-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" })
  return (
    <nav aria-label="Your questions in this chat" className="group fixed top-1/2 right-1 z-20 hidden -translate-y-1/2 md:block">
      <div className="no-scrollbar flex max-h-[70svh] flex-col items-end gap-1 overflow-y-auto px-1.5 py-3">
        {prompts.map((p, i) => (
          <button key={p.id} type="button" onClick={() => jump(p.id)} aria-label={`Go to question ${i + 1}: ${p.text}`} aria-current={p.id === activeId ? "true" : undefined} className="flex h-3.5 w-8 items-center justify-end focus-visible:outline-none">
            <span className={`h-[3px] rounded-full transition-all ${p.id === activeId ? "w-5 bg-primary" : "w-3 bg-border group-hover:bg-primary/50"}`} />
          </button>
        ))}
      </div>
      {/* The panel sits flush against the marks (no gap to cross), so moving the mouse onto it keeps it open. */}
      <div className="pointer-events-none absolute top-1/2 right-full hidden -translate-y-1/2 pr-1 opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:block group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:block group-hover:opacity-100">
        <div className="no-scrollbar max-h-[70svh] w-72 space-y-0.5 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-lg">
          <p className="px-2 pt-1 pb-1 text-[11px] tracking-wide text-muted-foreground uppercase">Your questions</p>
          {prompts.map((p, i) => (
            <button key={p.id} type="button" onClick={() => jump(p.id)} className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted ${p.id === activeId ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <span className="mt-px w-4 shrink-0 font-mono text-[10px]">{i + 1}</span>
              <span className="line-clamp-2 break-words">{p.text}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}

export function ChatThread({
  messages,
  sessionId,
  sessionFiles,
  onRetry,
  onEdit,
  onSwitch,
  busy,
  me,
}: {
  messages: ChatMessage[]
  sessionId: string | null
  sessionFiles: SessionFile[]
  onRetry: (assistantId: string) => void
  onEdit: (id: string, text: string) => void
  onSwitch: (id: string, dir: -1 | 1) => void
  busy: boolean
  me?: string // this person's name: in a shared chat, other people's questions carry their name
}) {
  const latestTrace = [...messages].reverse().find((m) => m.trace)?.trace
  const endRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const prompts = messages.filter((m) => m.role === "user" && m.text)

  // Scrolling: a new question (and its "thinking" line) scrolls into view at the bottom; when the answer lands, jump to the START of
  // the answer so the beginning of a long reply isn't scrolled past.
  const last = messages[messages.length - 1]
  useEffect(() => {
    if (!last) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const behavior = reduce ? "auto" : "smooth"
    if (last.role === "user" || last.pending) endRef.current?.scrollIntoView({ block: "end", behavior })
    else document.getElementById(`msg-${last.id}`)?.scrollIntoView({ block: "start", behavior })
  }, [last?.id, last?.pending]) // eslint-disable-line react-hooks/exhaustive-deps

  // Which question is on screen, for the marks beside the chat.
  useEffect(() => {
    const els = prompts.map((p) => document.getElementById(`msg-${p.id}`)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const seen = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.set(e.target.id.slice(4), e.boundingClientRect.top)
          else seen.delete(e.target.id.slice(4))
        }
        const first = [...seen.entries()].sort((a, b) => a[1] - b[1])[0]
        if (first) setActiveId(first[0])
      },
      { threshold: 0.3 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [prompts.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // The text box floats OVER the chat (nothing solid behind it), so messages scroll underneath it. The bottom padding reserves
    // exactly the box's height (--composer-h, set by the page) so the last message can always be scrolled fully into view.
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-14 sm:px-8 sm:pt-16 md:pr-14" style={{ paddingBottom: "calc(var(--composer-h, 11rem) + 2rem)" }}>
      <PromptRail prompts={prompts} activeId={activeId} />
      {sessionId && sessionFiles.length > 0 && (
        <PreviewPanel sessionId={sessionId} files={sessionFiles} box={latestTrace?.evidence.box} overlayAvailable={latestTrace?.evidence.change?.available === true} />
      )}
      {messages.map((m) => (
        <div key={m.id} id={`msg-${m.id}`} className={`group/msg scroll-mt-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 ${m.role === "user" ? "flex justify-end" : "flex gap-3"}`}>
          {m.role === "assistant" && (
            <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary">
              <Planet className="size-4 text-primary-foreground" weight="fill" />
            </div>
          )}
          <div key={m.role === "user" ? "u" : m.pending ? "thinking" : m.error ? "error" : "answer"} className={m.role === "user" ? "max-w-[92%] sm:max-w-[80%]" : "min-w-0 flex-1 space-y-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"}>
            {m.role === "user" ? (
              <UserBubble m={m} onEdit={onEdit} onSwitch={onSwitch} busy={busy} me={me} />
            ) : m.pending ? (
              <Thinking />
            ) : m.error ? (
              // The one place a failure is shown (no separate popup): what happened, in plain words, and a way to retry.
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 smooth-shadow-ring-xs">
                <WarningCircle className="mt-0.5 size-5 shrink-0 text-warning" weight="fill" />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium text-foreground">That didn't go through</p>
                  <p className="text-sm text-muted-foreground">{friendlyError(new Error(m.error))}</p>
                  <button type="button" onClick={() => onRetry(m.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                    <ArrowClockwise className="size-4" />
                    Try again
                  </button>
                </div>
              </div>
            ) : (
              <>
                {m.place && <PlaceCard place={m.place} />}
                {m.reply && <ReplyText text={m.reply} />}
                {m.trace && <ResultPanel trace={m.trace} messageId={m.id} />}
                <MessageActions kind="answer" text={answerText(m)} />
              </>
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} aria-hidden="true" style={{ scrollMarginBottom: "calc(var(--composer-h, 11rem) + 1.5rem)" }} />
    </div>
  )
}
