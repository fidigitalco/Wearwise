#!/usr/bin/env bash
# Update WearWise on the server: pull, install, migrate, refresh the demo catalogue, restart.
# Run with sudo from an admin account: sudo /opt/wearwise/backend/deploy/deploy.sh
# The app steps run as the wearwise user; only the restart needs root.
set -euo pipefail
as_app() { sudo -u wearwise bash -c "set -a; . /etc/wearwise/wearwise.env; set +a; cd /opt/wearwise && $1"; }
as_app "git pull --ff-only"
as_app "venv/bin/pip install -q -r backend/requirements.txt"
as_app "cd backend && ../venv/bin/python manage.py migrate --noinput"
as_app "cd backend && ../venv/bin/python manage.py collectstatic --noinput"
as_app "cd backend && ../venv/bin/python manage.py load_catalog"
systemctl restart wearwise-gunicorn
echo "WearWise deployed: $(sudo -u wearwise git -C /opt/wearwise rev-parse --short HEAD)"
