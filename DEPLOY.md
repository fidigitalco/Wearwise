# WearWise — deploy on the SaveDo Contabo server

The API runs next to SaveDo on `164.68.119.214`, without touching it: its own
user, folder, Postgres database, venv and systemd service, and one extra Caddy
block. Address: **`https://wearwise.164.68.119.214.sslip.io`** (sslip.io points
the name at the IP, so no DNS change; Caddy gets the HTTPS certificate itself).

| | SaveDo (leave alone) | WearWise (new) |
|---|---|---|
| Folder | `/opt/savedo` | `/opt/wearwise` |
| Secrets | `/etc/savedo/savedo.env` | `/etc/wearwise/wearwise.env` |
| Database | `savedo` | `wearwise` |
| App port | `127.0.0.1:8000` | `127.0.0.1:8010` |
| Service | `savedo-gunicorn` … | `wearwise-gunicorn` |

> **Running this with Claude Code on the server?** Go step by step and confirm
> each one. Do not edit, restart or remove anything that belongs to SaveDo; the
> only shared file is `/etc/caddy/Caddyfile`, and WearWise only appends to it.

## 1. User and folder

```bash
sudo adduser --system --group --home /opt/wearwise wearwise
sudo -u wearwise git clone -b wearwise-v3 https://github.com/fidigitalco/Wearwise.git /opt/wearwise
```

The repo is private: use a GitHub deploy key or a fine-grained token with read access to `fidigitalco/Wearwise`.

## 2. Python

```bash
sudo -u wearwise python3 -m venv /opt/wearwise/venv
sudo -u wearwise /opt/wearwise/venv/bin/pip install -r /opt/wearwise/backend/requirements.txt
```

## 3. Database (the Postgres SaveDo already runs)

```bash
sudo -u postgres psql -c "CREATE ROLE wearwise LOGIN PASSWORD '<generate one>';"
sudo -u postgres psql -c "CREATE DATABASE wearwise OWNER wearwise;"
```

## 4. Secrets

```bash
sudo mkdir -p /etc/wearwise
sudo cp /opt/wearwise/backend/deploy/wearwise.env.example /etc/wearwise/wearwise.env
sudo chown wearwise:wearwise /etc/wearwise/wearwise.env && sudo chmod 600 /etc/wearwise/wearwise.env
sudo -u wearwise nano /etc/wearwise/wearwise.env   # interactive
```

Fill in `DJANGO_SECRET_KEY` (`python3 -c "import secrets; print(secrets.token_urlsafe(50))"`), the
database password from step 3 and `GROQ_API_KEY` (free at console.groq.com; voice questions use it so the
server never loads the 1.6 GB local Whisper model next to SaveDo).

## 5. Migrate, static files, demo catalogue, an admin

```bash
cd /opt/wearwise/backend
sudo -u wearwise bash -c 'set -a; . /etc/wearwise/wearwise.env; set +a; \
  ../venv/bin/python manage.py migrate && ../venv/bin/python manage.py collectstatic --noinput && \
  ../venv/bin/python manage.py load_catalog'
sudo -u wearwise bash -c 'set -a; . /etc/wearwise/wearwise.env; set +a; ../venv/bin/python manage.py createsuperuser'   # interactive
```

## 6. Service

```bash
sudo cp /opt/wearwise/backend/deploy/wearwise-gunicorn.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now wearwise-gunicorn
curl -s 127.0.0.1:8010/api/meta/ | head -c 80
```

## 7. Caddy (append only)

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%F)
cat /opt/wearwise/backend/deploy/Caddyfile.wearwise | sudo tee -a /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
curl -s https://wearwise.164.68.119.214.sslip.io/api/meta/ | head -c 80
curl -s -o /dev/null -w "%{http_code}\n" https://api.save-do.com/   # SaveDo still answers
```

## 8. The app (dev machine)

`frontend/eas.json` → `preview.env.EXPO_PUBLIC_API_BASE_URL` = `https://wearwise.164.68.119.214.sslip.io/api`,
then `npx eas-cli build -p android --profile preview`. That APK works on any network.

## Updates later

```bash
sudo /opt/wearwise/backend/deploy/deploy.sh
```

Logs: `journalctl -u wearwise-gunicorn -f`. Media (uploaded photos) live in `/opt/wearwise/backend/media`.

## Admin panel

One time, as root on the server:

```bash
bash /opt/wearwise/backend/deploy/setup-admin.sh
```

It installs Node 20 if needed, builds `admin/` against the live API, adds the panel's origin to `CORS_ALLOWED_ORIGINS`, installs the `wearwise-admin` service (127.0.0.1:3012) and adds a Caddy block for `https://wearwise-admin.164.68.119.214.sslip.io`. After that, `deploy.sh` rebuilds and restarts the panel on every deploy. Sign in with a staff account (`manage.py createsuperuser`, step 5).
