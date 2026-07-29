const partners = [
  "Hedera",
  "x402 / @x402/hedera",
  "SaucerSwap",
  "HashPack",
]

export function InfrastructureStrip() {
  return (
    <section className="border-t border-border py-16 lg:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mb-8 text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Infrastructure
          </span>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 lg:gap-x-12">
          {partners.map((partner, index) => (
            <span key={partner} className="flex items-center gap-8 text-sm text-slate-500 lg:gap-12">
              <span>{partner}</span>
              {index < partners.length - 1 && (
                <span className="hidden text-slate-600 sm:inline">•</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
