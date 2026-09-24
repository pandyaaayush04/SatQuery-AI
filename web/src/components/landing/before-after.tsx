import { CaretLeft, CaretRight } from "@phosphor-icons/react"

// Static split view: `before` fills the left half, `after` the right, with a lit divider and handle.
export function BeforeAfter({ before, after, beforeLabel, afterLabel }: { before: string; after: string; beforeLabel: string; afterLabel: string }) {
  return (
    <div className="relative size-full overflow-hidden">
      <img src={after} alt="" className="absolute inset-0 size-full object-cover" />
      <img src={before} alt="" className="absolute inset-0 size-full object-cover" style={{ clipPath: "inset(0 50% 0 0)" }} />

      <span className="absolute top-2 left-2 rounded-full bg-[var(--teal-950)]/70 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary-foreground backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="absolute top-2 right-2 rounded-full bg-[var(--teal-950)]/70 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary-foreground backdrop-blur-sm">
        {afterLabel}
      </span>

      <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary-foreground shadow-[0_0_10px_2px_rgb(0_0_0/0.35)]" />
      <div className="absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-primary-foreground text-primary shadow-lg ring-4 ring-primary-foreground/30">
        <CaretLeft className="size-3" weight="bold" />
        <CaretRight className="size-3" weight="bold" />
      </div>
    </div>
  )
}
