import type { ReactNode } from "react"

// Tiny renderer for the assistant's chat text: **bold**, *italic*, "- " bullets, blank-line paragraphs. No markdown dependency.
function inline(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("*") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em> : part,
  )
}

export function ReplyText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground">
      {blocks.map((block, i) => {
        const lines = block.split("\n")
        return lines.every((l) => l.startsWith("- ")) ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {lines.map((l, j) => (
              <li key={j}>{inline(l.slice(2))}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {inline(block)}
          </p>
        )
      })}
    </div>
  )
}
