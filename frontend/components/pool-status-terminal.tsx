export function PoolStatusTerminal() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="font-mono text-sm">
        <div className="mb-4 text-muted-foreground">Pool Status</div>
        <div className="space-y-2 text-foreground">
          <div className="flex">
            <span className="text-muted-foreground">├─</span>
            <span className="ml-2 text-muted-foreground">Total Liquidity</span>
            <span className="ml-auto font-medium tabular-nums text-white">$2,000,000</span>
            <span className="ml-2 text-muted-foreground">USDC</span>
          </div>
          <div className="flex">
            <span className="text-muted-foreground">├─</span>
            <span className="ml-2 text-muted-foreground">Available</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">$1,400,000</span>
            <span className="ml-2 text-muted-foreground">USDC</span>
          </div>
          <div className="flex">
            <span className="text-muted-foreground">├─</span>
            <span className="ml-2 text-muted-foreground">Utilization</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">30%</span>
          </div>
          <div className="flex">
            <span className="text-muted-foreground">├─</span>
            <span className="ml-2 text-muted-foreground">LP APY</span>
            <span className="ml-auto font-medium tabular-nums text-white">5.00%</span>
          </div>
          <div className="flex">
            <span className="text-muted-foreground">└─</span>
            <span className="ml-2 text-muted-foreground">Active PSPs</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">3</span>
          </div>
        </div>
      </div>
    </div>
  )
}
