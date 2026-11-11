#!/usr/bin/env bash
# One-time setup of the WearWise admin panel (Next.js) on the server, next to the API.
# Run as root: bash /opt/wearwise/backend/deploy/setup-admin.sh
# Safe to run again: each step checks before it changes anything.
#   Panel:  https://wearwise-admin.164.68.119.214.sslip.io  (127.0.0.1:3012 behind Caddy)
#   API:    https://wearwise.164.68.119.214.sslip.io        (unchanged)
set -euo pipefail
ADMIN_HOST=wearwise-admin.164.68.119.214.sslip.io
API_URL=https://wearwise.164.68.119.214.sslip.io
ENV_FILE=/etc/wearwise/wearwise.env

# 1. Node 18+ (Next 14 needs it). Installs Node 20 from NodeSource only when missing or too old.
need_node() { ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; }
if need_node; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "node $(node -v)"

# 2. Pull and build as the wearwise user.
sudo -u wearwise git -C /opt/wearwise pull --ff-only
sudo -u wearwise bash -c "cd /opt/wearwise/admin && echo 'NEXT_PUBLIC_API_URL=$API_URL' > .env.production && npm ci --no-audit --no-fund && npm run build"

# 3. Let the panel's origin call the API (CORS), then restart the API.
if ! grep -q "$ADMIN_HOST" "$ENV_FILE"; then
  if grep -q '^CORS_ALLOWED_ORIGINS=.\+' "$ENV_FILE"; then
    sed -i "s|^CORS_ALLOWED_ORIGINS=\(.*\)|CORS_ALLOWED_ORIGINS=\1,https://$ADMIN_HOST|" "$ENV_FILE"
  elif grep -q '^CORS_ALLOWED_ORIGINS=' "$ENV_FILE"; then
    sed -i "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=https://$ADMIN_HOST|" "$ENV_FILE"
  else
    echo "CORS_ALLOWED_ORIGINS=https://$ADMIN_HOST" >> "$ENV_FILE"
  fi
  systemctl restart wearwise-gunicorn
fi

# 4. The panel as a service.
install -m 644 /opt/wearwise/backend/deploy/wearwise-admin.service /etc/systemd/system/wearwise-admin.service
systemctl daemon-reload
systemctl enable --now wearwise-admin
systemctl restart wearwise-admin

# 5. Caddy: add the panel's block once (SaveDo's and the API's blocks stay as they are).
if ! grep -q "$ADMIN_HOST" /etc/caddy/Caddyfile; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%s)"
  printf '\n%s {\n\tencode gzip\n\treverse_proxy 127.0.0.1:3012\n}\n' "$ADMIN_HOST" >> /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile
  systemctl reload caddy
fi

echo "Admin panel: https://$ADMIN_HOST"
