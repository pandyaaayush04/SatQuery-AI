import { SatQueryGlobe } from "@/components/globe/SatQueryGlobe"

export function Hero() {
  return (
    // overflow visible (not hidden) on purpose: the globe below is now taller than this row and is
    // allowed to bleed down into the composer's space -- the composer's own opaque card paints over
    // it there (later in DOM order), so it just reads as "the Earth sits behind the interface."
    <div className="flex min-h-0 flex-1">
      <div className="motion-safe:fade-in motion-safe:animate-in motion-safe:duration-300 min-w-0 flex-1 space-y-4 px-4 pt-10 sm:px-8 lg:pt-16">
        <h1 className="font-serif text-4xl leading-[1.1] text-foreground sm:text-5xl">
          Earth Speaks in Images.
          <br />
          <span className="text-primary">You Ask, We Understand.</span>
        </h1>
        <p className="max-w-md text-base text-muted-foreground sm:text-lg">
          Interact with satellite imagery using natural language. Get evidence-backed insights, verified against the
          sensor data itself.
        </p>
      </div>

      {/* A real flex column, not an absolutely-positioned overlay -- the text column above can never
         collide with it, at any viewport width. Sized by width alone (aspect-square derives height
         from it) so it's free to run taller than this row and bleed downward. */}
      <div className="relative hidden w-[50%] max-w-[640px] shrink-0 items-start justify-center pt-10 sm:flex">
        {/* rounded-full always yields a true circle here since the box is forced square by
           aspect-square -- its diameter tracks whatever size max-w resolves to, at every breakpoint,
           with no separate radius value to keep in sync. Shifted right by exactly half its own width
           (a transform, so it doesn't affect layout/collision with the text column) so only its left
           half is visible -- half a globe sitting in from the screen's right edge, not a full disc. */}
        <div className="relative aspect-square w-full translate-x-1/2 overflow-hidden rounded-full">
          <SatQueryGlobe offset={[0, 0]} className="size-full [&>div]:size-full" />
          {/* Gentle fade at the sphere's own edge into the page background, using the actual
             background token (not a raw white) so it matches exactly. Kept subtle -- it's a soft
             blend, not a wash over the texture. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(circle, transparent 66%, var(--paper) 97%)" }}
          />
        </div>
      </div>
    </div>
  )
}
