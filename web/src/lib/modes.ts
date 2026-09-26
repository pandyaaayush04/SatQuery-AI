import type { Mode } from "./types"

export const MODE_LABEL: Record<Mode, string> = {
  single: "Single image",
  cross_modal: "Optical + SAR fusion",
  bitemporal: "Before / after change",
}

/** What the person picks in the composer. "auto" lets the server decide from the attached files. */
export type Category = "auto" | Mode

export const CATEGORIES: { value: Category; label: string; hint: string; maxImages: number }[] = [
  { value: "auto", label: "Auto-detect", hint: "We look at the files you attach and pick the right kind of analysis for you.", maxImages: 2 },
  { value: "single", label: "Single image", hint: "Ask about one satellite image: what's in it, where things are, how much water or greenery.", maxImages: 1 },
  { value: "cross_modal", label: "Optical + SAR fusion", hint: "Attach two images of the same place: one normal (optical) and one radar (SAR). We combine both.", maxImages: 2 },
  { value: "bitemporal", label: "Before / after change", hint: "Attach two images of the same place from different dates to see what changed and where.", maxImages: 2 },
]

export const maxImagesFor = (c: Category) => CATEGORIES.find((x) => x.value === c)?.maxImages ?? 2
export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.value === c)?.label ?? "Auto-detect"

/** A gentle nudge when the attached files don't match the chosen category yet (null = all good). */
export function categoryHint(c: Category, attached: number): string | null {
  if (c === "cross_modal" && attached === 1) return "Fusion needs two images of the same place: one optical and one radar (SAR)."
  if (c === "bitemporal" && attached === 1) return "Before / after needs two images of the same place from different dates."
  return null
}

// ---- Suggestions. Grouped so the "More ideas" panel can browse them, and shuffled so the refresh button always has something new.
type Groups = Record<string, string[]>

const PLACES: Groups = {
  "Cities and growth": [
    "Show me the land cover around Pune",
    "How has Dubai changed since last year?",
    "Is Bengaluru getting more built-up?",
    "How much of Navi Mumbai is built-up?",
    "Show me the land cover around Hyderabad",
    "How has Gurugram changed since last year?",
    "Land cover around Singapore",
    "How has Amaravati changed since last year?",
    "Show me the built-up area around Ahmedabad",
    "How has Nairobi changed since last year?",
    "Land cover around Chennai",
    "Show me the urban area around Cairo",
  ],
  "Water and rivers": [
    "Tell me about Lake Victoria",
    "How much water is there around Chilika Lake?",
    "Show me the water around Hirakud Reservoir",
    "Land cover around Guwahati",
    "How has Lake Mead changed since last year?",
    "Show me the water around Damietta",
    "How much water is around Vembanad Lake?",
    "Land cover around Pangong Lake",
    "Has Lake Chad changed since last year?",
    "Show me the water around Sardar Sarovar Dam",
  ],
  "Farming and forests": [
    "How much vegetation is there around Kaziranga?",
    "Show me the farmland around Ludhiana",
    "Land cover around Munnar",
    "How much vegetation is around Jim Corbett?",
    "Show me the land cover around the Sundarbans",
    "Land cover around Nashik",
    "How green is the area around Coorg?",
    "Show me the vegetation around Thanjavur",
    "Land cover around Manaus",
    "How has Santa Cruz de la Sierra changed since last year?",
  ],
  "Coasts, deserts and islands": [
    "Land cover around the Rann of Kutch",
    "Show me the coast around Visakhapatnam",
    "Land cover around Port Blair",
    "Show me the land cover around Goa",
    "Land cover around Kavaratti",
    "Show me the desert around Jaisalmer",
    "Land cover around Palm Jumeirah",
    "Show me the land cover around Kochi",
  ],
  "Ask me anything": [
    "Hi! What can you do?",
    "Tell me about the Sundarbans",
    "What kinds of questions can I ask?",
    "How does radar see through clouds?",
    "What is NDVI?",
    "Which satellites do you use?",
  ],
}

const SINGLE: Groups = {
  "What's in it": [
    "Describe the land cover in this image.",
    "Is there water present in this image?",
    "Is there built-up area in this image?",
    "Is there any vegetation in this image?",
    "Which season does this scene look like?",
    "Which climate zone does this scene look like?",
  ],
  "Where is it": [
    "Point out the largest water body.",
    "Point out the largest built-up area.",
    "Point out the largest forested area.",
    "Where is the most farmland?",
    "Is farmland next to water in this scene?",
    "Are there roads or buildings near the water?",
  ],
}

const FUSION: Groups = {
  "Use both sensors": [
    "Use both images together to identify water and built-up areas.",
    "Is there water in this scene?",
    "Is there vegetation in this scene?",
    "Is there built-up area in this scene?",
    "Does the radar image confirm the water seen in the optical image?",
    "Describe what the radar shows compared with the optical image.",
  ],
}

const CHANGE: Groups = {
  "What changed": [
    "What changed between these two dates, and where?",
    "Has the built-up area increased or decreased?",
    "Did vegetation decrease between the two dates?",
    "Has water increased since the earlier image?",
    "Which region changed the most?",
    "Summarise the changes in one sentence.",
    "Is there any sign of new construction?",
    "Did any water body shrink or grow?",
  ],
}

/** Groups of ideas for what is currently attached / chosen. */
export function suggestionGroups(category: Category, attached: number): Groups {
  if (category === "single") return attached > 0 ? SINGLE : PLACES
  if (category === "cross_modal") return attached > 0 ? FUSION : PLACES
  if (category === "bitemporal") return attached > 0 ? CHANGE : { ...PLACES, "Cities and growth": PLACES["Cities and growth"].filter((s) => /changed/i.test(s)) }
  if (attached >= 2) return { ...CHANGE, ...FUSION }
  if (attached === 1) return SINGLE
  return PLACES
}

// Small deterministic shuffle: same seed, same picks (no flicker on re-render); bump the seed to get a fresh set.
function rng(seed: number) {
  let t = seed + 0x6d2b79f5
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pickSuggestions(groups: Groups, seed: number, n = 4): string[] {
  const all = Object.values(groups).flat()
  const r = rng(seed * 7919 + all.length)
  const pool = [...all]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

/** Popular places for the "Search a place" shortcut in the attach menu. */
export const POPULAR_PLACES = ["Pune", "Dubai", "Bengaluru", "Chilika Lake", "Kaziranga", "Sundarbans", "Goa", "Singapore", "Lake Victoria", "Nile Delta"]
