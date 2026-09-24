import { useCallback, useEffect, useState } from "react"
import { getConfig, getMe, googleLogin, logout, passwordAuth, type User } from "./auth"

/** Sign-in state for pages outside the chat app (landing nav, login/signup page). The session lives in an HttpOnly cookie, so this
 *  just asks the server who we are; App.tsx keeps its own copy for chat sync and reads the same cookie. */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([getConfig().then((c) => setClientId(c.google_client_id)), getMe().then(setUser)]).then(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (credential: string) => {
    const u = await googleLogin(credential)
    setUser(u)
    return u
  }, [])

  const signInWithPassword = useCallback(async (mode: "login" | "register", email: string, password: string) => {
    const u = await passwordAuth(mode, email, password)
    setUser(u)
    return u
  }, [])

  const signOut = useCallback(async () => {
    await logout().catch(() => {})
    setUser(null)
  }, [])

  return { user, clientId, loading, signIn, signInWithPassword, signOut }
}
