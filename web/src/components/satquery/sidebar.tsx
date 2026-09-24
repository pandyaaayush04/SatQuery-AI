import {
  BookmarkSimple,
  ChatCircle,
  ChartBar,
  Compass,
  Database,
  Info,
  Planet,
  SidebarSimple,
  Trash,
  Wrench,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useRoute } from "@/lib/router"
import type { User } from "@/lib/auth"
import type { ChatRecord } from "@/lib/chats"
import { GoogleSignIn } from "./google-signin"
import { cn } from "@/lib/utils"

const NAV = [
  { icon: Compass, label: "Explore" },
  { icon: BookmarkSimple, label: "Library" },
  { icon: Database, label: "Datasets" },
  { icon: Wrench, label: "Tools" },
  { icon: ChartBar, label: "Insights" },
  { icon: Info, label: "About" },
] as const

export function Sidebar({
  onNewChat,
  chatActive,
  onHide,
  chats,
  activeId,
  onSelect,
  onDelete,
  user,
  googleClientId,
  onCredential,
  onSignOut,
}: {
  onNewChat: () => void
  chatActive: boolean
  onHide: () => void
  chats: ChatRecord[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  user: User | null
  googleClientId: string | null // null = sign-in not configured on the server: guest-only
  onCredential: (credential: string) => void
  onSignOut: () => void
}) {
  const { navigate } = useRoute()
  return (
    // z-10: sits above the page's faint contour-line layer so no lines show through the solid background
    <aside className="relative z-10 hidden w-64 shrink-0 flex-col border-r border-border bg-card px-3 py-4 md:flex">
      <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2.5 px-2 pb-5 text-left">
        <div className="flex size-9 items-center justify-center rounded-full bg-primary">
          <Planet className="size-5 text-primary-foreground" weight="fill" />
        </div>
        <div>
          <p className="font-serif text-lg leading-none text-foreground">SatQuery AI</p>
          <p className="text-[11px] leading-tight text-muted-foreground">See Beyond. Ask Without Limits.</p>
        </div>
      </button>

      <button
        type="button"
        onClick={onNewChat}
        className={cn(
          "mb-4 flex items-center gap-2.5 rounded-lg border border-primary/15 bg-secondary px-3 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80",
          !chatActive && "border-transparent bg-transparent hover:bg-secondary",
        )}
      >
        <ChatCircle className="size-4" weight={chatActive ? "regular" : "fill"} />
        New Chat
      </button>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => toast("Coming soon", { description: `${label} isn't built yet.` })}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      {chats.length > 0 && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <p className="px-3 pb-1.5 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Recents</p>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {chats.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  title={c.title}
                  className={cn(
                    "block w-full truncate rounded-lg px-3 py-2 pr-9 text-left text-sm transition-colors hover:bg-muted",
                    c.id === activeId ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  aria-label={`Delete chat: ${c.title}`}
                  className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                >
                  <Trash className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={cn("space-y-3 border-t border-border pt-3", chats.length === 0 && "mt-auto")}>
        {!user && googleClientId && (
          <div className="space-y-1.5 px-2">
            <GoogleSignIn clientId={googleClientId} onCredential={onCredential} />
            <p className="text-[11px] leading-snug text-muted-foreground">Sign in to save your chats and open them on any device.</p>
          </div>
        )}
        <div className="flex items-center gap-2 px-2">
          {user?.picture ? (
            <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full" />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-medium text-primary-foreground">
              {user ? (user.name ?? user.email ?? "?").slice(0, 2).toUpperCase() : "G"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">{user ? (user.name ?? user.email) : "Guest"}</p>
            {user && (
              <button type="button" onClick={onSignOut} className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                Sign out
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onHide}
            aria-label="Hide sidebar"
            title="Hide sidebar"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SidebarSimple className="size-4" />
          </button>
        </div>
        <p className="px-2 text-xs text-muted-foreground">Powered by SatQuery AI</p>
        <p className="px-2 font-serif text-sm text-foreground italic">"Earth's data. A better tomorrow."</p>
      </div>
    </aside>
  )
}
