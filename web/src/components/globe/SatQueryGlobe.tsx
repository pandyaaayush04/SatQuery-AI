import type { GlobeMethods } from "react-globe.gl"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { ATMOSPHERE_ALTITUDE, ATMOSPHERE_COLOR, AUTO_ROTATE_SPEED, BUMP_TEXTURE, DEFAULT_POV, GLOBE_TEXTURE, RESUME_ROTATE_AFTER_MS } from "./globeConfig"
import { buildSatelliteModel, loadSatellites, orbitPaths, SPEED, updatePositions, type OrbitPath, type Sat } from "./satellites"

// WebGL/three.js is a heavy dependency (~600kB) -- lazy-load it so the rest of the UI paints first.
const Globe = lazy(() => import("react-globe.gl"))

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

const GLOBE_R = 100 // three-globe units
const FOV_HALF_TAN = Math.tan((25 * Math.PI) / 180) // globe.gl's default camera is 50 deg

/** Globe silhouette radius as a fraction of the canvas half-height, for a camera at `distance` from the centre. */
const silhouetteFraction = (distance: number) => (GLOBE_R * distance) / Math.sqrt(distance * distance - GLOBE_R * GLOBE_R) / (distance * FOV_HALF_TAN)

/**
 * Decorative, interactive Earth for the SatQuery hero background. Reusable and data-free for now --
 * later analysis layers (regions, change markers, footprints) plug in via react-globe.gl's own
 * pointsData/polygonsData/htmlElementsData props, passed straight through as SatQueryGlobe props
 * once there's a real result to plot (see satquery/controller.py's evidence shape).
 *
 * `satellites` adds real satellites (TLE data -> satellite.js -> objectsData/pathsData). They fly above the surface, so the
 * canvas must be larger than the globe or the rim would clip them: pass `viewScale` (canvas size / globe size, e.g. 1.45).
 * The camera pulls back by that ratio so the globe keeps exactly its normal on-screen size, and the soft white edge that
 * used to come from a clipping wrapper is drawn here instead (see `fade`).
 */
