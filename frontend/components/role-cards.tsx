import Link from "next/link"
import { Button } from "@/components/ui/button"

const roles = [
  {
    label: "FOR INVESTORS",
    heading: "Earn 5% APY on WHBAR",
    bullets: [
      "Deposit WHBAR into the pool",
      "Fixed yield regardless of utilization",
      "Weekly distributions, withdraw anytime",
    ],
    cta: "Start Investing →",
    href: "/auth/investor",
  },
  {
    label: "FOR BORROWERS (PSPs)",
    heading: "Access Liquidity in Seconds",
    bullets: [
      "Up to $50K WHBAR liquidity line",
      "Repay in WHBAR or USDC",
      "AI-powered risk assessment via nanopayments",
    ],
    cta: "Apply for Liquidity →",
    href: "/auth/psp",
  },
]

export function RoleCards() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-20 lg:py-28">
      <div className="grid gap-8 sm:grid-cols-2 lg:gap-12">
        {roles.map((role) => (
          <div 
            key={role.label} 
            className="flex flex-col gap-4 rounded-lg border border-border/50 bg-secondary/30 p-6 lg:p-8"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {role.label}
              </span>
            </div>
            
            <h3 className="text-xl font-semibold tracking-tight text-foreground lg:text-2xl">
              {role.heading}
            </h3>
            
            <ul className="flex flex-col gap-2">
              {role.bullets.map((bullet, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-0.5 text-muted-foreground/60">→</span>
                  <span className="text-sm leading-relaxed lg:text-base">{bullet}</span>
                </li>
              ))}
            </ul>
            
            <div className="mt-auto pt-4">
              <Link href={role.href}>
                <Button
                  className="w-full rounded-lg bg-blue-400 font-medium text-white hover:bg-blue-400/90 sm:w-auto"
                >
                  {role.cta}
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
