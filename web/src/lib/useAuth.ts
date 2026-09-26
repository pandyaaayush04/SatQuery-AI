import { useCallback, useEffect, useState } from "react"
import { forgotPassword, getConfig, getMe, googleLogin, login, logout, register, resendCode, resetPassword, verifyEmail, type User } from "./auth"

/** Sign-in state shared by the landing nav, the login/signup page and the chat app. The session lives in an HttpOnly cookie, so
 *  this just asks the server who we are. */
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

  const logIn = useCallback(async (email: string, password: string) => {
    const u = await login(email, password)
    setUser(u)
    return u
  }, [])

  const signUp = useCallback((email: string, password: string, name: string) => register(email, password, name), [])

  const verify = useCallback(async (email: string, code: string) => {
    const u = await verifyEmail(email, code)
    setUser(u)
    return u
  }, [])

  const reset = useCallback(async (email: string, code: string, password: string) => {
    const u = await resetPassword(email, code, password)
    setUser(u)
    return u
  }, [])

  const signOut = useCallback(async () => {
    await logout().catch(() => {})
    setUser(null)
  }, [])

  return { user, clientId, loading, signIn, logIn, signUp, verify, resend: resendCode, forgot: forgotPassword, reset, signOut }
}

export type Auth = ReturnType<typeof useAuth>
