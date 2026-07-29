#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="$ROOT/e2e-proof-report.txt"
FAIL=0

log() { echo "$@" | tee -a "$REPORT"; }
run() {
  local name="$1"
  shift
  log ""
  log "=== $name ==="
  if (cd "$ROOT" && "$@") >>"$REPORT" 2>&1; then
    log "PASS: $name"
  else
    log "FAIL: $name"
    FAIL=1
  fi
}

: >"$REPORT"
log "HederaPay Hedera E2E Verification — $(date -Iseconds)"
log "Root: $ROOT"

run "Contracts unit tests" bash -c "cd contracts && npx hardhat test"
run "Contracts compile" bash -c "cd contracts && npx hardhat compile"
run "Backend TypeScript" bash -c "cd backend && npm run build"
run "Agent TypeScript" bash -c "cd agent && npx tsc --noEmit"
run "Hedera automation TypeScript" bash -c "cd hedera-automation && npx tsc --noEmit"
run "Frontend TypeScript" bash -c "cd frontend && npx tsc --noEmit"
run "Frontend build" bash -c "cd frontend && npm run build"

log ""
log "=== SaucerSwap live quote (testnet) ==="
if (cd "$ROOT/backend" && node scripts/verify-saucerswap-quote.mjs) >>"$REPORT" 2>&1; then
  log "PASS: SaucerSwap live quote"
else
  log "FAIL: SaucerSwap live quote"
  FAIL=1
fi

log ""
log "=== DeFiLlama live market data ==="
if (cd "$ROOT/agent" && npx tsx scripts/verify-defillama.ts) >>"$REPORT" 2>&1; then
  log "PASS: DeFiLlama live market data"
else
  log "FAIL: DeFiLlama live market data"
  FAIL=1
fi

log ""
log "=== Credit risk drawdown wiring ==="
if (cd "$ROOT/backend" && npx tsx scripts/verify-credit-risk-wire.ts) >>"$REPORT" 2>&1; then
  log "PASS: Credit risk drawdown wiring"
else
  log "FAIL: Credit risk drawdown wiring"
  FAIL=1
fi

log ""
log "=== Chainlink HBAR/USD oracle (testnet) ==="
if (cd "$ROOT/backend" && node scripts/verify-chainlink-hbar.mjs) >>"$REPORT" 2>&1; then
  log "PASS: Chainlink HBAR/USD oracle"
else
  log "FAIL: Chainlink HBAR/USD oracle"
  FAIL=1
fi

log ""
log "=== x402 USDC route config ==="
if (cd "$ROOT/agent" && npx tsx scripts/verify-x402-usdc-config.ts) >>"$REPORT" 2>&1; then
  log "PASS: x402 USDC route config"
else
  log "FAIL: x402 USDC route config"
  FAIL=1
fi

log ""
log "=== Hedera WebSocket (optional) ==="
if (cd "$ROOT/backend" && node scripts/verify-hedera-ws.mjs) >>"$REPORT" 2>&1; then
  log "PASS: Hedera WebSocket (or skipped)"
else
  log "FAIL: Hedera WebSocket"
  FAIL=1
fi

log ""
log "=== Event log polling (testnet) ==="
if (cd "$ROOT/backend" && node scripts/verify-event-poller.mjs) >>"$REPORT" 2>&1; then
  log "PASS: Event log polling"
else
  log "FAIL: Event log polling"
  FAIL=1
fi

log ""
log "=== Legacy reference grep (active source only) ==="
SEARCH_DIRS="agent/src backend/src contracts/src contracts/scripts contracts/test frontend/app frontend/components frontend/lib hedera-automation/src"
LEGACY=""
for dir in $SEARCH_DIRS; do
  if [ -d "$ROOT/$dir" ]; then
    hits=$(rg -l '5042002|arcscan|Arc Testnet|Uniswap Trading|cre-workflow|ARC_RPC|UNISWAP_API' "$ROOT/$dir" 2>/dev/null || true)
    if [ -n "$hits" ]; then LEGACY="${LEGACY}${hits}"$'\n'; fi
  fi
done
LEGACY=$(echo "$LEGACY" | sed '/^$/d' | sort -u || true)
if [ -n "$LEGACY" ]; then
  log "FAIL: Legacy references found:"
  log "$LEGACY"
  FAIL=1
else
  log "PASS: No legacy Arc/Uniswap/CRE references in active source"
fi

log ""
log "=== Warning suppression grep (active source only) ==="
SUPPRESS=""
for dir in $SEARCH_DIRS; do
  if [ -d "$ROOT/$dir" ]; then
    hits=$(rg -l '@ts-ignore|eslint-disable|ts-nocheck' "$ROOT/$dir" 2>/dev/null || true)
    if [ -n "$hits" ]; then SUPPRESS="${SUPPRESS}${hits}"$'\n'; fi
  fi
done
SUPPRESS=$(echo "$SUPPRESS" | sed '/^$/d' | sort -u || true)
if [ -n "$SUPPRESS" ]; then
  log "FAIL: Warning suppressions found"
  FAIL=1
else
  log "PASS: No warning suppressions"
fi

log ""
if [ "$FAIL" -eq 0 ]; then
  log "✅ ALL E2E CHECKS PASSED"
  exit 0
else
  log "❌ SOME CHECKS FAILED — see $REPORT"
  exit 1
fi
