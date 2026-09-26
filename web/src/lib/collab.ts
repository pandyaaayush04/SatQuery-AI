import { json } from "./auth"
import type { ChatMessage } from "./types"

export type Role = "owner" | "editor" | "viewer"

export interface Member {
  email: string
  role: "editor" | "viewer"
  name: string | null
}

/** A chat someone shared with me (no messages: those come from getLive when I open it). */
export interface SharedItem {
  id: string
  ownerId: string
  ownerName: string
  title: string
  updatedAt: number
  role: "editor" | "viewer"
  rev: number
}

export interface LiveChat {
  id: string
  ownerId: string
  ownerName: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
  role: Role
  rev: number
  members: Member[]
}

const jsonPost = (url: string, method: string, body?: unknown) =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })

export const getShared = () => fetch("/api/shared").then(json<SharedItem[]>)

export const getLive = (ownerId: string, chatId: string) => fetch(`/api/shared/${encodeURIComponent(ownerId)}/${encodeURIComponent(chatId)}`).then(json<LiveChat>)

export const putLive = (ownerId: string, chatId: string, body: { title: string; messages: ChatMessage[]; known_ids: string[] }) =>
  jsonPost(`/api/shared/${encodeURIComponent(ownerId)}/${encodeURIComponent(chatId)}`, "PUT", body).then(json<LiveChat>)

export const shareChat = (chatId: string, email: string, role: "editor" | "viewer") =>
  jsonPost(`/api/chats/${encodeURIComponent(chatId)}/share`, "POST", { email, role }).then(json<{ members: Member[] }>)

/** Owner: remove anyone. Collaborator: pass the owner's id to remove yourself (leave). */
export const unshareChat = (chatId: string, email: string, ownerId?: string) =>
  jsonPost(`/api/chats/${encodeURIComponent(chatId)}/share/${encodeURIComponent(email)}${ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : ""}`, "DELETE").then(json<{ members: Member[] }>)

export const inviteLink = (ownerId: string, chatId: string) => `${window.location.origin}/app?chat=${encodeURIComponent(chatId)}&owner=${encodeURIComponent(ownerId)}`
