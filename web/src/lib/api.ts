import type { ChatResponse, SessionResponse, Trace } from "./types"

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

export function createSession(files: File[]): Promise<SessionResponse> {
  const form = new FormData()
  files.forEach((f) => form.append("files", f))
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
