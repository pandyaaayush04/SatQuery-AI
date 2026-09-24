import {
  ArrowsClockwise,
  ArrowUp,
  CalendarBlank,
  CaretDown,
  CircleNotch,
  Image,
  Leaf,
  Plus,
  Sparkle,
  Waves,
  X,
} from "@phosphor-icons/react"
import { useId, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { examplesFor } from "@/lib/modes"

const MAX_IMAGES = 2
const CHIP_ICONS = [Sparkle, Leaf, Waves, CalendarBlank]

function Pill({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <Popover>
      <PopoverTrigger className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        {children}
        <CaretDown className="size-3" />
      </PopoverTrigger>
      <PopoverContent className="w-56 text-xs text-muted-foreground" align="start">
        {hint}
      </PopoverContent>
    </Popover>
  )
}

export function Composer({
  images,
  onImagesChange,
  question,
  onQuestionChange,
  onSend,
  busy,
  modeLabel,
}: {
  images: File[]
  onImagesChange: (files: File[]) => void
  question: string
  onQuestionChange: (q: string) => void
  onSend: () => void
  busy: boolean
  modeLabel: string
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const examples = useMemo(() => examplesFor(images.length), [images.length])
  const canSend = question.trim().length > 0 && !busy

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).filter((f) => /\.tiff?$/i.test(f.name))
    if (incoming.length < list.length) toast.error("Only GeoTIFF (.tif/.tiff) images are supported")
    const room = MAX_IMAGES - images.length
    if (incoming.length > room) toast(`Only ${MAX_IMAGES} images per question`, { description: "Using the first ones you attached." })
    if (room > 0 && incoming.length > 0) onImagesChange([...images, ...incoming.slice(0, room)])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Pill hint="Automatically detected from the images you attach: single image, optical+SAR fusion, or before/after change.">
          <Image className="size-3.5" />
          {modeLabel}
        </Pill>
        <Pill hint="One agentic pipeline routes every question to the right tool automatically -- there's nothing to switch here yet.">
          Backend: Auto (agentic)
        </Pill>
      </div>

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
          <div className="flex gap-2 px-4 pt-4">
            {images.map((f, i) => (
              <div key={i} className="group relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                <div className="flex size-full items-center justify-center">
                  <Image className="size-6 text-muted-foreground" />
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => onImagesChange(images.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-foreground/70 text-background"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={images.length > 0 ? "Ask a question about this imagery…" : "Ask anything, or attach a satellite image to analyze…"}
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && canSend) {
              e.preventDefault()
              onSend()
            }
          }}
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Attach images"
              onClick={() => inputRef.current?.click()}
              disabled={images.length >= MAX_IMAGES}
              className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
            <label
              htmlFor={inputId}
              className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-40"
              aria-disabled={images.length >= MAX_IMAGES}
            >
              <Image className="size-4" />
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept=".tif,.tiff"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files)
                e.target.value = ""
              }}
            />
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send"
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
          >
            {busy ? <CircleNotch className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {examples.map((ex, i) => {
          const Icon = CHIP_ICONS[i % CHIP_ICONS.length]
          return (
            <button
              key={ex}
              type="button"
              onClick={() => onQuestionChange(ex)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            >
              <Icon className="size-3.5" />
              {ex}
            </button>
          )
        })}
        <button
          type="button"
          aria-label="More suggestions"
          className="flex size-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => toast("More suggestions coming soon")}
        >
          <ArrowsClockwise className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