export function SatQueryGlobe({
  offset = [90, -60] as [number, number],
  className,
  satellites = false,
  viewScale = 1,
}: {
  offset?: [number, number]
  className?: string
  satellites?: boolean
  viewScale?: number
}) {
  const [containerRef, { width, height }] = useElementSize<HTMLDivElement>()
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [ready, setReady] = useState(false) // canvas stays invisible until the camera is set, so the far-away default framing is never seen
  const resumeTimer = useRef<number>(undefined)
  const reducedMotion = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)

  // Camera height that makes the globe the same on-screen size in a canvas `viewScale` times larger (distance scales with the canvas).
  const distance = GLOBE_R * (1 + DEFAULT_POV.altitude) * viewScale
  const povAltitude = distance / GLOBE_R - 1

  // ---- satellites
  const sats = useRef<Sat[]>([])
  const [, setTick] = useState(0)
  const [paths, setPaths] = useState<OrbitPath[]>([])
  useEffect(() => {
    if (!satellites) return
    let raf = 0
    let alive = true
    let simTime = Date.now()
    let last = performance.now()
    let lastPaths = 0
    loadSatellites()
      .then((loaded) => {
        if (!alive) return
        sats.current = loaded
        const frame = (now: number) => {
          if (!alive) return
          if (!reducedMotion.current) simTime += (now - last) * SPEED // reduced motion: satellites hold their positions
          last = now
          updatePositions(sats.current, new Date(simTime))
          if (now - lastPaths > 3000) {
            lastPaths = now
            setPaths(orbitPaths(sats.current, new Date(simTime)))
          }
          setTick((t) => t + 1)
          raf = reducedMotion.current ? 0 : requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
      })
      .catch(() => {
        /* no TLE file / offline: the globe simply shows no satellites */
      })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [satellites])

  function setAutoRotate(on: boolean) {
    const controls = globeRef.current?.controls()
    if (controls && !reducedMotion.current) controls.autoRotate = on
  }

  // Camera + controls setup. Runs from the polling effect below (as soon as the globe instance exists) and again from onGlobeReady, whichever
  // comes first: relying on onGlobeReady alone raced the ref being attached, so the setup was sometimes skipped and the globe stayed
  // at globe.gl's far-out default camera (small) -- that was the "globe looks small when opened" bug.
  const configured = useRef(false)
  function configure(g: GlobeMethods) {
    if (configured.current) return
    configured.current = true
    g.pointOfView({ ...DEFAULT_POV, altitude: povAltitude }, 0) // instant: globe.gl starts far out (altitude 2.5), so animating in from there made the globe open small and visibly grow
    const controls = g.controls()
    controls.enablePan = false
    controls.minDistance = 110 // globe radius is 100; stay close so the view stays India-only
    controls.maxDistance = Math.max(260, distance + 30) // cap how far a user can zoom out, so dragging can't reveal the whole globe
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED
    controls.autoRotate = !reducedMotion.current
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2)) // cap DPR: a 3x/4x phone panel shouldn't render 3x the pixels for a decorative element
  }

  // The ref is typed as an object ref (no callback form), so poll briefly for the instance instead of waiting on onGlobeReady alone.
  useEffect(() => {
    if (width === 0) return
    let raf = 0
    let tries = 0
    const poll = () => {
      if (globeRef.current) return configure(globeRef.current)
      if (++tries < 300) raf = requestAnimationFrame(poll)
    }
    poll()
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width > 0])

  function handleReady() {
    if (globeRef.current) configure(globeRef.current)
    setReady(true)
  }

  function pauseThenResume() {
    setAutoRotate(false)
    window.clearTimeout(resumeTimer.current)
    resumeTimer.current = window.setTimeout(() => setAutoRotate(true), RESUME_ROTATE_AFTER_MS)
  }

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 2500) // never leave the canvas invisible if onGlobeReady is slow or missed
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => () => window.clearTimeout(resumeTimer.current), [])

  // Only the globe's own disc is interactive. The canvas is up to 1.45x the globe (room for satellites), and OrbitControls listen on
  // the whole canvas, so drags and wheel-scrolls on the empty margin used to spin/zoom the globe by accident. Capture-phase listeners
  // on the wrapper run before the canvas's own, so stopping the event here means OrbitControls never sees it (and the page scrolls).
  // assumes globeOffset is in screen px (+x right, +y down); every caller passes [0, 0] today.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const filter = (e: PointerEvent | WheelEvent) => {
      const g = globeRef.current
      const r = el.getBoundingClientRect()
      const radius = g ? (silhouetteFraction(g.camera().position.length()) * r.height) / 2 : 0
      const dx = e.clientX - (r.left + r.width / 2 + offset[0])
      const dy = e.clientY - (r.top + r.height / 2 + offset[1])
      if (dx * dx + dy * dy > radius * radius) e.stopPropagation()
      else pauseThenResume()
    }
    el.addEventListener("pointerdown", filter, true)
    el.addEventListener("wheel", filter, true)
    return () => {
      el.removeEventListener("pointerdown", filter, true)
      el.removeEventListener("wheel", filter, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset[0], offset[1]])

  // Soft white rim, same stops the hero's clipping wrapper used, but placed relative to the globe's own silhouette (S) so it
  // lands on the globe edge at any viewScale. Percentages are of the canvas half-size (closest-side).
  const S = silhouetteFraction(distance) * 100
  const fade = `radial-gradient(circle closest-side, transparent ${S * 0.94}%, color-mix(in oklab, var(--paper) 6%, transparent) ${S * 0.955}%, color-mix(in oklab, var(--paper) 16%, transparent) ${S * 0.97}%, color-mix(in oklab, var(--paper) 28%, transparent) ${S * 0.985}%, color-mix(in oklab, var(--paper) 38%, transparent) ${S}%, transparent ${S + 1.5}%)`

  return (
    <div
      ref={containerRef}
      className={`${className ?? ""} relative transition-opacity duration-500 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`}
    >
      {width > 0 && (
        <Suspense fallback={null}>
          <Globe
            ref={globeRef}
            width={width}
            height={height}
            globeImageUrl={GLOBE_TEXTURE}
            bumpImageUrl={BUMP_TEXTURE}
            globeOffset={offset}
            backgroundColor="rgba(0,0,0,0)"
            rendererConfig={{ alpha: true, antialias: true }}
            showAtmosphere={!satellites} // the atmosphere glow used to be clipped away by the wrapper; with no wrapper it would show as a halo
            atmosphereColor={ATMOSPHERE_COLOR}
            atmosphereAltitude={ATMOSPHERE_ALTITUDE}
            onGlobeReady={handleReady}
            objectsData={satellites ? sats.current.slice() : []}
            objectLat="lat"
            objectLng="lng"
            objectAltitude="alt"
            objectFacesSurfaces
            objectThreeObject={buildSatelliteModel}
            pathsData={satellites ? paths : []}
            pathPoints="pts"
            pathPointLat={(p: unknown) => (p as number[])[0]}
            pathPointLng={(p: unknown) => (p as number[])[1]}
            pathPointAlt={(p: unknown) => (p as number[])[2]}
            pathColor={() => ["rgba(168,198,177,0.02)", "rgba(200,225,210,0.32)", "rgba(168,198,177,0.02)"]}
            pathTransitionDuration={0}
          />
        </Suspense>
      )}
      {satellites && <div className="pointer-events-none absolute inset-0" style={{ background: fade }} />}
    </div>
  )
}
