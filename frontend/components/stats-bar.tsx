const stats = [
  { value: "$2M+", label: "Pool Capacity" },
  { value: "5.00%", label: "Fixed APY" },
  { value: "T+0", label: "Settlement" },
  { value: "7-Day", label: "Yield Cycles" },
]

export function StatsBar() {
  return (
    <section className="border-y border-border bg-background">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-6 py-10 sm:grid-cols-4 lg:py-12">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="font-mono text-2xl font-medium tabular-nums tracking-tight text-foreground sm:text-3xl">
              {stat.value}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
