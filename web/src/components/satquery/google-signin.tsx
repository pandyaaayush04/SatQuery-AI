import { useEffect, useRef } from "react"

// Google Identity Services: renders Google's own "Sign in with Google" button and hands back a signed ID token (JWT), which the
// backend verifies (server/auth.py). Only the public client id is needed here -- there is no secret in the browser.
interface GoogleId {
  initialize(cfg: { client_id: string; callback: (r: { credential: string }) => void }): void
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

const SRC = "https://accounts.google.com/gsi/client"

function loadGsi(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`)
    const s = existing ?? Object.assign(document.createElement("script"), { src: SRC, async: true })
    s.addEventListener("load", () => resolve(), { once: true })
    s.addEventListener("error", () => reject(new Error("Couldn't load Google sign-in")), { once: true })
    if (!existing) document.head.appendChild(s)
  })
}

export function GoogleSignIn({
  clientId,
  onCredential,
  label = "signin_with",
}: {
  clientId: string
  onCredential: (credential: string) => void
  label?: "signin_with" | "signup_with" | "continue_with"
}) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onCredential)
  cb.current = onCredential

  useEffect(() => {
    let cancelled = false
    loadGsi()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) })
        window.google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", shape: "pill", text: label, width: 216 })
      })
      .catch(() => {
        /* offline / blocked: the button just doesn't appear; the app still works as a guest */
      })
    return () => {
      cancelled = true
    }
  }, [clientId, label])

  return <div ref={ref} className="min-h-10" />
}
