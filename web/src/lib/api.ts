import type { ChatResponse, SessionResponse, Trace } from "./types"

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(typeof body?.detail === "string" ? body.detail : `${res.status} ${res.statusText}`)
  }
  return res.json()
}

/** `mode` is the category the user picked in the composer ("auto" lets the server work it out from the files). */
export function createSession(files: File[], mode: string = "auto"): Promise<SessionResponse> {
  const form = new FormData()
  files.forEach((f) => form.append("files", f))
  form.append("mode", mode)
  return fetch("/api/session", { method: "POST", body: form }).then(unwrap<SessionResponse>)
}

export function previewUrl(sessionId: string, index: number): string {
  return `/api/preview/${sessionId}/${index}`
}

export function overlayUrl(sessionId: string): string {
  return `/api/overlay/${sessionId}`
}

export function ask(sessionId: string, question: string): Promise<Trace> {
  return fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, question }),
  }).then(unwrap<Trace>)
}

export function chat(text: string, sessionId: string | null, history: { role: string; text: string }[]): Promise<ChatResponse> {
  return fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, session_id: sessionId, history }),
  }).then(unwrap<ChatResponse>)
}

export function closeSession(sessionId: string): void {
  // fire-and-forget cleanup (keepalive survives page unload); not critical if it never lands -- temp dirs, not user data
  fetch(`/api/session/${sessionId}`, { method: "DELETE", keepalive: true }).catch(() => {})
}

/** Small preview of a GeoTIFF (browsers can't draw .tif themselves), as a data URL so it can be stored with the chat. */
export async function thumbnail(file: File): Promise<{ url: string; modality: "optical" | "sar" | null }> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch("/api/thumb", { method: "POST", body: form })
  if (!res.ok) throw new Error("preview unavailable")
  const blob = await res.blob()
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
  const m = res.headers.get("X-Modality")
  return { url, modality: m === "optical" || m === "sar" ? m : null }
}

/** Turn whatever went wrong into a sentence a non-technical person can act on. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/failed to fetch|networkerror|load failed|network request/i.test(msg)) return "We couldn't reach the SatQuery server. Please check your internet connection and try again."
  if (/^5\d\d\b|internal server error|bad gateway|\b(502|504|530)\b/i.test(msg)) return "The server is busy or restarting. Please give it a moment and try again."
  if (/not found \(server may have restarted\)/i.test(msg)) return "Your image session expired because the server restarted. Please attach the image again."
  return msg
}
