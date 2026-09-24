import { CapabilitiesSection } from "@/components/landing/capabilities-section"
import { ExploreBand } from "@/components/landing/explore-band"
import { ImpactVisionSection } from "@/components/landing/impact-vision-section"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingHero } from "@/components/landing/landing-hero"
import { LandingNav } from "@/components/landing/landing-nav"
import { StatsStrip } from "@/components/landing/stats-strip"
import { useRoute } from "@/lib/router"

export function LandingPage() {
  const { navigate } = useRoute()
  const launch = () => navigate("/app")
  const seeExamples = () => document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" })

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
    </div>
  )
}
