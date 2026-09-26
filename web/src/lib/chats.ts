import type { ChatMessage } from "./types"

// Chat history for the sidebar's "Recents", kept in this browser only (localStorage). Server sessions are in-memory and die
// with the server, so a reopened chat restores the conversation itself, not the imagery -- attach it again to ask more about it.
export interface ChatRecord {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
  pinned?: boolean
  customTitle?: boolean // the person named it: the automatic name must never overwrite it
  shareCount?: number // how many people it is shared with (owner's chats only)
  rev?: number
}

const KEY = "satquery.chats"
const MAX_CHATS = 30

export function loadChats(): ChatRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ChatRecord[]) : []
  } catch {
    return []
  }
}

export function saveChats(chats: ChatRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(chats.slice(0, MAX_CHATS)))
  } catch {
    /* storage full or blocked: history just won't persist this visit */
  }
}

const CHATTER = /^(hi+|hello+|hey+|heya|yo|hola|namaste|sup|thanks?|thank you|thx|ok(ay)?|cool|nice|great|bye+|good (morning|afternoon|evening|night)|what can you do|help)\b[\s!.?,]*$/i
const MAX_TITLE = 46

/** "Show me the land cover around Pune" -> "Land cover around Pune". Drops the polite / question scaffolding and keeps the topic. */
function topicOf(text: string): string {
  let t = text.replace(/\s+/g, " ").trim()
  t = t.replace(/^(hi+|hello+|hey+)[,!.\s]+/i, "")
  t = t.replace(/^(please\s+)?(can|could|would|will) you (please )?/i, "")
  t = t.replace(/^i(?:'d| would| want to| need to)? (?:like to |want to |need to )?(?:know|see|ask|find out)( about)?\s+/i, "")
  t = t.replace(/^(show|tell|give) me( about| the)?\s+/i, "")
  t = t.replace(/^(describe|explain|summari[sz]e|analy[sz]e|look at|point out)\s+/i, "")
  t = t.replace(/^(what|how)('s| is| are| was| were| has| have| did| does| do)\s+/i, "")
  t = t.replace(/^(is|are) there( any| a)?\s+/i, "")
  t = t.replace(/^(the|a|an)\s+/i, "")
  t = t.replace(/[\s?!.,;:]+$/, "")
  if (!t) t = text.replace(/[\s?!.,;:]+$/, "")
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const fileLabel = (name: string) => {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim()
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/** A short name for the chat, taken from what was asked: the first real question (skipping "hi" and thanks), with the attached file's
 *  name added when the question only says "this image". Trimmed at a word boundary. */
export function titleFrom(messages: ChatMessage[]): string {
  const asked = messages.filter((m) => m.role === "user" && m.text?.trim())
  const first = asked.find((m) => !CHATTER.test(m.text!.trim())) ?? asked[0]
  if (!first?.text) return "New chat"
  let title = topicOf(first.text)
  const file = first.imageThumbs?.[0]?.name ?? first.imageNames?.[0]
  if (file && /\b(this|these|the)\b.*\b(image|images|scene|pair|dates?|photo)\b/i.test(title)) title += ` · ${fileLabel(file).slice(0, 22)}`
  if (title.length > MAX_TITLE) {
    const cut = title.slice(0, MAX_TITLE)
    title = cut.slice(0, Math.max(cut.lastIndexOf(" "), 24)).trimEnd() + "…"
  }
  return title
}

/** Insert or update a chat and move it to the top (most recent first). Pending placeholders are never persisted. */
export function upsertChat(chats: ChatRecord[], id: string, messages: ChatMessage[]): ChatRecord[] {
  const done = messages.filter((m) => !m.pending)
  if (done.length === 0) return chats
  const prev = chats.find((c) => c.id === id)
  // A name that differs from what the automatic naming would give for the chat as it was is the person's own -- keep it, even if the
  // "customTitle" flag got lost on the way (an older server, a failed save). Only untouched automatic names follow the conversation.
  const custom = !!prev && (!!prev.customTitle || prev.title !== titleFrom(prev.messages))
  const rec: ChatRecord = { ...prev, id, title: custom ? (prev as ChatRecord).title : titleFrom(done), customTitle: custom || undefined, updatedAt: Date.now(), messages: done }
  return pinnedFirst([rec, ...chats.filter((c) => c.id !== id)]).slice(0, MAX_CHATS)
}

/** Move a chat to the top of Recents (used when you open an older chat). */
export function bumpChat(chats: ChatRecord[], id: string): ChatRecord[] {
  const c = chats.find((x) => x.id === id)
  return c ? [{ ...c, updatedAt: Date.now() }, ...chats.filter((x) => x.id !== id)] : chats
}

/** Pinned chats first, then newest first. */
export function pinnedFirst<T extends { pinned?: boolean; updatedAt: number }>(chats: T[]): T[] {
  return [...chats].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt)
}

export function renameIn(chats: ChatRecord[], id: string, title: string): ChatRecord[] {
  return chats.map((c) => (c.id === id ? { ...c, title, customTitle: true } : c))
}

export function togglePinIn(chats: ChatRecord[], id: string): ChatRecord[] {
  return chats.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
}
