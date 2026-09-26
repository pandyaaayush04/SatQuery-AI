import {
  ArrowsClockwise,
  ArrowUp,
  CalendarBlank,
  Check,
  CaretDown,
  CircleNotch,
  FileArrowUp,
  Image,
  ImageBroken,
  Leaf,
  Lightbulb,
  MagnifyingGlass,
  Microphone,
  Paperclip,
  Sparkle,
  Stop,
  Waves,
  X,
} from "@phosphor-icons/react"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ImageLightbox } from "./lightbox"
import { thumbnail } from "@/lib/api"
import { CATEGORIES, categoryHint, categoryLabel, maxImagesFor, pickSuggestions, POPULAR_PLACES, suggestionGroups, type Category } from "@/lib/modes"
import type { Attached } from "@/lib/types"

const CHIP_ICONS = [Sparkle, Leaf, Waves, CalendarBlank]
const MAX_TEXT = 2000
const uid = () => crypto.randomUUID()

// Web Speech API isn't in TypeScript's DOM types.
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
const SpeechRec: (new () => Recognition) | undefined = typeof window !== "undefined" ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognition) | undefined : undefined

export function Composer({
  images,
  setImages,
  question,
  onQuestionChange,
  onSend,
  busy,
  category,
  onCategoryChange,
  compact = false,
  sessionCount = 0,
  readOnly = false,
}: {
  images: Attached[]
  setImages: Dispatch<SetStateAction<Attached[]>>
  question: string
  onQuestionChange: (q: string) => void
  onSend: () => void
  busy: boolean
  category: Category
  onCategoryChange: (c: Category) => void
  compact?: boolean // in the chat view on small screens, hide the suggestion chips so the thread keeps the room
  readOnly?: boolean // a viewer of a shared chat: can read, cannot ask
  sessionCount?: number // images already sent in this chat (the text box is empty, but the questions are still about them)
}) {
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const recRef = useRef<Recognition | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [seed, setSeed] = useState(1)
  const [attachOpen, setAttachOpen] = useState(false)
  const [place, setPlace] = useState("")
  const [listening, setListening] = useState(false)
  const [focused, setFocused] = useState(false)
  const [zoomId, setZoomId] = useState<string | null>(null)
  const [ideasGroup, setIdeasGroup] = useState<string | null>(null)
  const zoom = images.find((a) => a.id === zoomId)

  const groups = useMemo(() => suggestionGroups(category, images.length || sessionCount), [category, images.length, sessionCount])
  const suggestions = useMemo(() => pickSuggestions(groups, seed, 3), [groups, seed])
  const max = maxImagesFor(category)
  const canSend = question.trim().length > 0 && !busy && !readOnly
  const hint = categoryHint(category, images.length)

  // Grow the box with the text (up to about 8 lines), so long questions stay readable.
  useLayoutEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [question])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(t)
  }, [notice])

  useEffect(() => () => recRef.current?.stop(), [])

  // Press "/" anywhere to jump to the question box (unless you're already typing somewhere, or a menu / dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      e.preventDefault()
      taRef.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function addFiles(list: FileList | File[]) {
    const all = Array.from(list)
    const tifs = all.filter((f) => /\.tiff?$/i.test(f.name))
    const msgs: string[] = []
    if (tifs.length < all.length) msgs.push("Only GeoTIFF files (.tif or .tiff) can be analysed.")
    const room = max - images.length
    if (tifs.length > room) msgs.push(room <= 0 ? `${categoryLabel(category)} takes up to ${max} image${max > 1 ? "s" : ""}. Remove one to add another.` : `Only ${max} image${max > 1 ? "s" : ""} per question, so I kept the first ${room}.`)
    if (msgs.length) setNotice(msgs.join(" "))
    const added: Attached[] = tifs.slice(0, Math.max(room, 0)).map((file) => ({ id: uid(), file, state: "loading" }))
    if (!added.length) return
    setImages((prev) => [...prev, ...added])
    for (const a of added) {
      thumbnail(a.file)
        .then((t) => setImages((prev) => prev.map((x) => (x.id === a.id ? { ...x, state: "ready", thumb: t.url, modality: t.modality } : x))))
        .catch(() => setImages((prev) => prev.map((x) => (x.id === a.id ? { ...x, state: "error" } : x))))
    }
  }

  function chooseCategory(c: Category) {
    onCategoryChange(c)
    const m = maxImagesFor(c)
    if (images.length > m) {
      setImages((prev) => prev.slice(0, m))
      setNotice(`${categoryLabel(c)} takes ${m} image${m > 1 ? "s" : ""}, so I kept the first.`)
    }
  }

  function applySuggestion(text: string) {
    onQuestionChange(text)
    taRef.current?.focus()
  }

  function toggleVoice() {
    if (!SpeechRec) return
    if (listening) return recRef.current?.stop()
    const r = new SpeechRec()
    r.lang = navigator.language || "en-IN"
    r.interimResults = false
    r.continuous = false
    r.onresult = (e) => {
      const said = Array.from(e.results).map((x) => x[0].transcript).join(" ").trim()
      if (said) onQuestionChange((question ? question.trimEnd() + " " : "") + said)
    }
    r.onend = () => setListening(false)
    r.onerror = () => {
      setListening(false)
      setNotice("I couldn't hear that. Please check your microphone permission and try again.")
    }
    recRef.current = r
    setListening(true)
    r.start()
  }

  return (
    <div className="space-y-3">

      <div
        className={`smooth-shadow-ring-sm rounded-2xl border bg-card transition-colors ${dragOver ? "border-ring bg-accent/10" : "border-border"}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          addFiles(e.dataTransfer.files)
        }}
      >
        {images.length > 0 && (
          <ul className="flex flex-wrap gap-3 px-4 pt-4" aria-label="Attached images">
            {images.map((a) => (
              <li key={a.id} className="w-24 shrink-0 space-y-1">
                <div className="relative size-24 overflow-hidden rounded-xl border border-border bg-muted">
                  {a.state === "ready" && a.thumb ? (
                    <button type="button" onClick={() => setZoomId(a.id)} aria-label={`Enlarge preview of ${a.file.name}`} className="block size-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                      <img src={a.thumb} alt={`Preview of ${a.file.name}`} className="size-full object-contain" />
                    </button>
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      {a.state === "loading" ? <CircleNotch className="size-5 animate-spin" /> : <ImageBroken className="size-5" />}
                      <span className="px-1 text-center text-[10px] leading-tight">{a.state === "loading" ? "Preparing preview…" : "No preview"}</span>
                    </div>
                  )}
                  {a.modality && <span className="absolute bottom-1 left-1 rounded bg-foreground/70 px-1.5 py-0.5 font-mono text-[9px] text-background uppercase">{a.modality === "sar" ? "Radar" : "Optical"}</span>}
                  <button
                    type="button"
                    aria-label={`Remove ${a.file.name}`}
                    onClick={() => setImages((prev) => prev.filter((x) => x.id !== a.id))}
                    className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-foreground/75 text-background transition-colors hover:bg-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <p className="truncate text-[11px] text-muted-foreground" title={a.file.name}>
                  {a.file.name}
                </p>
              </li>
            ))}
          </ul>
        )}

        {zoom?.thumb && <ImageLightbox open onOpenChange={(o) => !o && setZoomId(null)} src={zoom.thumb} title={zoom.file.name} />}

        {(notice || hint) && (
          <p role="status" className="mx-4 mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {notice ?? hint}
          </p>
        )}

        <textarea
          ref={taRef}
          disabled={readOnly}
          value={question}
          maxLength={MAX_TEXT}
          onChange={(e) => onQuestionChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={(e) => {
            if (e.clipboardData.files.length > 0) {
              e.preventDefault()
              addFiles(e.clipboardData.files)
            }
          }}
          placeholder={readOnly ? "View only: you can read this chat, but not add to it" : busy ? "Waiting for the answer… you can keep typing your next question" : images.length > 0 || sessionCount > 0 ? "Ask a question about this imagery…" : "Ask anything, name a place, or attach a satellite image…"}
          aria-label="Your question"
          rows={1}
          className="no-scrollbar block max-h-[200px] w-full resize-none bg-transparent px-4 pt-4 pb-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter adds a new line. (Not while an input-method editor is composing text.)
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (canSend) onSend()
            }
          }}
        />

        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <div className="flex items-center gap-1.5">
            <Popover open={attachOpen} onOpenChange={setAttachOpen}>
              <PopoverTrigger aria-label="Add an image or a place" className="flex size-10 pointer-coarse:size-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <Paperclip className="size-4" />
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-1 p-2" align="start" side="top">
                <button
                  type="button"
                  onClick={() => {
                    setAttachOpen(false)
                    fileRef.current?.click()
                  }}
                  disabled={images.length >= max}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <FileArrowUp className="size-4 text-primary" />
                  <span>
                    Upload GeoTIFF
                    <span className="block text-[11px] text-muted-foreground">.tif or .tiff, or drag and drop / paste</span>
                  </span>
                </button>
                <div className="space-y-2 border-t border-border px-2 pt-2 pb-1">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MagnifyingGlass className="size-3.5" />
                    Or look at a place from orbit
                  </p>
                  <form
                    className="flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!place.trim()) return
                      applySuggestion(`Show me the land cover around ${place.trim()}`)
                      setPlace("")
                      setAttachOpen(false)
                    }}
                  >
                    <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder="City, lake, park…" aria-label="Place name" className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
                    <button type="submit" className="h-9 rounded-lg bg-primary px-3 text-xs text-primary-foreground">
                      Use
                    </button>
                  </form>
                  <div className="flex flex-wrap gap-1">
                    {POPULAR_PLACES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          applySuggestion(`Show me the land cover around ${p}`)
                          setAttachOpen(false)
                        }}
                        className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {SpeechRec && (
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={listening ? "Stop listening" : "Speak your question"}
                aria-pressed={listening}
                className={`flex size-10 pointer-coarse:size-11 items-center justify-center rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${listening ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                {listening ? <Stop className="size-4" weight="fill" /> : <Microphone className="size-4" />}
              </button>
            )}
              <Popover>
                <PopoverTrigger className="flex min-h-9 pointer-coarse:min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-foreground transition-colors hover:border-ring">
                  <Image className="size-3.5 text-primary" />
                  <span className="max-w-[8.5rem] truncate">{categoryLabel(category)}</span>
                  <CaretDown className="size-3 shrink-0" />
                </PopoverTrigger>
                <PopoverContent className="w-72 space-y-1 p-2" align="start" side="top">
                  <p className="px-2 pt-1 pb-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">What kind of question?</p>
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => chooseCategory(c.value)}
                      aria-pressed={category === c.value}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted ${category === c.value ? "bg-muted" : ""}`}
                    >
                      <Check className={`mt-0.5 size-4 shrink-0 ${category === c.value ? "text-primary" : "opacity-0"}`} />
                      <span>
                        <span className="block text-sm text-foreground">{c.label}</span>
                        <span className="block text-xs leading-snug text-muted-foreground">{c.hint}</span>
                      </span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            <input
              ref={fileRef}
              id={inputId}
              type="file"
              accept=".tif,.tiff"
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files)
                e.target.value = ""
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            {busy ? (
              <span className="hidden text-[11px] text-muted-foreground sm:block">Answer on its way. Your draft is safe.</span>
            ) : (
              <span className="hidden text-[11px] text-muted-foreground xl:block">{focused || question ? "Enter to send · Shift + Enter for a new line" : "Press / to start typing"}</span>
            )}
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label={busy ? "Waiting for the answer" : "Send message"}
              title={busy ? "One question at a time. Send again when the answer arrives." : "Send"}
              className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-30"
            >
              {busy ? <CircleNotch className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className={`flex-wrap items-center gap-1.5 ${compact ? "hidden md:flex" : "flex"}`}>
        {suggestions.map((ex, i) => {
          const Icon = CHIP_ICONS[i % CHIP_ICONS.length]
          return (
            <button
              key={ex}
              type="button"
              onClick={() => applySuggestion(ex)}
              className="flex min-h-9 pointer-coarse:min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            >
              <Icon className="size-3.5 shrink-0" />
              {ex}
            </button>
          )
        })}
        <button
          type="button"
          aria-label="Show different suggestions"
          title="Show different suggestions"
          className="flex size-9 pointer-coarse:size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={() => setSeed((s) => s + 1)}
        >
          <ArrowsClockwise className="size-3.5" />
        </button>
        <Popover>
          <PopoverTrigger className="flex min-h-9 pointer-coarse:min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground">
            <Lightbulb className="size-3.5" />
            More ideas
          </PopoverTrigger>
          <PopoverContent className="w-[min(30rem,92vw)] space-y-3 p-3" align="start" side="top">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Idea categories">
              {Object.keys(groups).map((g) => {
                const active = (ideasGroup && groups[ideasGroup] ? ideasGroup : Object.keys(groups)[0]) === g
                return (
                  <button
                    key={g}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setIdeasGroup(g)}
                    className={`min-h-8 rounded-full border px-3 text-xs transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-ring hover:text-foreground"}`}
                  >
                    {g}
                  </button>
                )
              })}
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {(groups[ideasGroup && groups[ideasGroup] ? ideasGroup : Object.keys(groups)[0]] ?? []).slice(0, 12).map((it) => (
                <button key={it} type="button" onClick={() => applySuggestion(it)} className="rounded-lg px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted">
                  {it}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
