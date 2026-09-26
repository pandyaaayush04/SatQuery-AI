import { List, Plus, Rocket, SidebarSimple } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AuthDialog, type AuthMode } from "@/components/satquery/auth-dialog"
import { ChatThread } from "@/components/satquery/chat-thread"
import { ChatTitleBar } from "@/components/satquery/chat-title-bar"
import { Composer } from "@/components/satquery/composer"
import { Hero } from "@/components/satquery/hero"
import { ShareDialog } from "@/components/satquery/share-dialog"
import { Sidebar } from "@/components/satquery/sidebar"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Toaster } from "@/components/ui/sonner"
import { chat, closeSession, createSession, friendlyError } from "@/lib/api"
import { fetchChats, patchChatMeta, pushChat, removeChat } from "@/lib/auth"
import { chatToMarkdown, downloadText, fileNameFor } from "@/lib/chatExport"
import { bumpChat, loadChats, pinnedFirst, renameIn, saveChats, titleFrom, togglePinIn, upsertChat, type ChatRecord } from "@/lib/chats"
import { getLive, getShared, putLive, type LiveChat, type Member, type Role, type SharedItem } from "@/lib/collab"
import { transition } from "@/lib/motion"
import type { Category } from "@/lib/modes"
import type { Attached, Branch, ChatMessage, SessionResponse } from "@/lib/types"
import { useAuth } from "@/lib/useAuth"

const uid = () => crypto.randomUUID() // unique across reloads too: restored history must never collide with new message ids

