import { Rocket, SidebarSimple } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ChatThread } from "@/components/satquery/chat-thread"
import { Composer } from "@/components/satquery/composer"
import { Hero } from "@/components/satquery/hero"
import { Sidebar } from "@/components/satquery/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { chat, closeSession, createSession } from "@/lib/api"
import { fetchChats, getConfig, getMe, googleLogin, logout, pushChat, removeChat, type User } from "@/lib/auth"
import { loadChats, saveChats, upsertChat, type ChatRecord } from "@/lib/chats"
import { MODE_LABEL } from "@/lib/modes"
import type { ChatMessage, SessionResponse } from "@/lib/types"

const uid = () => crypto.randomUUID() // unique across reloads too: restored history must never collide with new message ids

function App() {
  const [images, setImages] = useState<File[]>([])
  const [question, setQuestion] = useState("")
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [showLanding, setShowLanding] = useState(true) // stays true briefly after the first send, so the fade-out can play
  const [landingFading, setLandingFading] = useState(false)
  const fadeStarted = useRef(false) // guards the effect below without being one of its own deps (a state dep here would let
  // the setLandingFading call re-trigger this same effect, whose cleanup would then cancel the timer it just started)
  const threadRef = useRef<HTMLDivElement>(null)
  const [chats, setChats] = useState<ChatRecord[]>(loadChats)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [googleClientId, setGoogleClientId] = useState<string | null>(null)

  // Who am I? (session cookie) and is Google sign-in configured on the server?
  useEffect(() => {
    getConfig().then((c) => setGoogleClientId(c.google_client_id)).catch(() => {})
    getMe().then(setUser).catch(() => {})
  }, [])

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
          const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
          saveChats(merged)
          return merged
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user])

  // Save the active chat to the server shortly after it changes (signed-in users only).
  useEffect(() => {
    if (!user || !activeId) return
    const rec = upsertChat([], activeId, messages)[0]
    if (!rec) return
    const t = setTimeout(() => pushChat(rec).catch(() => {}), 800)
    return () => clearTimeout(t)
  }, [messages, activeId, user])

  async function handleCredential(credential: string) {
    try {
      setUser(await googleLogin(credential))
    } catch (e) {
      toast.error("Sign-in failed", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function handleSignOut() {
    await logout().catch(() => {})
    setUser(null)
    setChats([]) // don't leave the last person's history on a shared machine
    saveChats([])
    resetAll()
  }

  // Persist the active conversation to "Recents" whenever it changes (pending placeholders are filtered out inside upsertChat).
  useEffect(() => {
    if (!activeId) return
    setChats((prev) => {
      const next = upsertChat(prev, activeId, messages)
      if (next !== prev) saveChats(next)
      return next
    })
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

  useEffect(() => {
    threadRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (messages.length === 0 || !showLanding || fadeStarted.current) return
    fadeStarted.current = true
    setLandingFading(true) // triggers the opacity transition below
    const t = setTimeout(() => setShowLanding(false), 300) // matches the transition duration; unmount only once it's fully faded
    return () => clearTimeout(t)
  }, [messages.length, showLanding])

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
    setSession(null) // imagery isn't stored with history; the conversation is
    setImages([])
    setQuestion("")
    setActiveId(id)
    setMessages(rec.messages)
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
    setActiveId(null)
    if (session) closeSession(session.session_id)
    setSession(null)
    setMessages([])
    setImages([])
    setQuestion("")
    fadeStarted.current = false
    setShowLanding(true)
    setLandingFading(false)
  }

  async function handleSend() {
    const text = question.trim()
    if (!text || busy) return
    setQuestion("")
    if (!activeId) setActiveId(crypto.randomUUID())
    setMessages((m) => [...m, { id: uid(), role: "user", text, imageNames: images.map((f) => f.name) }])

    const pendingId = uid()
    setMessages((m) => [...m, { id: pendingId, role: "assistant", pending: true }])
    setBusy(true)

    try {
      let s = session
      // Attached images need a session of their own: create one the first time, or whenever the attachments changed.
      // No images attached = chat / place mode: the server decides (small talk, a named place, or the current session).
      if (images.length > 0 && (!s || imagesChanged(s, images))) {
        if (s) closeSession(s.session_id)
        s = await createSession(images)
        setSession(s)
        if (!s.ok) {
          setMessages((m) => replace(m, pendingId, { role: "assistant", error: s!.findings.map((f) => f.msg).join(" ") || "This input can't be used." }))
          return
        }
      }
      const history = messages
        .filter((m) => !m.pending)
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
      const msg = e instanceof Error ? e.message : String(e)
      setMessages((m) => replace(m, pendingId, { role: "assistant", error: msg }))
      toast.error("Something went wrong", { description: msg })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex h-svh overflow-hidden bg-background">
      <div className="contour-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      {sidebarOpen && <Sidebar onNewChat={resetAll} chatActive={messages.length > 0} onHide={() => setSidebar(false)} chats={chats} activeId={activeId} onSelect={openChat} onDelete={deleteChat} user={user} googleClientId={googleClientId} onCredential={handleCredential} onSignOut={handleSignOut} />}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebar(true)}
            aria-label="Show sidebar"
            title="Show sidebar"
            className="absolute top-3 left-3 z-20 hidden size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground md:flex"
          >
            <SidebarSimple className="size-4" />
          </button>
        )}
        {showLanding ? (
          // Landing state: fits one screen, no scroll. Hero flexes to fill the remaining space above
          // the composer+cards (fixed, content-sized). No border/divider and a shared background
          // make it read as one continuous surface without the composer physically overlapping
          // anything -- the globe is large enough that an overlap trick would clip into it.
          // On the first send, this whole surface (Earth included) fades via opacity rather than
          // vanishing instantly -- motion-safe: so reduced-motion users get the same end state with
          // no animated transition, not a stuck half-faded screen.
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out ${landingFading ? "opacity-0" : "opacity-100"}`}
          >
            <Hero />
            <div className="relative z-10 mx-auto w-full max-w-4xl shrink-0 space-y-3 px-4 pb-4 sm:px-8">
              <Composer
                images={images}
                onImagesChange={setImages}
                question={question}
                onQuestionChange={setQuestion}
                onSend={handleSend}
                busy={busy}
                modeLabel={images.length >= 2 ? "Bi-temporal / fusion" : "Single image"}
              />
              {/* Very quiet attribution -- feature cards moved to the dedicated landing page; this
                 spot just needs a calm footer note, not something competing for attention. */}
              <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                <Rocket className="size-3" />
                <span>Indian Space Research Organisation</span>
                <span className="text-border">&middot;</span>
                <span className="font-mono">INDIA 28.6139&deg; N, 77.2090&deg; E</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ChatThread ref={threadRef} messages={messages} sessionId={session?.session_id ?? null} sessionFiles={session?.files ?? []} />
            </div>
            <div className="bg-background px-4 py-4 sm:px-8">
              <div className="mx-auto max-w-4xl">
                <Composer
                  images={images}
                  onImagesChange={setImages}
                  question={question}
                  onQuestionChange={setQuestion}
                  onSend={handleSend}
                  busy={busy}
                  modeLabel={session?.ok ? MODE_LABEL[session.mode] : images.length >= 2 ? "Bi-temporal / fusion" : "Single image"}
                />
              </div>
            </div>
          </>
        )}
      </div>
      <Toaster />
    </div>
  )
}

function imagesChanged(s: SessionResponse, images: File[]): boolean {
  if (s.files.length !== images.length) return true
  return s.files.some((f, i) => f.name !== images[i].name)
}

function replace(msgs: ChatMessage[], id: string, patch: Partial<ChatMessage>): ChatMessage[] {
  return msgs.map((m) => (m.id === id ? { ...m, ...patch, pending: false } : m))
}

export default App
