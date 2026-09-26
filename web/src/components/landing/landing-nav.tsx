import { CaretDown, Planet, SignIn, UserPlus } from "@phosphor-icons/react"
import { useState } from "react"
import { DropdownMenu } from "radix-ui"
import { AuthDialog, type AuthMode } from "@/components/satquery/auth-dialog"
import { Button } from "@/components/ui/button"
import { useRoute } from "@/lib/router"
import { useAuth } from "@/lib/useAuth"

const LINKS = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#explore", label: "Use Cases" },
  { href: "#vision", label: "About" },
]

export function LandingNav({ onLaunch }: { onLaunch: () => void }) {
  const { navigate } = useRoute()
  const auth = useAuth()
  const { user, loading } = auth
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
        <a href="#" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary">
            <Planet className="size-4 text-primary-foreground" weight="fill" />
          </div>
          <div>
            <p className="font-serif text-base leading-none text-foreground">SatQuery AI</p>
            <p className="text-[10px] leading-tight text-muted-foreground">See Beyond. Ask Without Limits.</p>
          </div>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {!loading && user ? (
            <button type="button" onClick={onLaunch} className="hidden items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm text-foreground transition-colors hover:bg-muted sm:flex">
              {user.picture ? (
                <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-7 rounded-full" />
              ) : (
                <span className="flex size-7 items-center justify-center rounded-full bg-primary font-mono text-[11px] text-primary-foreground">
                  {(user.name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="max-w-32 truncate">{user.name ?? user.email}</span>
            </button>
          ) : (
            !loading && (
              // modal={false}: a modal menu that opens a Dialog can leave pointer-events stuck on <body> (known Radix quirk)
              <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" className="h-11 gap-1.5 sm:h-9">
                    Log in
                    <CaretDown className="size-3.5" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-50 min-w-52 rounded-xl border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
                  >
                    <DropdownMenu.Item
                      onSelect={() => setAuthMode("register")}
                      className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 outline-none data-highlighted:bg-muted"
                    >
                      <UserPlus className="size-4 text-muted-foreground" />
                      New user? Register
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => setAuthMode("login")}
                      className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 outline-none data-highlighted:bg-muted"
                    >
                      <SignIn className="size-4 text-muted-foreground" />
                      Log in
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )
          )}
          <Button onClick={onLaunch}>Try Now</Button>
        </div>
      </div>

      <AuthDialog mode={authMode} onModeChange={setAuthMode} auth={auth} onDone={() => navigate("/app")} />
    </header>
  )
}