function App() {
  const auth = useAuth()
  const user = auth.user
  const [images, setImages] = useState<Attached[]>([])
  const [category, setCategory] = useState<Category>("auto")
  const [question, setQuestion] = useState("")
  const [session, setSession] = useState<SessionResponse | null>(null)
  const inflight = useRef(false) // one question at a time: closes the instant one is sent, opens when its answer (or error) lands
  const sentFiles = useRef<File[]>([]) // the files of the last send: lets "Try again" re-upload if the first attempt failed
  const sessionCategory = useRef<Category>("auto") // the category the current session was created with
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [chats, setChats] = useState<ChatRecord[]>(loadChats)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Sharing. `live` = this chat is a shared one: it is read and saved through the shared-chat endpoints, and re-checked every few seconds
  // so co-workers see each other's questions. ownerId is whose chat it is (mine, or someone who shared theirs with me).
  const [live, setLive] = useState<{ ownerId: string; role: Role; ownerName?: string } | null>(null)
  const [liveTitle, setLiveTitle] = useState("")
  const [members, setMembers] = useState<Member[]>([])
  const [shared, setShared] = useState<SharedItem[]>([])
  const [shareFor, setShareFor] = useState<{ id: string; title: string; ownerId: string } | null>(null)
  const revRef = useRef(0)
  const knownIds = useRef<string[]>([]) // message ids as of the last sync: lets the server tell "you deleted this" from "someone else added this"
  const lastSynced = useRef("") // JSON of the messages as of the last sync, so an unchanged chat is never re-saved
  const chatsRef = useRef(chats)
  const deepLink = useRef<{ chat: string; owner: string } | null>(
    (() => {
      const q = new URLSearchParams(window.location.search)
      return q.get("chat") && q.get("owner") ? { chat: q.get("chat") as string, owner: q.get("owner") as string } : null
    })(),
  )
  const stageRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const landing = messages.length === 0 // the moment the first question is sent, the layout switches: chat fills the screen, box drops to the bottom

  // On sign-in (or when an existing session is found): merge server history with what this browser has -- newer copy of a chat
  // wins, chats only one side has are kept, and browser-only ones are uploaded so nothing a guest wrote is lost.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchChats()
      .then((remote) => {
        if (cancelled) return
        setChats((local) => {
          const byId = new Map(remote.map((c) => [c.id, c]))
          for (const c of local) {
            const r = byId.get(c.id)
            if (!r || r.updatedAt < c.updatedAt) {
              byId.set(c.id, c)
              pushChat(c).catch(() => {})
            }
          }
          const merged = pinnedFirst([...byId.values()])
          saveChats(merged)
          return merged
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    chatsRef.current = chats
  }, [chats])

  // Fold a shared chat's latest state from the server into this page.
  function applyLive(r: LiveChat) {
    revRef.current = r.rev
    knownIds.current = r.messages.map((m) => m.id)
    lastSynced.current = JSON.stringify(r.messages)
    setMembers(r.members)
    setLive((l) => (l ? { ...l, role: r.role } : l))
    setMessages((cur) => (JSON.stringify(cur.filter((m) => !m.pending)) === lastSynced.current ? cur : r.messages))
  }

  // Save the active chat to the server shortly after it changes (signed-in users only).
  useEffect(() => {
    if (!user || !activeId) return
    const t = setTimeout(() => {
      const done = messages.filter((m) => !m.pending)
      if (done.length === 0) return
      if (live) {
        // a shared chat: send my version; the server merges it with what co-workers added and sends back the result
        if (inflight.current || live.role === "viewer" || JSON.stringify(done) === lastSynced.current) return
        const title = chatsRef.current.find((c) => c.id === activeId)?.title ?? (liveTitle || titleFrom(done))
        putLive(live.ownerId, activeId, { title, messages: done, known_ids: knownIds.current }).then(applyLive).catch(() => {})
        return
      }
      const rec = upsertChat(chatsRef.current, activeId, messages).find((c) => c.id === activeId)
      if (rec) pushChat(rec).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeId, user, live])

  // Keep a shared chat live: look for co-workers' changes every few seconds (paused in a background tab, and while I am waiting on an answer).
  useEffect(() => {
    if (!live || !activeId || !user) return
    let stop = false
    const tick = async () => {
      if (inflight.current || document.hidden) return
      try {
        const r = await getLive(live.ownerId, activeId)
        if (!stop && !inflight.current && r.rev !== revRef.current) applyLive(r)
      } catch {
        /* offline or access removed: keep what's on screen */
      }
    }
    const t = setInterval(tick, 4000)
    return () => {
      stop = true
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.ownerId, activeId, user])

  // Chats other people shared with me.
  useEffect(() => {
    if (!user) return
    let stop = false
    const load = () =>
      getShared()
        .then((r) => !stop && setShared(r))
        .catch(() => {})
    load()
    const t = setInterval(() => !document.hidden && load(), 20000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [user])

  // Save a chat's name / pin. Retries a few times; if the chat isn't on the server yet, saves the whole chat instead.
  async function saveMeta(rec: ChatRecord, tries = 3) {
    if (!user) return
    for (let i = 0; i < tries; i++) {
      try {
        await patchChatMeta(rec.id, { title: rec.title, pinned: !!rec.pinned, custom_title: !!rec.customTitle })
        return
      } catch (e) {
        if (/not found/i.test(e instanceof Error ? e.message : "")) {
          await pushChat(rec).catch(() => {})
          return
        }
        await new Promise((r) => setTimeout(r, 1200 * (i + 1)))
      }
    }
    toast("Couldn't save that change to your account", { description: "It's kept on this device. Check your connection and try again." })
  }

  async function handleSignOut() {
    // make sure every rename / pin has reached the account before this device forgets its copy
    await Promise.allSettled(chatsRef.current.filter((c) => c.customTitle || c.pinned).map((c) => saveMeta(c, 1)))
    await auth.signOut()
    setChats([]) // don't leave the last person's history on a shared machine
    saveChats([])
    resetAll()
  }

  // Persist the active conversation to "Recents" whenever it changes (pending placeholders are filtered out inside upsertChat).
  useEffect(() => {
    if (!activeId) return
    if (live && live.ownerId !== user?.id) return // someone else's chat: not part of my own Recents
    setChats((prev) => {
      const next = upsertChat(prev, activeId, messages)
      if (next !== prev) saveChats(next)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeId])

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem("sidebar") !== "hidden"
    } catch {
      return true
    }
  })
  const setSidebar = (open: boolean) => {
    setSidebarOpen(open)
    try {
      localStorage.setItem("sidebar", open ? "open" : "hidden")
    } catch {
      /* private mode etc: the toggle still works for this visit */
    }
  }

  // The text box floats over the chat. Publish its height as --composer-h so the thread's bottom padding always matches it.
  useEffect(() => {
    const dock = dockRef.current
    const stage = stageRef.current
    if (!dock || !stage) return
    const set = () => stage.style.setProperty("--composer-h", `${dock.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(dock)
    return () => ro.disconnect()
  }, [landing, activeId])

  useEffect(() => {
    if (!session) return
    const onUnload = () => closeSession(session.session_id)
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [session])

  function openChat(id: string) {
    const rec = chats.find((c) => c.id === id)
    if (!rec || id === activeId) return
    if (session) closeSession(session.session_id)
    transition(() => {
      setSession(null) // imagery isn't stored with history; the conversation (and the small previews in it) is
      setImages([])
      setQuestion("")
      setActiveId(id)
      setMessages(rec.messages)
      setChats((prev) => bumpChat(prev, id)) // an older chat you open becomes the newest
      setDrawerOpen(false)
      setLive(rec.shareCount && user ? { ownerId: user.id, role: "owner" } : null)
      setMembers([])
    })
    if (rec.shareCount && user) getLive(user.id, id).then(applyLive).catch(() => {})
  }

  // Open a chat someone shared with me (or a shared link).
  async function openShared(item: { id: string; ownerId: string }) {
    try {
      const r = await getLive(item.ownerId, item.id)
      if (session) closeSession(session.session_id)
      transition(() => {
        setSession(null)
        setImages([])
        setQuestion("")
        setActiveId(r.id)
        setLiveTitle(r.title)
        setLive({ ownerId: r.ownerId, role: r.role, ownerName: r.ownerName })
        applyLive(r)
        setDrawerOpen(false)
      })
    } catch {
      toast("You don't have access to that chat", { description: "Ask the owner to add the email address you signed in with." })
    }
  }

  useEffect(() => {
    const d = deepLink.current
    if (!d || auth.loading) return
    if (!user) return setAuthMode("login")
    deepLink.current = null
    window.history.replaceState(null, "", "/app")
    void openShared({ id: d.chat, ownerId: d.owner })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, user])

  const activeRec = chats.find((c) => c.id === activeId)
  const mine = !live || live.ownerId === user?.id
  const activeTitle = mine ? (activeRec?.title ?? titleFrom(messages)) : liveTitle
  const readOnly = live?.role === "viewer"

  function renameChat(id: string, title: string) {
    const t = title.trim().slice(0, 120)
    if (!t) return
    const next = renameIn(chatsRef.current, id, t)
    setChats(next)
    saveChats(next)
    const rec = next.find((c) => c.id === id)
    if (rec) void saveMeta(rec)
  }

  function pinChat(id: string) {
    const next = pinnedFirst(togglePinIn(chatsRef.current, id))
    setChats(next)
    saveChats(next)
    const rec = next.find((c) => c.id === id)
    if (rec) void saveMeta(rec)
  }

  function exportChat(id: string) {
    const rec = chats.find((c) => c.id === id)
    const msgs = id === activeId ? messages : rec?.messages
    if (!msgs?.length) return toast("Nothing to export yet", { description: "Ask something first." })
    const title = rec?.title ?? activeTitle
    downloadText(fileNameFor(title), chatToMarkdown(title, msgs))
  }

  function openShare(id?: string) {
    const target = id ?? activeId
    if (!target) return
    if (!user) return openAuth("login")
    const ownerId = target === activeId && live && live.ownerId !== user.id ? live.ownerId : user.id
    setDrawerOpen(false)
    setShareFor({ id: target, title: chats.find((c) => c.id === target)?.title ?? activeTitle, ownerId })
  }

  // The owner's chat must exist on the server before anyone can be invited to it.
  async function ensureSaved() {
    const id = shareFor?.id
    if (!id || !user || shareFor?.ownerId !== user.id) return
    const msgs = id === activeId ? messages : (chatsRef.current.find((c) => c.id === id)?.messages ?? [])
    const rec = upsertChat(chatsRef.current, id, msgs).find((c) => c.id === id)
    if (rec) await pushChat(rec)
  }

  function onMembers(list: Member[]) {
    if (!shareFor || !user || shareFor.ownerId !== user.id) return
    setChats((prev) => prev.map((c) => (c.id === shareFor.id ? { ...c, shareCount: list.length } : c)))
    if (shareFor.id !== activeId) return
    setMembers(list)
    if (list.length > 0 && !live) {
      setLive({ ownerId: user.id, role: "owner" })
      getLive(user.id, shareFor.id).then(applyLive).catch(() => {})
    } else if (list.length === 0 && live?.ownerId === user.id) setLive(null)
  }

  function deleteChat(id: string) {
    if (user) removeChat(id).catch(() => {})
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id)
      saveChats(next)
      return next
    })
    if (id === activeId) resetAll()
  }

  function resetAll() {
    if (session) closeSession(session.session_id)
    const clear = () => {
      sentFiles.current = []
      setLive(null)
      setMembers([])
      setActiveId(null)
      setSession(null)
      setMessages([])
      setImages([])
      setQuestion("")
      setDrawerOpen(false)
    }
    if (messages.length > 0) transition(clear)
    else clear()
  }

  function openAuth(mode: AuthMode) {
    setDrawerOpen(false)
    setAuthMode(mode)
  }

  // Sends the request for a question whose bubble is already in the thread (used by both a fresh send and "Try again").
  async function ask(text: string, thread: ChatMessage[]) {
    const pendingId = uid()
    setMessages((m) => [...m, { id: pendingId, role: "assistant", pending: true }])
    inflight.current = true
    setBusy(true)
    // Attached now -> use them. Already sent (the text box was cleared) -> the chat's own session holds them. Session failed -> resend the last files.
    const files = images.length > 0 ? images.map((i) => i.file) : session?.ok ? [] : sentFiles.current

    try {
      let s = session
      // Attached images need a session of their own: create one the first time, or whenever the attachments or category changed.
      // No images attached = chat / place mode: the server decides (small talk, a named place, or the current session).
      if (files.length > 0 && (!s || imagesChanged(s, files) || sessionCategory.current !== category)) {
        if (s) closeSession(s.session_id)
        s = await createSession(files, category)
        sessionCategory.current = category
        setSession(s)
        if (!s.ok) {
          setMessages((m) => replace(m, pendingId, { role: "assistant", error: s!.findings.map((f) => f.msg).join(" ") || "This input can't be used." }))
          return
        }
      }
      const history = thread
        .filter((m) => !m.pending && !m.error)
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text ?? m.reply ?? m.trace?.answer ?? "" }))
        .filter((h) => h.text)
      const res = await chat(text, s?.session_id ?? null, history)
      if (res.session) {
        // a place question spun up its own session (live Sentinel-2 chip): make it current, drop attachments that belonged to the old one
        if (s && s.session_id !== res.session.session_id) closeSession(s.session_id)
        setSession(res.session)
        setImages([])
      }
      if (res.session && !res.session.ok) {
        setMessages((m) => replace(m, pendingId, { role: "assistant", error: res.session!.findings.map((f) => f.msg).join(" ") || "That imagery can't be used." }))
        return
      }
      setMessages((m) => replace(m, pendingId, { role: "assistant", reply: res.reply, trace: res.trace ?? undefined, place: res.place }))
    } catch (e) {
      // shown once, inside the chat, with a "Try again" button -- no separate popup
      setMessages((m) => replace(m, pendingId, { role: "assistant", error: friendlyError(e) }))
    } finally {
      inflight.current = false
      setBusy(false)
    }
  }

  function handleSend() {
    const text = question.trim()
    if (!text || busy || inflight.current || readOnly) return // still waiting on the last answer: the draft stays in the box
    inflight.current = true // closed right now, before React re-renders, so a fast double Enter can't send twice
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      text,
      author: live && user ? (user.name ?? user.email ?? undefined) : undefined, // in a shared chat, everyone can see who asked
      imageThumbs: images.map((a) => ({ name: a.file.name, url: a.thumb ?? "", modality: a.modality })),
    }
    const history = messages
    if (images.length > 0) sentFiles.current = images.map((i) => i.file)
    const push = () => {
      setQuestion("")
      setImages([]) // the images now live in the message above, not in the text box
      const id = activeId ?? crypto.randomUUID()
      if (!activeId) setActiveId(id)
      setMessages((m) => [...m, userMsg])
      // The chat joins Recents in this same update, named from the question just asked -- not later, when the answer lands.
      setChats((prev) => {
        const next = upsertChat(prev, id, [...history, userMsg])
        saveChats(next)
        return next
      })
      void ask(text, history) // inside the same update, so the question and its "thinking" line appear together, in order
    }
    if (landing) transition(push)
    else push()
  }

  function retry(assistantId: string) {
    if (busy || inflight.current) return
    const idx = messages.findIndex((m) => m.id === assistantId)
    const userMsg = messages
      .slice(0, idx)
      .reverse()
      .find((m) => m.role === "user" && m.text)
    if (!userMsg?.text) return
    setMessages((m) => m.filter((x) => x.id !== assistantId))
    void ask(userMsg.text, messages.slice(0, idx))
  }

  // Editing keeps the old wording AND the answers it got: the old version is filed away next to the new one, and the arrows under the
  // question flip between them. Only the version on screen is a live part of the chat (and is what the model sees as history).
  const settled = (list: ChatMessage[]) => list.filter((m) => !m.pending)

  function editMessage(id: string, newText: string) {
    const text = newText.trim()
    if (busy || inflight.current || !text) return
    const idx = messages.findIndex((m) => m.id === id)
    if (idx < 0) return
    const orig = messages[idx]
    const before = messages.slice(0, idx)
    const cur = orig.branchIndex ?? 0
    const branches: Branch[] = (orig.branches ?? [{ text: orig.text ?? "", imageThumbs: orig.imageThumbs, tail: [] }]).map((b, i) => (i === cur ? { ...b, tail: settled(messages.slice(idx + 1)) } : b))
    branches.push({ text, imageThumbs: orig.imageThumbs, tail: [] })
    setMessages([...before, { ...orig, id: uid(), text, branches, branchIndex: branches.length - 1 }])
    void ask(text, before)
  }

  function switchVersion(id: string, dir: -1 | 1) {
    if (busy || inflight.current) return
    const idx = messages.findIndex((m) => m.id === id)
    const m = messages[idx]
    if (idx < 0 || !m?.branches) return
    const cur = m.branchIndex ?? 0
    const target = cur + dir
    if (target < 0 || target >= m.branches.length) return
    const branches = m.branches.map((b, i) => (i === cur ? { ...b, tail: settled(messages.slice(idx + 1)) } : b))
    const t = branches[target]
    setMessages([...messages.slice(0, idx), { ...m, text: t.text, imageThumbs: t.imageThumbs, branches, branchIndex: target }, ...t.tail])
    requestAnimationFrame(() => document.getElementById(`msg-${id}`)?.scrollIntoView({ block: "start", behavior: "auto" }))
  }

  const composer = (compact: boolean) => (
    <Composer images={images} setImages={setImages} question={question} onQuestionChange={setQuestion} onSend={handleSend} busy={busy} category={category} onCategoryChange={setCategory} compact={compact} sessionCount={session?.ok ? session.files.length : 0} readOnly={readOnly} />
  )
  const sidebarProps = {
    onNewChat: resetAll,
    chats,
    activeId,
    onSelect: openChat,
    onDelete: deleteChat,
    onRename: renameChat,
    onPin: pinChat,
    onShare: openShare,
    onExport: exportChat,
    shared,
    onOpenShared: openShared,
    activeSharedKey: live && live.ownerId !== user?.id && activeId ? `${live.ownerId}/${activeId}` : null,
    user,
    onAuth: openAuth,
    onSignOut: handleSignOut,
  }

  return (
    <div className="relative flex h-svh overflow-hidden bg-background">
      <div className="contour-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      {/* Desktop sidebar: its column eases open/closed while the panel inside slides and fades. */}
      <div
        className={`relative z-10 hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-out motion-reduce:transition-none lg:block ${sidebarOpen ? "w-60 xl:w-64" : "w-0"}`}
        inert={!sidebarOpen}
      >
        <div className={`h-full w-60 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none xl:w-64 ${sidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"}`}>
          <Sidebar {...sidebarProps} onHide={() => setSidebar(false)} />
        </div>
      </div>

      {/* Phones and tablets: the sidebar becomes a slide-in menu */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[86vw] max-w-xs gap-0 p-0 lg:hidden">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Your chats, sign in and account</SheetDescription>
          <Sidebar {...sidebarProps} variant="drawer" />
        </SheetContent>
      </Sheet>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex items-center justify-between border-b border-border bg-background/90 px-2 py-1.5 backdrop-blur-sm lg:hidden">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="flex size-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <List className="size-5" />
          </button>
          <p className="font-serif text-lg text-foreground">SatQuery AI</p>
          <button type="button" onClick={resetAll} aria-label="Start a new chat" className="flex size-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Plus className="size-5" />
          </button>
        </header>

        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebar(true)}
            aria-label="Show sidebar"
            title="Show sidebar"
            className="absolute top-3 left-3 z-20 hidden size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 lg:flex"
          >
            <SidebarSimple className="size-4" />
          </button>
        )}

        {landing ? (
          // Landing state: fits one screen, no scroll. Hero flexes to fill the space above the composer.
          <div key="landing" className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <Hero />
            <div className="relative z-10 mx-auto w-full max-w-4xl shrink-0 space-y-3 px-4 pb-4 sm:px-8">
              <div style={{ viewTransitionName: "composer" }}>{composer(false)}</div>
              <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                <Rocket className="size-3" />
                <span>Indian Space Research Organisation</span>
                <span className="text-border">&middot;</span>
                <span className="font-mono">INDIA 28.6139&deg; N, 77.2090&deg; E</span>
              </div>
            </div>
          </div>
        ) : (
          <div key={activeId ?? "chat"} ref={stageRef} className="relative min-h-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <div className="fade-under-composer absolute inset-0 overflow-y-auto overscroll-contain">
              <ChatThread messages={messages} sessionId={session?.session_id ?? null} sessionFiles={session?.files ?? []} onRetry={retry} onEdit={editMessage} onSwitch={switchVersion} busy={busy || readOnly} me={user ? (user.name ?? user.email ?? undefined) : undefined} />
            </div>
            <ChatTitleBar
              title={activeTitle}
              canRename={mine}
              onRename={(t) => activeId && renameChat(activeId, t)}
              onShare={() => openShare()}
              peopleCount={live ? members.length : (activeRec?.shareCount ?? 0)}
              role={live?.role ?? "owner"}
              ownerName={live?.ownerName}
            />
            {/* No background and no border: chat text scrolls underneath the box itself. Only the box, pills and chips are solid. */}
            <div ref={dockRef} className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3 sm:px-8 sm:pb-4">
              <div className="pointer-events-auto mx-auto w-full max-w-6xl md:pr-6" style={{ viewTransitionName: "composer" }}>
                {composer(true)}
              </div>
            </div>
          </div>
        )}
      </div>

      <ShareDialog
        open={!!shareFor}
        onOpenChange={(o) => !o && setShareFor(null)}
        chatId={shareFor?.id ?? null}
        chatTitle={shareFor?.title ?? ""}
        ownerId={shareFor?.ownerId ?? ""}
        isOwner={!!shareFor && shareFor.ownerId === user?.id}
        myEmail={user?.email}
        ensureSaved={ensureSaved}
        onMembers={onMembers}
        onLeft={() => {
          resetAll()
          getShared().then(setShared).catch(() => {})
        }}
      />
      <AuthDialog mode={authMode} onModeChange={setAuthMode} auth={auth} onDone={() => setAuthMode(null)} />
      <Toaster />
    </div>
  )
}

function imagesChanged(s: SessionResponse, files: File[]): boolean {
  if (s.files.length !== files.length) return true
  return s.files.some((f, i) => f.name !== files[i].name)
}

function replace(msgs: ChatMessage[], id: string, patch: Partial<ChatMessage>): ChatMessage[] {
  return msgs.map((m) => (m.id === id ? { ...m, ...patch, pending: false } : m))
}

export default App
