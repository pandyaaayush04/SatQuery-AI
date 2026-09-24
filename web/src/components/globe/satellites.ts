import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate, twoline2satrec, type SatRec } from "satellite.js"
import { AdditiveBlending, Group, Mesh, MeshBasicMaterial, SphereGeometry } from "three"

// Real satellites on the globe, following react-globe.gl's satellites example: TLE orbit data -> satellite.js (SGP4) ->
// lat/lng/altitude -> globe.gl's objectsData (the 3D model) and pathsData (the orbit). Positions are true orbital
// positions; simulated time runs faster than real time (SPEED) so the motion is visible on a landing page.
export const TLE_URL = "/globe/satellites-tle.txt" // snapshot from CelesTrak; refresh with curl "https://celestrak.org/NORAD/elements/gp.php?CATNR=<id>&FORMAT=tle"
export const SPEED = 24 // sim seconds per real second: a ~100-minute orbit takes ~4 real minutes (slow = smooth)
const EARTH_KM = 6371
const DOT_RADIUS = 0.85
const PATH_MINUTES = 50 // orbit drawn from -50 to +50 sim minutes around the satellite (about one full orbit)
const PATH_POINTS = 72

// A handful of the file's satellites, mostly the Earth-observation ones this product is about; the rest stay in the file for later.
const SHOW = ["SENTINEL-1A", "SENTINEL-1C", "SENTINEL-2A", "SENTINEL-2B", "LANDSAT 9", "AQUA", "CARTOSAT-3", "ISS (ZARYA)"]

export interface Sat {
  name: string
  rec: SatRec
  lat: number
  lng: number
  alt: number // fraction of globe radius
}
export interface OrbitPath {
  name: string
  pts: [number, number, number][]
}

export async function loadSatellites(): Promise<Sat[]> {
  const text = await (await fetch(TLE_URL)).text()
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean)
  const sats: Sat[] = []
  for (let i = 0; i + 2 < lines.length; i += 3) {
    try {
      if (!SHOW.includes(lines[i].trim())) continue
      sats.push({ name: lines[i].trim(), rec: twoline2satrec(lines[i + 1], lines[i + 2]), lat: 0, lng: 0, alt: 1 })
    } catch {
      /* skip a malformed record rather than lose the whole layer */
    }
  }
  return sats
}

function locate(rec: SatRec, date: Date): [number, number, number] | null {
  const pv = propagate(rec, date)
  if (!pv || !pv.position) return null
  const gd = eciToGeodetic(pv.position, gstime(date))
  return [degreesLat(gd.latitude), degreesLong(gd.longitude), gd.height / EARTH_KM]
}

/** Move every satellite to its position at `date`. Mutates in place so globe.gl keeps reusing the same 3D objects. */
export function updatePositions(sats: Sat[], date: Date) {
  for (const s of sats) {
    const p = locate(s.rec, date)
    if (p) [s.lat, s.lng, s.alt] = p
  }
}

export function orbitPaths(sats: Sat[], date: Date): OrbitPath[] {
  return sats.map((s) => {
    const pts: [number, number, number][] = []
    for (let i = 0; i < PATH_POINTS; i++) {
      const dt = ((i / (PATH_POINTS - 1)) * 2 - 1) * PATH_MINUTES * 60_000
      const p = locate(s.rec, new Date(date.getTime() + dt))
      if (p) pts.push(p)
    }
    return { name: s.name, pts }
  })
}

/** A satellite as a small bright dot with a soft halo (unlit materials, so it reads the same from any angle). */
export function buildSatelliteModel() {
  const dot = new Group()
  dot.add(new Mesh(new SphereGeometry(DOT_RADIUS, 12, 12), new MeshBasicMaterial({ color: 0xffffff })))
  dot.add(new Mesh(new SphereGeometry(DOT_RADIUS * 2.4, 12, 12), new MeshBasicMaterial({ color: 0xa8c6b1, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false })))
  return dot
}
