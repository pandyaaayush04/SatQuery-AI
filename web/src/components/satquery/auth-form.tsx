import { CheckCircle, Circle, Eye, EyeSlash, LockKey } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { GoogleSignIn } from "@/components/satquery/google-signin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthError, type CodeSent } from "@/lib/auth"
import type { Auth } from "@/lib/useAuth"

const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/
const COMMON = new Set(["password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123", "iloveyou1", "admin123", "welcome1", "welcome123", "abc12345", "abcd1234", "passw0rd"])
const RESEND_SECONDS = 60

const emailError = (v: string) => (!v.trim() ? "Enter your email address." : !EMAIL_RE.test(v.trim()) || v.trim().length > 254 ? "That doesn't look like a valid email, e.g. name@example.com." : null)
const nameError = (v: string) => (v.trim() && (v.trim().length < 2 || v.trim().length > 60 || /[<>{}[\]\\/@]/.test(v)) ? "Use 2 to 60 letters, without special symbols." : null)

function rules(pw: string, email: string) {
  return [
    { ok: pw.length >= 8 && pw.length <= 128, label: "8 to 128 characters" },
    { ok: /[A-Za-z]/.test(pw), label: "At least one letter" },
    { ok: /\d/.test(pw), label: "At least one number" },
    { ok: !!pw && !COMMON.has(pw.toLowerCase()) && pw.toLowerCase() !== email.trim().toLowerCase().split("@")[0], label: "Not a common password" },
  ]
}

