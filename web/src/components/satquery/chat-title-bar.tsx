import { Eye, PencilSimple, ShareNetwork, UsersThree } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import type { Role } from "@/lib/collab"

// Floats over the top of the chat: the chat's name (click to rename) on the left, Share on the right. No background bar, so messages
// keep the whole screen.
export function ChatTitleBar({
  title,
  canRename,
  onRename,
  onShare,
  peopleCount,
  role,
  ownerName,
}: {
  title: string
  canRename: boolean
  onRename: (title: string) => void
  onShare: () => void
  peopleCount: number // people the chat is shared with (0 = private)
  role: Role
  ownerName?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    setEditing(false)
    const t = draft.trim()
    if (t && t !== title) onRename(t)
    else setDraft(title)
  }

  const chip = "pointer-events-auto flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 text-xs text-foreground shadow-sm backdrop-blur-sm transition-colors pointer-coarse:min-h-11"
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-2 sm:px-8 md:pr-14">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          maxLength={120}
          autoFocus
          aria-label="Chat name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") {
              setDraft(title)
              setEditing(false)
            }
          }}
          className="pointer-events-auto h-9 w-[min(22rem,60%)] rounded-full border border-ring bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11"
        />
      ) : (
        <button
          type="button"
          disabled={!canRename}
          onClick={() => {
            setDraft(title)
            setEditing(true)
          }}
          title={canRename ? "Rename this chat" : ownerName ? `Shared by ${ownerName}` : title}
          className={`${chip} max-w-[60%] ${canRename ? "hover:bg-muted" : "cursor-default"}`}
        >
          <span className="truncate">{title}</span>
          {canRename && <PencilSimple className="size-3 shrink-0 text-muted-foreground" />}
        </button>
      )}
      <div className="pointer-events-auto flex items-center gap-1.5">
        {role === "viewer" && (
          <span className={`${chip} text-muted-foreground`}>
            <Eye className="size-3.5" />
            View only
          </span>
        )}
        <button type="button" onClick={onShare} className={`${chip} hover:bg-muted`} aria-label={peopleCount > 0 ? `Share this chat. Shared with ${peopleCount} ${peopleCount === 1 ? "person" : "people"}` : "Share this chat"}>
          {peopleCount > 0 || role !== "owner" ? <UsersThree className="size-4 text-primary" /> : <ShareNetwork className="size-4" />}
          <span className="hidden sm:inline">{peopleCount > 0 ? `Shared · ${peopleCount}` : role === "owner" ? "Share" : "People"}</span>
        </button>
      </div>
    </div>
  )
}
