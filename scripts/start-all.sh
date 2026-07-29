#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { echo "[start-all] $*"; }

if [ ! -f "$ROOT/.env" ]; then
  log "ERROR: .env missing — copy .env.example and set DATABASE_URL + Hedera keys"
  exit 1
fi

if ! grep -q '^DATABASE_URL=.' "$ROOT/.env" 2>/dev/null; then
  log "ERROR: DATABASE_URL not set in .env (Neon PostgreSQL required)"
  exit 1
fi

kill_port() {
  local port="$1"
  if fuser "${port}/tcp" >/dev/null 2>&1; then
    log "Freeing port ${port}..."
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
    sleep 1
  fi
}

for port in 4000 4001 4002 3000; do
  kill_port "$port"
done

mkdir -p "$ROOT/.logs"

# Frontend env (Next.js reads frontend/.env.local)
if [ -f "$ROOT/.env" ]; then
  grep -E '^(NEXT_PUBLIC_|JWT_SECRET|HEDERA_RPC_URL|BACKEND_API_URL)=' "$ROOT/.env" >"$ROOT/frontend/.env.local" 2>/dev/null || true
  if ! grep -q NEXT_PUBLIC_API_URL "$ROOT/frontend/.env.local" 2>/dev/null; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" >>"$ROOT/frontend/.env.local"
  fi
  if ! grep -q BACKEND_API_URL "$ROOT/frontend/.env.local" 2>/dev/null; then
    echo "BACKEND_API_URL=http://localhost:4000/api" >>"$ROOT/frontend/.env.local"
  fi
fi

log "Prisma generate + db push"
(cd "$ROOT/backend" && npx prisma generate && npx prisma db push --accept-data-loss) >>"$ROOT/.logs/prisma.log" 2>&1

log "Backend → :4000"
(cd "$ROOT/backend" && npm run start) >"$ROOT/.logs/backend.log" 2>&1 &

log "Data Service → :4001"
(cd "$ROOT/agent" && npm run data-service) >"$ROOT/.logs/data-service.log" 2>&1 &

log "Pool Monitor → :4002"
(cd "$ROOT/agent" && npm run pool-monitor) >"$ROOT/.logs/pool-monitor.log" 2>&1 &

log "Hedera Automation"
(cd "$ROOT/hedera-automation" && npm start) >"$ROOT/.logs/automation.log" 2>&1 &

log "Frontend → :3000"
(cd "$ROOT/frontend" && npm run dev) >"$ROOT/.logs/frontend.log" 2>&1 &

sleep 6

echo ""
echo "══════════════════════════════════════════"
echo "  HederaPay — Hedera Testnet (full stack)"
echo "══════════════════════════════════════════"
echo "  Frontend:      http://localhost:3000"
echo "  Backend API:   http://localhost:4000/api"
echo "  Data Service:  http://localhost:4001"
echo "  Pool Monitor:  http://localhost:4002"
echo "  Logs:          $ROOT/.logs/"
echo "══════════════════════════════════════════"
echo ""

for svc in "Backend:4000" "Data:4001" "Pool:4002" "Frontend:3000"; do
  name="${svc%%:*}"
  port="${svc##*:}"
  if curl -s -o /dev/null -w "" --max-time 3 "http://localhost:${port}/" 2>/dev/null || \
     curl -s -o /dev/null -w "" --max-time 3 "http://localhost:${port}/api/agent/health" 2>/dev/null || \
     curl -s -o /dev/null -w "" --max-time 3 "http://localhost:${port}/api/agent/pool-monitor/health" 2>/dev/null; then
    echo "  ✓ $name (port $port)"
  else
    echo "  ✗ $name (port $port) — check .logs/"
  fi
done

echo ""
log "Done. Connect HashPack on Hedera testnet in the browser."
log "Demo logins: lp@hederapay.test / psp@hederapay.test / admin@hederapay.test — password: hederapay123"
(cd "$ROOT/backend" && node scripts/seed-demo-users.mjs) >/dev/null 2>&1 || true
