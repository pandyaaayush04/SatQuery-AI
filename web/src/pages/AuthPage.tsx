import { ArrowLeft, Planet } from "@phosphor-icons/react"
import { AuthForm } from "@/components/satquery/auth-form"
import { Button } from "@/components/ui/button"
import { useRoute } from "@/lib/router"
import { useAuth } from "@/lib/useAuth"

// One page for both /login and /signup: Google or email + password. The mode picks register vs log in for the email form
// (Google creates the account on first sign-in either way) and changes the wording and the switch link.
export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { navigate } = useRoute()
  const auth = useAuth()
  const { user, signOut } = auth
  const signup = mode === "signup"

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="contour-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      <button
        type="button"
        onClick={() => navigate("/")}
        className="absolute top-5 left-5 z-10 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      <div className={`relative z-10 w-full space-y-6 rounded-2xl border border-border bg-card p-6 smooth-shadow-ring-sm sm:p-8 ${signup ? "max-w-2xl" : "max-w-sm"}`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary">
            <Planet className="size-6 text-primary-foreground" weight="fill" />
          </div>
          <div className="space-y-1">
            <h1 className="font-serif text-3xl leading-tight text-foreground">
              {user ? "You're signed in" : signup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user
                ? `Signed in as ${user.email ?? user.name}.`
                : signup
                  ? "Save your chats and open them on any device."
                  : "Log in to pick up your saved chats."}
            </p>
          </div>
        </div>

        {user ? (
          <div className="space-y-2">
            <Button className="w-full" onClick={() => navigate("/app")}>
              Open SatQuery
            </Button>
            <Button variant="ghost" className="w-full" onClick={signOut}>
              Sign out
            </Button>
          </div>
        ) : (
          <AuthForm key={mode} mode={signup ? "register" : "login"} auth={auth} onDone={() => navigate("/app")} />
        )}

        <div className="space-y-2 border-t border-border pt-4 text-center text-sm">
          {!user && (
            <p className="text-muted-foreground">
              {signup ? "Already have an account? " : "New here? "}
              <button type="button" onClick={() => navigate(signup ? "/login" : "/signup")} className="font-medium text-primary underline-offset-2 hover:underline">
                {signup ? "Log in" : "Sign up"}
              </button>
            </p>
          )}
          <button type="button" onClick={() => navigate("/app")} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {user ? "Skip to the app" : "Continue as a guest"}
          </button>
        </div>
      </div>
    </div>
  )
}
