import { ArrowsOut } from "@phosphor-icons/react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { overlayUrl, previewUrl } from "@/lib/api"
import type { SessionFile } from "@/lib/types"
import { ImageLightbox } from "./lightbox"

type Box = [number, number, number, number]

export function PreviewPanel({
  sessionId,
  files,
  box,
  overlayAvailable,
}: {
  sessionId: string
  files: SessionFile[]
  box?: Box | null
  overlayAvailable?: boolean
}) {
  const [showOverlay, setShowOverlay] = useState(true)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const valid = files.filter((f) => f.modality)
  if (!valid.length) return null
  const lastIndex = valid[valid.length - 1].index
  const firstIndex = valid[0].index

  // The change map goes on the later image, the bounding box on the first: same layers in the small tile and the enlarged view.
  const layers = (index: number) => (
    <>
      {overlayAvailable && showOverlay && index === lastIndex && <img src={overlayUrl(sessionId)} alt="Change map" className="pointer-events-none absolute inset-0 size-full object-contain" />}
      {box && index === firstIndex && (
        <div
          className="absolute rounded-sm border-2 border-primary bg-primary/10"
          style={{ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${(box[2] - box[0]) * 100}%`, height: `${(box[3] - box[1]) * 100}%` }}
        />
      )}
    </>
  )

  const open = valid.find((f) => f.index === openIndex)

  return (
    <div className="flex flex-wrap items-end gap-3">
      {valid.map((f) => (
        <figure key={f.index} className="w-36 space-y-1.5 sm:w-44">
          <button
            type="button"
            onClick={() => setOpenIndex(f.index)}
            aria-label={`Enlarge ${f.modality} preview of ${f.name}`}
            className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted smooth-shadow-ring-xs focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <img src={previewUrl(sessionId, f.index)} alt={`${f.modality} preview: ${f.name}`} className="size-full object-contain" />
            {layers(f.index)}
            <Badge variant="secondary" className="absolute top-2 left-2 font-mono text-[10px] uppercase">
              {f.modality === "sar" ? "Radar" : "Optical"}
            </Badge>
            <span className="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full bg-foreground/70 text-background opacity-90 transition-opacity group-hover:opacity-100">
              <ArrowsOut className="size-3.5" />
            </span>
          </button>
          <figcaption className="truncate text-[11px] text-muted-foreground" title={f.name}>
            {f.name}
          </figcaption>
        </figure>
      ))}
      {overlayAvailable && (
        <Button type="button" variant="outline" size="sm" className="mb-6 h-9" onClick={() => setShowOverlay((v) => !v)}>
          {showOverlay ? "Hide" : "Show"} change map
        </Button>
      )}
      {open && (
        <ImageLightbox open onOpenChange={(o) => !o && setOpenIndex(null)} src={previewUrl(sessionId, open.index)} title={`${open.modality === "sar" ? "Radar" : "Optical"} · ${open.name}`}>
          {layers(open.index)}
        </ImageLightbox>
      )}
    </div>
  )
}
