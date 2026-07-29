import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { StatsBar } from "@/components/stats-bar"
import { RoleCards } from "@/components/role-cards"
import { HowItWorks } from "@/components/how-it-works"
import { InfrastructureStrip } from "@/components/infrastructure-strip"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        <HeroSection />
        <StatsBar />
        <RoleCards />
        <HowItWorks />
        <InfrastructureStrip />
      </main>
      <Footer />
    </div>
  )
}
