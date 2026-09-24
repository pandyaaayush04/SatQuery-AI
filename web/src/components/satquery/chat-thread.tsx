import { CircleNotch, Image, Planet, WarningCircle } from "@phosphor-icons/react"
import { forwardRef } from "react"
import { PlaceCard } from "./place-card"
import { PreviewPanel } from "./preview-panel"
import { ReplyText } from "./reply-text"
import { ResultPanel } from "./result-panel"
import type { ChatMessage, SessionFile } from "@/lib/types"

export const ChatThread = forwardRef<HTMLDivElement, { messages: ChatMessage[]; sessionId: string | null; sessionFiles: SessionFile[] }>(
  function ChatThread({ messages, sessionId, sessionFiles }, ref) {
    const latestTrace = [...messages].reverse().find((m) => m.trace)?.trace

    return (
      <div ref={ref} className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-8">
        {sessionId && sessionFiles.length > 0 && (
          <PreviewPanel
            sessionId={sessionId}
            files={sessionFiles}
            box={latestTrace?.evidence.box}
            overlayAvailable={latestTrace?.evidence.change?.available === true}
          />
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex gap-3"}>
            {m.role === "assistant" && (
              <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary">
                <Planet className="size-3.5 text-primary-foreground" weight="fill" />
              </div>
            )}
            <div className={m.role === "user" ? "max-w-[85%] space-y-2" : "min-w-0 flex-1 space-y-3"}>
              {m.role === "user" ? (
                <div className="space-y-2 rounded-2xl rounded-tr-sm bg-secondary px-4 py-3 text-secondary-foreground">
                  {m.imageNames && m.imageNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.imageNames.map((n) => (
                        <span key={n} className="flex items-center gap-1 rounded-full bg-card/60 px-2 py-1 font-mono text-[11px]">
                          <Image className="size-3" />
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm">{m.text}</p>
                </div>
              ) : m.pending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CircleNotch className="size-4 animate-spin" />
                  Thinking…
                </div>
              ) : m.error ? (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
                  {m.error}
                </div>
              ) : (
                <>
                  {m.place && <PlaceCard place={m.place} />}
                  {m.reply && <ReplyText text={m.reply} />}
                  {m.trace && <ResultPanel trace={m.trace} />}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  },
)
