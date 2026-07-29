#!/usr/bin/env bash
# Deploy HederaPay to Oracle VM from local machine (does not touch NewsFacts).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/oracle-vm.env"

SSH_OPTS=(-i "${ORACLE_SSH_KEY}" -o StrictHostKeyChecking=no)
REMOTE="${ORACLE_VM_USER}@${ORACLE_VM_IP}"

echo "==> Rsync HederaPay → ${REMOTE}:${REMOTE_DIR}"
ssh "${SSH_OPTS[@]}" "${REMOTE}" "mkdir -p ${REMOTE_DIR}"

rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .logs \
  --exclude contracts/cache \
  --exclude contracts/artifacts \
  --exclude .git \
  -e "ssh ${SSH_OPTS[*]}" \
  "${ROOT}/" "${REMOTE}:${REMOTE_DIR}/"

echo "==> Copy production .env"
scp "${SSH_OPTS[@]}" "${ROOT}/.env" "${REMOTE}:${REMOTE_DIR}/.env"

echo "==> Run VM setup (port 8080)"
ssh "${SSH_OPTS[@]}" "${REMOTE}" \
  "chmod +x ${REMOTE_DIR}/deploy/setup-hederapay-vm.sh && \
   APP_DIR=${REMOTE_DIR} FRONTEND_PORT=${FRONTEND_PORT} BACKEND_PORT=${BACKEND_PORT} \
   AGENT_DATA_PORT=${AGENT_DATA_PORT} AGENT_POOL_PORT=${AGENT_POOL_PORT} \
   PUBLIC_URL=${PUBLIC_URL} bash ${REMOTE_DIR}/deploy/setup-hederapay-vm.sh"

echo ""
echo "Deployed: ${PUBLIC_URL}"
echo "Demo: lp@hederapay.test / hederapay123"
