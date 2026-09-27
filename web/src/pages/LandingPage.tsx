import { useEffect, useState } from "react"
import { Info } from "@phosphor-icons/react"
import { CapabilitiesSection } from "@/components/landing/capabilities-section"
import { ExploreBand } from "@/components/landing/explore-band"
import { ImpactVisionSection } from "@/components/landing/impact-vision-section"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingHero } from "@/components/landing/landing-hero"
import { LandingNav } from "@/components/landing/landing-nav"
import { StatsStrip } from "@/components/landing/stats-strip"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRoute } from "@/lib/router"

export function LandingPage() {
  const { navigate } = useRoute()
  const launch = () => navigate("/app")
  const seeExamples = () => document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" })
  const [noticeOpen, setNoticeOpen] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setNoticeOpen(false), 5000)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className="relative min-h-svh bg-background">
      <div className="contour-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      <LandingNav onLaunch={launch} />
      <LandingHero onLaunch={launch} onSeeExamples={seeExamples} />
      <StatsStrip />
      <CapabilitiesSection />
      <ExploreBand onLaunch={launch} />
      <ImpactVisionSection onLaunch={launch} />
      <LandingFooter />

      {/* Informational popup — UI demo mode */}
      <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
        <DialogContent showCloseButton={true} onOpenAutoFocus={(e) => e.preventDefault()} className="top-16 translate-y-0 duration-300 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="size-5 text-primary" />
              Model Status: Offline
            </DialogTitle>
            <DialogDescription className="pt-1 leading-relaxed">
              Welcome to the SatQuery AI interface! The backend model and satellite processing engines are currently not deployed on this live preview (UI Demonstration Only).
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
