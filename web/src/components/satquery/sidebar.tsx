import {
  BookmarkSimple,
  ChatCircle,
  ChartBar,
  Compass,
  Database,
  Info,
  Planet,
  DotsThree,
  PushPin,
  SidebarSimple,
  UsersThree,
  Wrench,
} from "@phosphor-icons/react"
import { ContextMenu, DropdownMenu } from "radix-ui"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { AuthMode } from "./auth-dialog"
import { ChatMenu, type MenuParts } from "./chat-menu"
import { useRoute } from "@/lib/router"
import type { User } from "@/lib/auth"
import type { ChatRecord } from "@/lib/chats"
import { pinnedFirst } from "@/lib/chats"
import type { SharedItem } from "@/lib/collab"
import { cn } from "@/lib/utils"

const NAV = [
  { icon: Compass, label: "Explore" },
  { icon: BookmarkSimple, label: "Library" },
  { icon: Database, label: "Datasets" },
  { icon: Wrench, label: "Tools" },
  { icon: ChartBar, label: "Insights" },
  { icon: Info, label: "About" },
] as const

// FLIP: when the list is re-ordered (a chat was opened or a new one added), every row slides from where it was to where it now is.
function useFlip<T extends HTMLElement>(order: string) {
  const ref = useRef<T>(null)
  const before = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const next = new Map<string, number>()
    el.querySelectorAll<HTMLElement>("[data-flip]").forEach((row) => {
      const id = row.dataset.flip as string
      const top = row.getBoundingClientRect().top
      next.set(id, top)
      const was = before.current.get(id)
      if (was !== undefined && !reduce && Math.abs(was - top) > 1) {
        row.animate([{ transform: `translateY(${was - top}px)` }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" })
      }
    })
    before.current = next
  }, [order])
  return ref
}

const authBtn =
  "flex h-8 items-center rounded-lg px-3.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:h-11 pointer-coarse:px-4"

function HideButton({ onHide }: { onHide: () => void }) {
  return (
    <button
      type="button"
      onClick={onHide}
      aria-label="Hide sidebar"
      title="Hide sidebar"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <SidebarSimple className="size-4" />
    </button>
  )
}

