import type { ChatRecord } from "./chats"

export interface User {
  id: string
  email: string | null
  name: string | null
  picture: string | null
}

export class AuthError extends Error {
  code?: "email_not_verified"
  constructor(message: string, code?: "email_not_verified") {
    super(message)
    this.code = code
  }
}

export async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const d = body?.detail
    if (d === "email_not_verified") throw new AuthError("Your email isn't verified yet. We've sent you a new code.", "email_not_verified")
    throw new AuthError(typeof d === "string" ? d : Array.isArray(d) ? "Please check the details you entered and try again." : `${res.status} ${res.statusText}`)
  }
  return res.json()
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {
    throw new AuthError("We couldn't reach the server. Please check your connection and try again.")
  })

/** Google OAuth client id the backend is configured with (null = sign-in not set up; the app then runs guest-only). */
export const getConfig = () => fetch("/api/config").then(json<{ google_client_id: string | null }>)

export const getMe = () => fetch("/api/me").then(json<{ user: User | null }>).then((r) => r.user)

export const googleLogin = (credential: string) =>
  fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) })
    .then(json<{ user: User }>)
    .then((r) => r.user)

export interface CodeSent {
  email: string
  delivery: "email" | "console" | "shown"
  dev_code?: string
}

export const login = (email: string, password: string) =>
  post("/api/auth/login", { email, password })
    .then(json<{ user: User }>)
    .then((r) => r.user)

/** Creates the account (not yet signed in) and sends a 6-digit code to the address. */
export const register = (email: string, password: string, name: string) => post("/api/auth/register", { email, password, name }).then(json<CodeSent & { needs_verification: true }>)

export const verifyEmail = (email: string, code: string) =>
  post("/api/auth/verify", { email, code })
    .then(json<{ user: User }>)
    .then((r) => r.user)

export const resendCode = (email: string) => post("/api/auth/resend", { email }).then(json<{ ok: boolean; delivery: CodeSent["delivery"]; dev_code?: string }>)

/** Asks for a password-reset code. Always answers the same way, whether or not the email has an account. */
export const forgotPassword = (email: string) => post("/api/auth/forgot", { email }).then(json<{ ok: boolean; delivery: CodeSent["delivery"]; dev_code?: string }>)

export const resetPassword = (email: string, code: string, password: string) =>
  post("/api/auth/reset", { email, code, password })
    .then(json<{ user: User }>)
    .then((r) => r.user)

export const logout = () => fetch("/api/auth/logout", { method: "POST" }).then(() => undefined)

/** Save just a chat's name / pin (no messages): quick, and independent of the chat's size. */
export const patchChatMeta = (id: string, meta: { title?: string; pinned?: boolean; custom_title?: boolean }) =>
  fetch(`/api/chats/${encodeURIComponent(id)}/meta`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta) })
    .catch(() => {
      throw new AuthError("We couldn't reach the server.")
    })
    .then(json<{ ok: boolean }>)

// Server-side chat history for signed-in users (guests keep theirs in localStorage only -- see lib/chats.ts).
export const fetchChats = () => fetch("/api/chats").then(json<ChatRecord[]>)

export const pushChat = (c: ChatRecord) =>
  fetch(`/api/chats/${encodeURIComponent(c.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: c.title, updated_at: c.updatedAt, messages: c.messages, pinned: !!c.pinned, custom_title: !!c.customTitle }),
  }).then(json<{ ok: boolean; rev: number }>)

export const removeChat = (id: string) => fetch(`/api/chats/${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => undefined)
