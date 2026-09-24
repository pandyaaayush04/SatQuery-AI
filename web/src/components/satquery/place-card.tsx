import { MapPin } from "@phosphor-icons/react"
import type { PlaceInfo } from "@/lib/types"

const STAT_LABEL = { vegetation: "Vegetation", water: "Water", built: "Built-up" } as const

export function PlaceCard({ place }: { place: PlaceInfo }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 smooth-shadow-ring-xs">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" weight="fill" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {place.name}
            {place.country ? `, ${place.country}` : ""}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {place.lat.toFixed(3)}° N, {place.lon.toFixed(3)}° E
            {place.when && ` · Sentinel-2, ${place.before_when ? `${place.before_when} → ${place.when}` : place.when} · ${place.cloud_pct}% cloud · ${place.km}×${place.km} km`}
          </p>
        </div>
      </div>

      {place.wiki && <p className="text-xs leading-relaxed text-muted-foreground">{place.wiki}</p>}

      {place.stats && (
        <div className="space-y-1.5">
          {(Object.keys(STAT_LABEL) as (keyof typeof STAT_LABEL)[]).map(
            (k) =>
              place.stats?.[k] !== undefined && (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 text-muted-foreground">{STAT_LABEL[k]}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, place.stats[k] ?? 0)}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-muted-foreground">{place.stats[k]}%</span>
                </div>
              ),
          )}
          <p className="text-[11px] text-muted-foreground">Share of the scene matching each spectral index (NDVI, NDWI, NDBI), latest clear image.</p>
        </div>
      )}
    </div>
  )
}
