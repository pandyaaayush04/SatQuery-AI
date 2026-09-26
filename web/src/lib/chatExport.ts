import { answerText } from "@/components/satquery/message-actions"
import type { ChatMessage } from "./types"

export function chatToMarkdown(title: string, messages: ChatMessage[]): string {
  const lines = [`# ${title}`, ""]
  for (const m of messages.filter((x) => !x.pending && !x.error)) {
    if (m.role === "user") lines.push(`**${m.author ?? "You"}:** ${m.text ?? ""}`, "")
    else lines.push(`**SatQuery AI:** ${answerText(m)}`, "")
  }
  return lines.join("\n")
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }))
  const a = Object.assign(document.createElement("a"), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const fileNameFor = (title: string) => `${title.replace(/[^\w\-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "chat"}.md`
