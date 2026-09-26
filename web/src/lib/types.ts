export type Mode = "single" | "cross_modal" | "bitemporal"
export type FindingLevel = "INFO" | "WARN" | "BLOCK"

export interface Finding {
  level: FindingLevel
  code: string
  msg: string
}

export interface SessionFile {
  index: number
  name: string
  modality: "optical" | "sar" | null
}

export interface SessionResponse {
  session_id: string
  ok: boolean
  mode: Mode
  findings: Finding[]
  files: SessionFile[]
}

export interface PhysicsTest {
  coverage: number
  says: "present" | "absent" | "ambiguous"
}

export interface PhysicsEvidence {
  verdict: "supports" | "contradicts" | "inconclusive" | "unavailable"
  tests: Record<string, PhysicsTest>
  why?: string
}

export interface ChangeRegion {
  area_pct: number
  where: string
  bbox: [number, number, number, number]
}

export interface ChangeTrend {
  before_pct: number
  after_pct: number
  trend: "increased" | "decreased" | "unchanged"
}

export interface ChangeEvidence {
  available: boolean
  why?: string
  changed_pct?: number
  regions?: ChangeRegion[]
  trends?: Record<string, ChangeTrend>
}

export interface PlaceInfo {
  name: string
  display: string
  lat: number
  lon: number
  country?: string | null
  wiki?: string | null
  stats?: Partial<Record<"vegetation" | "water" | "built", number>> | null
  when?: string
  before_when?: string | null
  cloud_pct?: number
  km?: number
  source?: string
}

export interface ChatResponse {
  kind: "chat" | "place" | "image"
  reply?: string
  trace?: Trace | null
  place?: PlaceInfo
  session?: SessionResponse
}

/** One version of an edited question, with everything that came after it in the chat (its answers and any follow-ups). */
export interface Branch {
  text: string
  imageThumbs?: { name: string; url: string; modality?: "optical" | "sar" | null }[]
  tail: ChatMessage[]
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text?: string
  reply?: string
  place?: PlaceInfo
  author?: string // in a shared chat: the name of the person who asked
  imageNames?: string[] // older saved chats; newer ones carry imageThumbs
  imageThumbs?: { name: string; url: string; modality?: "optical" | "sar" | null }[] // small JPEG data URLs, so previews survive a reload
  trace?: Trace
  error?: string
  pending?: boolean
  branches?: Branch[] // on a question that has been edited: every version of it (the entry for the shown version has a stale tail until you switch)
  branchIndex?: number // which version is showing
}

export interface Trace {
  task: string | null
  mode: Mode
  tools: string[]
  findings: Finding[]
  answer: string | null
  confidence: number | null
  evidence: {
    physics?: PhysicsEvidence
    change?: ChangeEvidence
    box?: [number, number, number, number] | null
    per_sensor?: Record<string, string>
  }
}

/** A file the person has attached but not yet sent, with the small preview the server drew for it. */
export interface Attached {
  id: string
  file: File
  state: "loading" | "ready" | "error"
  thumb?: string
  modality?: "optical" | "sar" | null
}
