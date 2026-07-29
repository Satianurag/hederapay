#!/usr/bin/env bash
# Deploy HederaPay to Render using API key from uxmaxx account.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RENDER_API_KEY="${RENDER_API_KEY:-$(cat /home/sati/Desktop/uxmaxx/.render-api-key)}"
OWNER_ID="tea-d9eve777f7vs73bi7es0"
REPO="https://github.com/Satianurag/hederapay"

api() {
  curl -sS -H "Authorization: Bearer ${RENDER_API_KEY}" -H "Content-Type: application/json" "$@"
}

echo "==> Delete open-netting if present"
OPEN_ID=$(api "https://api.render.com/v1/services?name=open-netting" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for x in d:
  s=x.get('service',x)
  if s.get('name')=='open-netting':
    print(s['id']); break
" 2>/dev/null || true)
if [[ -n "${OPEN_ID:-}" ]]; then
  api -X DELETE "https://api.render.com/v1/services/${OPEN_ID}"
  echo "Deleted open-netting (${OPEN_ID})"
else
  echo "open-netting not on Render (already removed)"
fi

echo "==> Create blueprint from GitHub"
BP_RESP=$(api -X POST "https://api.render.com/v1/blueprints" -d "$(cat <<JSON
{
  "name": "hederapay",
  "ownerId": "${OWNER_ID}",
  "repo": "${REPO}",
  "branch": "main"
}
JSON
)" 2>&1) || true
echo "$BP_RESP" | python3 -m json.tool 2>/dev/null || echo "$BP_RESP"

# If blueprint exists, trigger sync
BP_ID=$(echo "$BP_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || true)
if [[ -z "${BP_ID:-}" ]]; then
  BP_ID=$(api "https://api.render.com/v1/blueprints?limit=20" | python3 -c "
import json,sys
for x in json.load(sys.stdin):
  b=x.get('blueprint',x)
  if b.get('name')=='hederapay':
    print(b['id']); break
" 2>/dev/null || true)
fi

if [[ -n "${BP_ID:-}" ]]; then
  echo "==> Sync blueprint ${BP_ID}"
  api -X POST "https://api.render.com/v1/blueprints/${BP_ID}/sync" -d '{}' | python3 -m json.tool 2>/dev/null || true
fi

echo "==> Services"
api "https://api.render.com/v1/services?limit=20" | python3 -c "
import json,sys
for x in json.load(sys.stdin):
  s=x.get('service',x)
  url=s.get('serviceDetails',{}).get('url','')
  print(f\"{s.get('name')}: {url or s.get('id')}\")
"
