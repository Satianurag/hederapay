import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Navigation() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            HederaPay
          </Link>
          <Link
            href="/auth"
            className="text-xs text-slate-500 transition-colors hover:text-slate-400"
          >
            Admin
          </Link>
        </div>

        <Link href="/auth">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full border-blue-400 bg-transparent px-4 text-sm font-medium text-white hover:bg-secondary"
          >
            Launch App
          </Button>
        </Link>
      </div>
    </nav>
  )
}
