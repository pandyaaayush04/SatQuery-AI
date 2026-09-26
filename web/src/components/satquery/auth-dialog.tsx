import { AuthForm } from "@/components/satquery/auth-form"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Auth } from "@/lib/useAuth"

export type AuthMode = "login" | "register"

// The register / log in modal, used from the landing page nav and from the chat app's sidebar.
export function AuthDialog({ mode, onModeChange, auth, onDone }: { mode: AuthMode | null; onModeChange: (m: AuthMode | null) => void; auth: Auth; onDone: () => void }) {
  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && onModeChange(null)}>
      <DialogContent className={`max-h-[94svh] no-scrollbar gap-4 overflow-y-auto p-6 ${mode === "register" ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
        <DialogHeader className="items-center text-center">
          <DialogTitle className="font-serif text-2xl font-normal">{mode === "register" ? "Create your account" : "Welcome back"}</DialogTitle>
          <DialogDescription>{mode === "register" ? "Save your chats and open them on any device." : "Log in to pick up your saved chats."}</DialogDescription>
        </DialogHeader>
        {mode && <AuthForm key={mode} mode={mode} auth={auth} onDone={onDone} />}
        <p className="text-center text-sm text-muted-foreground">
          {mode === "register" ? "Already have an account? " : "New here? "}
          <button type="button" onClick={() => onModeChange(mode === "register" ? "login" : "register")} className="font-medium text-primary underline-offset-2 hover:underline">
            {mode === "register" ? "Log in" : "Register"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  )
}