function PasswordField({ id, label, value, onChange, onBlur, error, autoComplete, describedBy }: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: string | null
  autoComplete: string
  describedBy?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={128}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-describedby={[error ? `${id}-err` : "", describedBy ?? ""].join(" ").trim() || undefined}
          className="h-11 pr-11"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {show ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function DeliveryNote({ sent }: { sent: CodeSent | null }) {
  if (sent?.delivery === "console") return <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Email delivery isn't set up on this server yet. The site owner can read your code in the server's console.</p>
  if (sent?.delivery === "shown" && sent.dev_code)
    return (
      <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
        Demo mode: your code is <strong className="font-mono text-sm tracking-widest text-foreground">{sent.dev_code}</strong>
      </p>
    )
  return null
}

function maskEmail(e: string) {
  const [u, d] = e.split("@")
  return u.length <= 2 ? `${u[0] ?? ""}*@${d}` : `${u[0]}${"*".repeat(Math.min(u.length - 2, 6))}${u.slice(-1)}@${d}`
}

// Google button + email/password form + the email-verification step, shared by the landing-page modal, the /login page and the chat app.
export function AuthForm({ mode, auth, onDone }: { mode: "login" | "register"; auth: Auth; onDone: () => void }) {
  const register = mode === "register"
  const [step, setStep] = useState<"form" | "verify" | "forgot" | "reset">("form")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState("")
  const [sent, setSent] = useState<CodeSent | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }))
  const pwRules = rules(password, email)
  const errs = {
    name: nameError(name),
    email: emailError(email),
    password: !password ? "Enter your password." : register && !pwRules.every((r) => r.ok) ? "Your password doesn't meet all the requirements below." : null,
    confirm: register && confirm !== password ? "The two passwords don't match." : null,
  }
  const show = (k: keyof typeof errs) => (touched[k] ? errs[k] : null)
  const strength = pwRules.filter((r) => r.ok).length + (password.length >= 12 ? 1 : 0)

  async function run(fn: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      if (e instanceof AuthError && e.code === "email_not_verified") {
        setSent({ email: email.trim().toLowerCase(), delivery: "email" })
        setCooldown(RESEND_SECONDS)
        setStep("verify")
        setError(e.message)
      } else setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ name: true, email: true, password: true, confirm: true })
    if (errs.email || errs.password || errs.confirm || (register && errs.name)) return
    run(async () => {
      if (register) {
        const r = await auth.signUp(email.trim(), password, name.trim())
        setSent(r)
        setCooldown(RESEND_SECONDS)
        setStep("verify")
      } else {
        await auth.logIn(email.trim(), password)
        onDone()
      }
    })
  }

  function verify(c: string) {
    if (c.length !== 6) return setError("Enter the 6-digit code from your email.")
    run(async () => {
      await auth.verify(email.trim(), c)
      onDone()
    })
  }

  async function resend() {
    setError(null)
    try {
      const r = await auth.resend(email.trim())
      setSent({ email: email.trim().toLowerCase(), delivery: r.delivery, dev_code: r.dev_code })
      setCooldown(RESEND_SECONDS)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function startForgot() {
    setPassword("")
    setConfirm("")
    setTouched({})
    setCode("")
    setError(null)
    setStep("forgot")
  }

  function sendReset(e?: React.FormEvent) {
    e?.preventDefault()
    setTouched((t) => ({ ...t, email: true }))
    if (errs.email) return
    run(async () => {
      const r = await auth.forgot(email.trim())
      setSent({ email: email.trim().toLowerCase(), delivery: r.delivery, dev_code: r.dev_code })
      setCooldown(RESEND_SECONDS)
      setStep("reset")
    })
  }

  function submitReset(e: React.FormEvent) {
    e.preventDefault()
    setTouched((t) => ({ ...t, password: true, confirm: true }))
    if (code.length !== 6) return setError("Enter the 6-digit code from your email.")
    if (!pwRules.every((r) => r.ok) || confirm !== password) return setError(null)
    run(async () => {
      await auth.reset(email.trim(), code, password)
      onDone()
    })
  }

  if (step === "forgot") {
    return (
      <form className="mx-auto w-full max-w-sm space-y-4" onSubmit={sendReset} noValidate>
        <p className="text-center text-sm text-muted-foreground">Enter the email you signed up with and we'll send you a code to choose a new password.</p>
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email">Email</Label>
          <Input id="forgot-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => touch("email")} aria-invalid={!!show("email")} className="h-11" />
          {show("email") && <p role="alert" className="text-xs text-destructive">{show("email")}</p>}
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset code"}
        </Button>
        <button type="button" onClick={() => { setStep("form"); setError(null) }} className="block w-full text-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Back to log in
        </button>
      </form>
    )
  }

  if (step === "reset") {
    return (
      <form className="mx-auto w-full max-w-sm space-y-4" onSubmit={submitReset} noValidate>
        <div className="space-y-1 text-center">
          <p className="text-sm text-foreground">If there's an account for <strong>{maskEmail(sent?.email ?? email)}</strong>, we've sent it a 6-digit code.</p>
          <p className="text-xs text-muted-foreground">It stays valid for 10 minutes. Check your spam folder if you can't see it.</p>
        </div>
        <DeliveryNote sent={sent} />
        <div className="space-y-1.5">
          <Label htmlFor="reset-code">Reset code</Label>
          <Input
            id="reset-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="h-12 text-center font-mono text-xl tracking-[0.5em]"
          />
        </div>
        <PasswordField id="reset-password" label="New password" value={password} onChange={setPassword} onBlur={() => touch("password")} autoComplete="new-password" describedBy="reset-rules" />
        <ul id="reset-rules" className="space-y-1 text-xs">
          {pwRules.map((r) => (
            <li key={r.label} className={`flex items-center gap-1.5 ${r.ok ? "text-primary" : "text-muted-foreground"}`}>
              {r.ok ? <CheckCircle className="size-3.5" weight="fill" /> : <Circle className="size-3.5" />}
              {r.label}
            </li>
          ))}
        </ul>
        <PasswordField id="reset-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} onBlur={() => touch("confirm")} error={show("confirm")} autoComplete="new-password" />
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full" disabled={busy || code.length !== 6 || !pwRules.every((r) => r.ok) || confirm !== password}>
          {busy ? "Saving…" : "Set new password and log in"}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={() => { setStep("form"); setError(null) }} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Back to log in
          </button>
          <button type="button" onClick={() => sendReset()} disabled={cooldown > 0 || busy} className="font-medium text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline">
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </form>
    )
  }

  if (step === "verify") {
    return (
      <div className="mx-auto w-full max-w-sm space-y-4">
        <div className="space-y-1 text-center">
          <p className="text-sm text-foreground">
            We sent a 6-digit code to <strong>{maskEmail(sent?.email ?? email)}</strong>.
          </p>
          <p className="text-xs text-muted-foreground">It stays valid for 10 minutes. Check your spam folder if you can't see it.</p>
        </div>
        <DeliveryNote sent={sent} />
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            verify(code)
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="verify-code">Verification code</Label>
            <Input
              id="verify-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6)
                setCode(v)
                if (v.length === 6) verify(v)
              }}
              placeholder="000000"
              aria-invalid={!!error}
              className="h-12 text-center font-mono text-xl tracking-[0.5em]"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="h-11 w-full" disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : "Verify and continue"}
          </Button>
        </form>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={() => { setStep("form"); setCode(""); setError(null) }} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Use a different email
          </button>
          <button type="button" onClick={resend} disabled={cooldown > 0} className="font-medium text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline">
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </div>
    )
  }

  const span = register ? "md:col-span-2" : ""
  return (
    <div className="space-y-3">
      <div className="flex min-h-10 justify-center">
        {auth.clientId ? (
          <GoogleSignIn
            clientId={auth.clientId}
            onCredential={(c) => run(async () => { await auth.signIn(c); onDone() })}
            label={register ? "signup_with" : "signin_with"}
          />
        ) : (
          !auth.loading && <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">Google sign-in isn't set up on this server. Use email instead.</p>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Register is wide: name + email side by side, password + confirmation side by side, then the checklist as one row. */}
      <form className={register ? "grid gap-x-5 gap-y-3 md:grid-cols-2" : "space-y-3"} onSubmit={submit} noValidate>
        {register && (
          <div className="space-y-1.5">
            <Label htmlFor={`${mode}-name`}>
              Name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id={`${mode}-name`} autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch("name")} aria-invalid={!!show("name")} className="h-11" />
            {show("name") && <p role="alert" className="text-xs text-destructive">{show("name")}</p>}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`${mode}-email`}>Email</Label>
          <Input
            id={`${mode}-email`}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => touch("email")}
            aria-invalid={!!show("email")}
            aria-describedby={show("email") ? `${mode}-email-err` : undefined}
            className="h-11"
          />
          {show("email") && <p id={`${mode}-email-err`} role="alert" className="text-xs text-destructive">{show("email")}</p>}
        </div>
        <PasswordField
          id={`${mode}-password`}
          label="Password"
          value={password}
          onChange={setPassword}
          onBlur={() => touch("password")}
          error={register ? null : show("password")}
          autoComplete={register ? "new-password" : "current-password"}
          describedBy={register ? `${mode}-rules` : undefined}
        />
        {register && <PasswordField id="register-confirm" label="Confirm password" value={confirm} onChange={setConfirm} onBlur={() => touch("confirm")} error={show("confirm")} autoComplete="new-password" />}
        {!register && (
          <div className="-mt-1 text-right">
            <button type="button" onClick={startForgot} className="inline-flex min-h-8 items-center text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              Forgot password?
            </button>
          </div>
        )}
        {register && (
          <ul id={`${mode}-rules`} className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs md:col-span-2">
            {pwRules.map((r) => (
              <li key={r.label} className={`flex items-center gap-1.5 ${r.ok ? "text-primary" : "text-muted-foreground"}`}>
                {r.ok ? <CheckCircle className="size-3.5" weight="fill" /> : <Circle className="size-3.5" />}
                {r.label}
              </li>
            ))}
            <li aria-hidden="true" className="flex basis-full items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${i <= strength ? (strength <= 2 ? "bg-destructive" : strength <= 4 ? "bg-warning" : "bg-primary") : "bg-muted"}`} />
              ))}
            </li>
          </ul>
        )}
        {error && (
          <p role="alert" className={`rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ${span}`}>
            {error}
          </p>
        )}
        <Button type="submit" className={`h-11 w-full ${span}`} disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Log in"}
        </Button>
        <p className={`flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground ${span}`}>
          <LockKey className="size-3.5" />
          {register ? "We email you a code to confirm it's you. " : ""}Passwords are encrypted before they're stored.
        </p>
      </form>
    </div>
  )
}
