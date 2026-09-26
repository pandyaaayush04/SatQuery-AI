import { Check, Link as LinkIcon, SignOut, UserPlus, X } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { getLive, inviteLink, shareChat, unshareChat, type Member } from "@/lib/collab"

const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/
const say = (e: unknown) => (e instanceof Error ? e.message : String(e))

// Share a chat with co-workers. The owner invites people by email (editors can add to the chat, viewers can only read it); people
// sign in with that email and find the chat under "Shared with me". Everyone works on the same copy.
export function ShareDialog({
  open,
  onOpenChange,
  chatId,
  chatTitle,
  ownerId,
  isOwner,
  myEmail,
  ensureSaved,
  onMembers,
  onLeft,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  chatId: string | null
  chatTitle: string
  ownerId: string
  isOwner: boolean
  myEmail?: string | null
  ensureSaved: () => Promise<void> // the owner's chat must exist on the server before anyone can be invited to it
  onMembers: (members: Member[]) => void
  onLeft: () => void
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"editor" | "viewer">("editor")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open || !chatId) return
    let stop = false
    setError(null)
    ;(async () => {
      try {
        if (isOwner) await ensureSaved()
        const r = await getLive(ownerId, chatId)
        if (!stop) {
          setMembers(r.members)
          onMembers(r.members)
        }
      } catch {
        if (!stop) setMembers([])
      }
    })()
    return () => {
      stop = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chatId])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!chatId) return
    const addr = email.trim().toLowerCase()
    if (!EMAIL_RE.test(addr)) return setError("Enter your co-worker's email address, like name@example.com.")
    setBusy(true)
    setError(null)
    try {
      await ensureSaved()
      const r = await shareChat(chatId, addr, role)
      setMembers(r.members)
      onMembers(r.members)
      setEmail("")
    } catch (err) {
      setError(say(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(addr: string) {
    if (!chatId) return
    try {
      const r = await unshareChat(chatId, addr)
      setMembers(r.members)
      onMembers(r.members)
    } catch (err) {
      setError(say(err))
    }
  }

  async function leave() {
    if (!chatId || !myEmail) return
    try {
      await unshareChat(chatId, myEmail, ownerId)
      onOpenChange(false)
      onLeft()
    } catch (err) {
      setError(say(err))
    }
  }

  async function copyLink() {
    if (!chatId) return
    try {
      await navigator.clipboard.writeText(inviteLink(ownerId, chatId))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError("Couldn't copy the link. Please copy it from the address bar after opening the chat.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="no-scrollbar max-h-[92svh] gap-4 overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate pr-8 font-serif text-xl font-normal">{isOwner ? "Share this chat" : "People in this chat"}</DialogTitle>
          <DialogDescription className="truncate">{chatTitle}</DialogDescription>
        </DialogHeader>

        {isOwner && (
          <form onSubmit={invite} className="space-y-2" noValidate>
            <label htmlFor="share-email" className="text-sm font-medium text-foreground">
              Add a co-worker by email
            </label>
            <div className="flex gap-2">
              <Input id="share-email" type="email" autoComplete="off" spellCheck={false} maxLength={254} placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 min-w-0 flex-1" aria-invalid={!!error} />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
                aria-label="What they can do"
                className="h-11 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="editor">Can edit</option>
                <option value="viewer">View only</option>
              </select>
            </div>
            <Button type="submit" className="h-11 w-full gap-2" disabled={busy || !email.trim()}>
              <UserPlus className="size-4" />
              {busy ? "Adding…" : "Add to this chat"}
            </Button>
            <p className="text-xs text-muted-foreground">They sign in (or register) with that email and open the chat from "Shared with me". Editors can ask questions and edit; viewers can only read.</p>
          </form>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">{members.length ? `People with access (${members.length})` : "Not shared with anyone yet"}</p>
          <ul className="space-y-1">
            {members.map((m) => (
              <li key={m.email} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">{m.name || m.email}</span>
                  {m.name && <span className="block truncate text-xs text-muted-foreground">{m.email}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{m.role === "editor" ? "Can edit" : "View only"}</span>
                {isOwner && (
                  <button type="button" onClick={() => remove(m.email)} aria-label={`Remove ${m.email}`} className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:size-11">
                    <X className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1 gap-2" onClick={copyLink}>
            {copied ? <Check className="size-4 text-primary" weight="bold" /> : <LinkIcon className="size-4" />}
            {copied ? "Link copied" : "Copy link"}
          </Button>
          {!isOwner && (
            <Button type="button" variant="ghost" className="h-11 gap-2 text-destructive" onClick={leave}>
              <SignOut className="size-4" />
              Leave chat
            </Button>
          )}
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">The link only opens for people you've added, once they sign in with the invited email.</p>
      </DialogContent>
    </Dialog>
  )
}
