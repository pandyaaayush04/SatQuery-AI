import { useState } from "react"
import { GoogleSignIn } from "@/components/satquery/google-signin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { useAuth } from "@/lib/useAuth"

// Google button + email/password form, shared by the landing-page modal and the /login, /signup page.
export function AuthForm({ mode, auth, onDone }: { mode: "login" | "register"; auth: ReturnType<typeof useAuth>; onDone: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const register = mode === "register"

  async function run(fn: () => Promise<unknown>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
      onDone()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.charAt(0).toUpperCase() + msg.slice(1))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex min-h-10 justify-center">
        {auth.clientId ? (
          <GoogleSignIn clientId={auth.clientId} onCredential={(c) => run(() => auth.signIn(c))} label={register ? "signup_with" : "signin_with"} />
        ) : (
          !auth.loading && <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">Google sign-in isn't set up on this server. Use email instead.</p>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => auth.signInWithPassword(mode, email, password))
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={`${mode}-email`}>Email</Label>
          <Input id={`${mode}-email`} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${mode}-password`}>Password</Label>
          <Input
            id={`${mode}-password`}
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 8 : undefined}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={register ? `${mode}-password-hint` : undefined}
            className="h-11"
          />
          {register && (
            <p id={`${mode}-password-hint`} className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Log in"}
        </Button>
      </form>
    </div>
  )
}
