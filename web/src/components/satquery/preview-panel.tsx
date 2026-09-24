import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { overlayUrl, previewUrl } from "@/lib/api"
import type { SessionFile } from "@/lib/types"

export function PreviewPanel({
  sessionId,
  files,
  box,
  overlayAvailable,
}: {
  sessionId: string
  files: SessionFile[]
  box?: [number, number, number, number] | null
  overlayAvailable?: boolean
}) {
  const [showOverlay, setShowOverlay] = useState(true)
  const valid = files.filter((f) => f.modality)

  return (
    <div className="space-y-2">
      <div className={valid.length > 1 ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
        {valid.map((f) => (
          <figure key={f.index} className="relative overflow-hidden rounded-xl border border-border bg-card smooth-shadow-ring-xs">
            <img src={previewUrl(sessionId, f.index)} alt={`${f.modality} preview: ${f.name}`} className="aspect-square w-full object-cover" />
            {overlayAvailable && showOverlay && f.index === valid[valid.length - 1].index && (
              <img src={overlayUrl(sessionId)} alt="Change overlay" className="pointer-events-none absolute inset-0 aspect-square w-full object-cover" />
            )}
            {box && f.index === valid[0].index && (
              <div
                className="absolute rounded-sm border-2 border-primary bg-primary/10"
                style={{
                  left: `${box[0] * 100}%`,
                  top: `${box[1] * 100}%`,
                  width: `${(box[2] - box[0]) * 100}%`,
                  height: `${(box[3] - box[1]) * 100}%`,
                }}
              />
            )}
            <Badge variant="secondary" className="absolute top-2 left-2 font-mono text-[10px] uppercase">
              {f.modality}
            </Badge>
          </figure>
        ))}
      </div>
      {overlayAvailable && (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowOverlay((v) => !v)}>
          {showOverlay ? "Hide" : "Show"} change map
        </Button>
      )}
    </div>
  )
}
