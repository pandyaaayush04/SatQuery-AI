import type { Mode } from "./types"

export const MODE_LABEL: Record<Mode, string> = {
  single: "Single image",
  cross_modal: "Optical + SAR fusion",
  bitemporal: "Bi-temporal change",
}

/** Suggestion chips, chosen by how many images are attached (before a session confirms the real mode). */
export function examplesFor(attachedCount: number): string[] {
  if (attachedCount >= 2) {
    return [
      "What changed between these two dates, and where?",
      "Use both images together to identify water and built-up areas.",
      "Has the built-up area increased or decreased?",
    ]
  }
  if (attachedCount === 1) {
    return ["Describe the land cover in this image.", "Is there water present in this image?", "Point out the largest forested area."]
  }
  return ["Show me the land cover around Pune", "How has Dubai changed since last year?", "Tell me about Lake Victoria", "Hi! What can you do?"]
}
