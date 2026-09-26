import { flushSync } from "react-dom"

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Runs a state update inside the browser's View Transition, so big layout changes (new chat, first question, opening another chat)
 *  cross-fade and the text box glides to its new place. Browsers without the API, and people who ask for reduced motion, just get the
 *  update with no animation. */
export function transition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (!doc.startViewTransition || prefersReducedMotion()) return update()
  doc.startViewTransition(() => flushSync(update))
}
