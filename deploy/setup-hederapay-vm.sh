#!/usr/bin/env bash
# Run ON the Oracle VM — adds HederaPay on port 8080 without touching NewsFacts (:80 → :3002).
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/hederapay}"
FRONTEND_PORT="${FRONTEND_PORT:-3010}"
BACKEND_PORT="${BACKEND_PORT:-4010}"
AGENT_DATA_PORT="${AGENT_DATA_PORT:-4011}"
AGENT_POOL_PORT="${AGENT_POOL_PORT:-4012}"
PUBLIC_PORT="${PUBLIC_PORT:-8080}"
PUBLIC_URL="${PUBLIC_URL:-http://$(curl -s -4 ifconfig.me):${PUBLIC_PORT}}"

echo "==> HederaPay VM setup (non-destructive — NewsFacts untouched)"

if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi

# Allow HederaPay public port only (do not change port 80 rules)
if command -v iptables >/dev/null; then
  sudo iptables -C INPUT -p tcp --dport "${PUBLIC_PORT}" -j ACCEPT 2>/dev/null || \
    sudo iptables -I INPUT 6 -p tcp --dport "${PUBLIC_PORT}" -j ACCEPT
fi

echo "==> Nginx site hederapay on :${PUBLIC_PORT}"
sudo tee /etc/nginx/sites-available/hederapay >/dev/null <<NGINX
server {
    listen ${PUBLIC_PORT};
    listen [::]:${PUBLIC_PORT};
    server_name _;

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/hederapay /etc/nginx/sites-enabled/hederapay
sudo nginx -t
sudo systemctl reload nginx

unit() {
  local name="$1" workdir="$2" cmd="$3"
  sudo tee "/etc/systemd/system/hederapay-${name}.service" >/dev/null <<UNIT
[Unit]
Description=HederaPay ${name}
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=${workdir}
EnvironmentFile=${APP_DIR}/.env
Environment=NODE_OPTIONS=--max-old-space-size=768
ExecStart=${cmd}
Restart=always
RestartSec=8

[Install]
WantedBy=multi-user.target
UNIT
}

unit backend "${APP_DIR}/backend" "/usr/bin/npx tsx src/server.ts"
unit frontend "${APP_DIR}/frontend" "/usr/bin/env PORT=${FRONTEND_PORT} HOSTNAME=0.0.0.0 /usr/bin/node .next/standalone/server.js"
unit data-agent "${APP_DIR}/agent" "/usr/bin/env PORT=${AGENT_DATA_PORT} /usr/bin/npx tsx src/dataService.ts"
unit pool-agent "${APP_DIR}/agent" "/usr/bin/env PORT=${AGENT_POOL_PORT} /usr/bin/npx tsx src/poolMonitorAgent.ts"
unit automation "${APP_DIR}/hedera-automation" "/usr/bin/npm start"

sudo systemctl daemon-reload

if [[ -f "${APP_DIR}/backend/package.json" ]]; then
  cd "${APP_DIR}/backend"
  npm ci 2>/dev/null || npm install
  npm rebuild bcrypt
  set -a && source "${APP_DIR}/.env" && set +a
  npx prisma generate
  npx prisma db push --accept-data-loss
  node scripts/seed-demo-users.mjs || true
fi

if [[ -f "${APP_DIR}/agent/package.json" ]]; then
  cd "${APP_DIR}/agent" && npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
fi

if [[ -f "${APP_DIR}/hedera-automation/package.json" ]]; then
  cd "${APP_DIR}/hedera-automation" && npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
fi

if [[ -f "${APP_DIR}/frontend/package.json" ]]; then
  cd "${APP_DIR}/frontend"
  if [[ ! -f .next/standalone/server.js ]]; then
    echo "WARN: frontend standalone build missing — run local: cd frontend && NEXT_PUBLIC_API_URL=${PUBLIC_URL}/api npm run build"
  else
    cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
    cp -r public .next/standalone/public 2>/dev/null || true
  fi
fi

# Patch runtime URLs in .env
grep -q '^NEXT_PUBLIC_API_URL=' "${APP_DIR}/.env" && \
  sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=${PUBLIC_URL}/api|" "${APP_DIR}/.env" || \
  echo "NEXT_PUBLIC_API_URL=${PUBLIC_URL}/api" >>"${APP_DIR}/.env"
grep -q '^PORT=' "${APP_DIR}/.env" && sed -i "s|^PORT=.*|PORT=${BACKEND_PORT}|" "${APP_DIR}/.env" || echo "PORT=${BACKEND_PORT}" >>"${APP_DIR}/.env"
grep -q '^AGENT_DATA_SERVICE_URL=' "${APP_DIR}/.env" && \
  sed -i "s|^AGENT_DATA_SERVICE_URL=.*|AGENT_DATA_SERVICE_URL=http://127.0.0.1:${AGENT_DATA_PORT}|" "${APP_DIR}/.env" || \
  echo "AGENT_DATA_SERVICE_URL=http://127.0.0.1:${AGENT_DATA_PORT}" >>"${APP_DIR}/.env"
grep -q '^POOL_MONITOR_URL=' "${APP_DIR}/.env" && \
  sed -i "s|^POOL_MONITOR_URL=.*|POOL_MONITOR_URL=http://127.0.0.1:${AGENT_POOL_PORT}|" "${APP_DIR}/.env" || \
  echo "POOL_MONITOR_URL=http://127.0.0.1:${AGENT_POOL_PORT}" >>"${APP_DIR}/.env"

sudo systemctl enable hederapay-backend hederapay-frontend hederapay-data-agent hederapay-pool-agent hederapay-automation
sudo systemctl restart hederapay-backend hederapay-frontend hederapay-data-agent hederapay-pool-agent hederapay-automation

echo "==> Done. HederaPay: ${PUBLIC_URL}"
echo "    API health: curl ${PUBLIC_URL}/api/health"
echo "    NewsFacts unchanged: curl http://127.0.0.1/health"
