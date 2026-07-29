import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PoolStatusTerminal } from "@/components/pool-status-terminal"

export function HeroSection() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-20 lg:py-28">
      <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
        <div className="flex flex-1 flex-col gap-6 lg:max-w-[60%]">
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.02em] sm:text-5xl lg:text-[56px] lg:leading-[1.1]">
            <span className="text-foreground">Instant Capital for Payment Service Providers.</span>
            <br />
            <span className="text-blue-400">Fixed Yield for Investors.</span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-muted-foreground lg:text-lg">
            HederaPay is a programmable credit pool where licensed PSPs draw WHBAR for corridor settlement, and institutional investors earn a guaranteed 5% APY — all on-chain, all automated.
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:gap-4">
            <Link href="/auth/investor">
              <Button
                size="lg"
                className="rounded-lg bg-blue-400 px-6 font-medium text-white hover:bg-blue-400/90"
              >
                Start Investing
                <span className="ml-1">→</span>
              </Button>
            </Link>
            <Link href="/auth/psp">
              <Button
                size="lg"
                variant="outline"
                className="rounded-lg border-blue-400 bg-transparent px-6 font-medium text-white hover:bg-secondary"
              >
                Apply for Liquidity
                <span className="ml-1">→</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex-1 lg:max-w-[40%]">
          <PoolStatusTerminal />
        </div>
      </div>
    </section>
  )
}
