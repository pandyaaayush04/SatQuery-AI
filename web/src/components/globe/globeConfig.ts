// Shared visual + behaviour config for SatQueryGlobe. Kept separate from the component so future
// layers (analysis regions, change markers, footprints -- see SatQueryGlobe's props) can import
// the same constants instead of re-guessing colors/altitudes.

// Local textures shipped by the three-globe package itself (MIT licensed, copied into public/globe/
// at dev time -- see web/public/globe). Not hotlinked from a CDN, so the demo works offline too.
export const GLOBE_TEXTURE = "/globe/earth-blue-marble.jpg"
export const BUMP_TEXTURE = "/globe/earth-topology.png"

export const ATMOSPHERE_COLOR = "#A8C6B1" // --sage-400, ties the globe to the app palette instead of a generic sci-fi blue
export const ATMOSPHERE_ALTITUDE = 0.18

export const AUTO_ROTATE_SPEED = 0.35 // gentle; degrees-ish per frame at globe.gl's default damping
export const RESUME_ROTATE_AFTER_MS = 2500 // idle time after user interaction before auto-rotate resumes

export const DEFAULT_POV = { lat: 22, lng: 60, altitude: 1.3 } // wider framing (Middle East through India), matching the reference proportions -- not zoomed in tight on one region
