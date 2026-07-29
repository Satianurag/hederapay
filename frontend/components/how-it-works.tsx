const steps = [
  {
    number: "1",
    title: "PSP Onboards",
    description: "KYB verification and credit scoring",
  },
  {
    number: "2",
    title: "Investors Fund Pool",
    description: "Deposit WHBAR, earn from Day 1",
  },
  {
    number: "3",
    title: "PSP Draws Capital",
    description: "Instant WHBAR for settlement",
  },
  {
    number: "4",
    title: "Automated Settlement",
    description: "Hedera automation distributes yield, SaucerSwap fills gaps",
  },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-20 lg:py-28">
      <h2 className="mb-12 text-center text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
        How It Works
      </h2>
      
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {steps.map((step) => (
          <div key={step.number} className="flex flex-col gap-3 text-center">
            <span className="font-mono text-4xl font-bold text-blue-400">
              {step.number}
            </span>
            <h3 className="text-lg font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
