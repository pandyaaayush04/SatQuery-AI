import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

// Click-to-enlarge for any preview. `children` are drawn on top of the image (change map, bounding box) so they stay aligned.
export function ImageLightbox({ open, onOpenChange, src, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; src: string; title: string; children?: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94svh] no-scrollbar gap-3 overflow-y-auto p-3 sm:max-w-2xl">
        <DialogTitle className="truncate pr-8 text-sm font-normal">{title}</DialogTitle>
        <DialogDescription className="sr-only">Enlarged preview. Press Escape or the close button to go back.</DialogDescription>
        <div className="relative mx-auto aspect-square w-full max-w-[min(100%,78svh)] overflow-hidden rounded-lg border border-border bg-muted">
          <img src={src} alt={title} className="size-full object-contain" />
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