export function Sidebar({
  onNewChat,
  onHide,
  chats,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onPin,
  onShare,
  onExport,
  shared,
  onOpenShared,
  activeSharedKey,
  user,
  onAuth,
  onSignOut,
  variant = "desktop",
}: {
  onNewChat: () => void
  onHide?: () => void
  chats: ChatRecord[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onPin: (id: string) => void
  onShare: (id: string) => void
  onExport: (id: string) => void
  shared: SharedItem[]
  onOpenShared: (item: SharedItem) => void
  activeSharedKey: string | null
  user: User | null
  onAuth: (mode: AuthMode) => void
  onSignOut: () => void
  variant?: "desktop" | "drawer" // drawer = the phone / tablet menu, which lives inside a slide-in sheet
}) {
  const { navigate } = useRoute()
  const sorted = pinnedFirst(chats) // pinned chats first, then latest activity first
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const beginRename = (c: ChatRecord) => {
    setDraft(c.title)
    setRenaming(c.id)
  }
  const commitRename = (c: ChatRecord) => {
    setRenaming(null)
    const t = draft.trim()
    if (t && t !== c.title) onRename(c.id, t)
  }
  const listRef = useFlip<HTMLUListElement>(sorted.map((c) => c.id).join("|"))
  const seen = useRef(new Set<string>())
  const ready = useRef(false)
  const fresh = (id: string) => ready.current && !seen.current.has(id) // brand-new row: slide it in
  useEffect(() => {
    sorted.forEach((c) => seen.current.add(c.id))
    ready.current = true
  })
  return (
    // z-10: sits above the page's faint contour-line layer so no lines show through the solid background
    <aside className={cn("flex h-full min-h-0 w-full flex-col overflow-hidden bg-card px-3 py-4", variant === "desktop" && "border-r border-border")}>
      <div className="flex shrink-0 items-start justify-between gap-1 pb-5">
        <button type="button" onClick={() => navigate("/")} className="flex min-w-0 items-center gap-2.5 px-2 text-left">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
            <Planet className="size-5 text-primary-foreground" weight="fill" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-lg leading-none text-foreground">SatQuery AI</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">See Beyond. Ask Without Limits.</p>
          </div>
        </button>
      </div>

      <button
        type="button"
        onClick={onNewChat}
        className="mb-4 flex shrink-0 items-center gap-2.5 rounded-lg border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary active:bg-secondary/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-11"
      >
        <ChatCircle className="size-4" />
        New Chat
      </button>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
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

      {shared.length > 0 && (
        <div className="mt-4 flex flex-col">
          <p className="px-3 pb-1.5 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Shared with me</p>
          <ul className="space-y-0.5">
            {shared.map((it) => {
              const key = `${it.ownerId}/${it.id}`
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onOpenShared(it)}
                    title={`${it.title} (shared by ${it.ownerName})`}
                    className={cn(
                      "block min-h-11 w-full rounded-lg px-3 py-1.5 text-left transition-colors duration-200 hover:bg-muted",
                      key === activeSharedKey ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="block truncate text-sm">{it.title}</span>
                    <span className="block truncate text-[11px] opacity-80">
                      {it.ownerName} · {it.role === "editor" ? "can edit" : "view only"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {chats.length > 0 && (
        <div className="mt-4 flex flex-col">
          <p className="px-3 pb-1.5 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Recents</p>
          <ul ref={listRef} className="space-y-0.5">
            {sorted.map((c) => {
              const menu = (P: MenuParts) => (
                <ChatMenu
                  P={P}
                  pinned={c.pinned}
                  onRename={() => beginRename(c)}
                  onPin={() => onPin(c.id)}
                  onShare={() => onShare(c.id)}
                  onExport={() => onExport(c.id)}
                  onDelete={() => onDelete(c.id)}
                />
              )
              return (
                <ContextMenu.Root key={c.id}>
                  <ContextMenu.Trigger asChild>
                    <li data-flip={c.id} className={cn("group relative", fresh(c.id) && "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300")}>
                      {renaming === c.id ? (
                        <input
                          value={draft}
                          maxLength={120}
                          autoFocus
                          aria-label="Chat name"
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => commitRename(c)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(c)
                            if (e.key === "Escape") setRenaming(null)
                          }}
                          className="h-11 w-full rounded-lg border border-ring bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onSelect(c.id)}
                            onDoubleClick={() => beginRename(c)}
                            title={c.title}
                            className={cn(
                              "flex min-h-11 w-full items-center gap-1.5 rounded-lg px-3 py-2.5 pr-11 text-left text-sm transition-colors duration-200 hover:bg-muted",
                              c.id === activeId ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {c.pinned && <PushPin className="size-3 shrink-0 text-primary" weight="fill" aria-label="Pinned" />}
                            <span className="truncate">{c.title}</span>
                            {!!c.shareCount && <UsersThree className="size-3.5 shrink-0 text-primary" aria-label="Shared" />}
                          </button>
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                type="button"
                                aria-label={`Options for ${c.title}`}
                                className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-100 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 pointer-coarse:size-11"
                              >
                                <DotsThree className="size-5" weight="bold" />
                              </button>
                            </DropdownMenu.Trigger>
                            {menu(DropdownMenu as unknown as MenuParts)}
                          </DropdownMenu.Root>
                        </>
                      )}
                    </li>
                  </ContextMenu.Trigger>
                  {menu(ContextMenu as unknown as MenuParts)}
                </ContextMenu.Root>
              )
            })}
          </ul>
        </div>
      )}
      </div>

      {/* Always the last thing in the column, whatever the screen height or however many chats there are. */}
      <div className="mt-2 shrink-0 space-y-3 border-t border-border pt-3">
        <div className="space-y-0.5">
          <p className="px-2 text-xs text-muted-foreground">Powered by SatQuery AI</p>
          <p className="px-2 font-serif text-sm text-foreground italic">"Earth's data. A better tomorrow."</p>
        </div>
        {/* The profile stays the last thing in the column. The hide button sits beside it, outside the profile box. */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {user ? (
              // Signed in: the profile card (picture or initials, name, sign out).
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-2 py-1.5">
                {user.picture ? (
                  <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-7 shrink-0 rounded-full" />
                ) : (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-medium text-primary-foreground">
                    {(user.name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <p className="min-w-0 flex-1 truncate text-sm text-foreground">{user.name ?? user.email}</p>
                <button type="button" onClick={onSignOut} className="shrink-0 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-11">
                  Sign out
                </button>
              </div>
            ) : (
              // Nobody signed in: no "Guest" profile, just two small quiet links on one line.
              <div className="flex items-center gap-2 px-1" title="Sign in to save your chats and open them on any device">
                <button type="button" onClick={() => onAuth("login")} className={authBtn + " bg-primary text-primary-foreground shadow-sm hover:opacity-90"}>
                  Log in
                </button>
                <button type="button" onClick={() => onAuth("register")} className={authBtn + " border border-primary/30 bg-card text-primary hover:border-primary/60 hover:bg-secondary"}>
                  Register
                </button>
                <span className="flex-1" />
              </div>
            )}
          </div>
          {variant === "desktop" && onHide && <HideButton onHide={onHide} />}
        </div>
      </div>
    </aside>
  )
}
