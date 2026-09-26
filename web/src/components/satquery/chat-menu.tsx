import { DownloadSimple, PencilSimple, PushPin, PushPinSlash, ShareNetwork, Trash } from "@phosphor-icons/react"
import type { ElementType } from "react"

// One menu, two ways to open it: right-click / long-press on a chat (Radix ContextMenu) and the "⋯" button (Radix DropdownMenu). Both
// libraries share the same part names, so the menu is written once and handed whichever set of parts it should use.
export interface MenuParts {
  Portal: ElementType
  Content: ElementType
  Item: ElementType
  Separator: ElementType
}

const item =
  "flex min-h-10 cursor-default items-center gap-2.5 rounded-lg px-3 text-sm text-popover-foreground outline-none select-none data-highlighted:bg-muted pointer-coarse:min-h-11"

export function ChatMenu({
  P,
  pinned,
  canRename = true,
  canDelete = true,
  onRename,
  onPin,
  onShare,
  onExport,
  onDelete,
  deleteLabel = "Delete",
}: {
  P: MenuParts
  pinned?: boolean
  canRename?: boolean
  canDelete?: boolean
  onRename?: () => void
  onPin?: () => void
  onShare: () => void
  onExport: () => void
  onDelete?: () => void
  deleteLabel?: string
}) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={4}
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
        className="z-50 min-w-52 rounded-xl border border-border bg-popover p-1 shadow-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150"
      >
        {canRename && onRename && (
          <P.Item className={item} onSelect={onRename}>
            <PencilSimple className="size-4 text-muted-foreground" />
            Rename
          </P.Item>
        )}
        {onPin && (
          <P.Item className={item} onSelect={onPin}>
            {pinned ? <PushPinSlash className="size-4 text-muted-foreground" /> : <PushPin className="size-4 text-muted-foreground" />}
            {pinned ? "Unpin from top" : "Pin to top"}
          </P.Item>
        )}
        <P.Item className={item} onSelect={onShare}>
          <ShareNetwork className="size-4 text-muted-foreground" />
          Share or add people
        </P.Item>
        <P.Item className={item} onSelect={onExport}>
          <DownloadSimple className="size-4 text-muted-foreground" />
          Export as Markdown
        </P.Item>
        {canDelete && onDelete && (
          <>
            <P.Separator className="my-1 h-px bg-border" />
            <P.Item className={`${item} text-destructive data-highlighted:bg-destructive/10`} onSelect={onDelete}>
              <Trash className="size-4" />
              {deleteLabel}
            </P.Item>
          </>
        )}
      </P.Content>
    </P.Portal>
  )
}
