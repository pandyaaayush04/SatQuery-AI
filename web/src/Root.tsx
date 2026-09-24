import App from "./App"
import { RouterProvider, useRoute } from "./lib/router"
import { AuthPage } from "./pages/AuthPage"
import { LandingPage } from "./pages/LandingPage"

function Switch() {
  const { path } = useRoute()
  if (path === "/app") return <App />
  if (path === "/login" || path === "/signup") return <AuthPage mode={path === "/login" ? "login" : "signup"} />
  return <LandingPage />
}

export function Root() {
  return (
    <RouterProvider>
      <Switch />
    </RouterProvider>
  )
}
