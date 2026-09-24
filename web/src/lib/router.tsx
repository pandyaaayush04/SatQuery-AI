// Two pages (landing + app) don't need a routing library -- a tiny History-API hook is the whole thing.
// add react-router only if a third real route (or nested/dynamic routing) actually shows up.
import { createContext, useContext, useEffect, useState } from "react"

const RouteContext = createContext<{ path: string; navigate: (to: string) => void } | null>(null)

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  function navigate(to: string) {
    window.history.pushState(null, "", to)
    setPath(to)
    window.scrollTo(0, 0)
  }

  return <RouteContext.Provider value={{ path, navigate }}>{children}</RouteContext.Provider>
}

export function useRoute() {
  const ctx = useContext(RouteContext)
  if (!ctx) throw new Error("useRoute must be used inside RouterProvider")
  return ctx
}
