import type { ChatMessage } from "./types"

// Chat history for the sidebar's "Recents", kept in this browser only (localStorage). Server sessions are in-memory and die
// with the server, so a reopened chat restores the conversation itself, not the imagery -- attach it again to ask more about it.
export interface ChatRecord {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
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

export function titleFrom(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user" && m.text)?.text?.trim() ?? "New chat"
  return first.length > 42 ? first.slice(0, 42).trimEnd() + "…" : first
}

/** Insert or update a chat and move it to the top (most recent first). Pending placeholders are never persisted. */
export function upsertChat(chats: ChatRecord[], id: string, messages: ChatMessage[]): ChatRecord[] {
  const done = messages.filter((m) => !m.pending)
  if (done.length === 0) return chats
  const rec: ChatRecord = { id, title: titleFrom(done), updatedAt: Date.now(), messages: done }
  return [rec, ...chats.filter((c) => c.id !== id)].slice(0, MAX_CHATS)
}
