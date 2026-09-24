import type { ChatRecord } from "./chats"

export interface User {
  id: string
  email: string | null
  name: string | null
  picture: string | null
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

/** Google OAuth client id the backend is configured with (null = sign-in not set up; the app then runs guest-only). */
export const getConfig = () => fetch("/api/config").then(json<{ google_client_id: string | null }>)

export const getMe = () => fetch("/api/me").then(json<{ user: User | null }>).then((r) => r.user)

export const googleLogin = (credential: string) =>
  fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) })
    .then(json<{ user: User }>)
    .then((r) => r.user)

/** Email + password: "register" creates the account (and signs in), "login" signs in to an existing one. */
export const passwordAuth = (mode: "login" | "register", email: string, password: string) =>
  fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })
    .then(json<{ user: User }>)
    .then((r) => r.user)

export const logout = () => fetch("/api/auth/logout", { method: "POST" }).then(() => undefined)

// Server-side chat history for signed-in users (guests keep theirs in localStorage only -- see lib/chats.ts).
export const fetchChats = () => fetch("/api/chats").then(json<ChatRecord[]>)

export const pushChat = (c: ChatRecord) =>
  fetch(`/api/chats/${encodeURIComponent(c.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: c.title, updated_at: c.updatedAt, messages: c.messages }),
  }).then(json<{ ok: boolean }>)

export const removeChat = (id: string) => fetch(`/api/chats/${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => undefined)
