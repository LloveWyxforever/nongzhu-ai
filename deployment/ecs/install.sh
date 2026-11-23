#!/usr/bin/env bash
set -euo pipefail
cd /opt/nongzhu
if [ "$(id -u)" != 0 ]; then echo 'Run as root'; exit 1; fi
apt-get install -y python3-venv nginx apache2-utils
id nongzhu >/dev/null 2>&1 || useradd --system --home /opt/nongzhu --shell /usr/sbin/nologin nongzhu
python3 -m venv /opt/nongzhu/venv
/opt/nongzhu/venv/bin/pip install -r backend/requirements.txt
if [ ! -f .env ]; then install -m 600 .env.server.example .env; fi
mkdir -p data/uploads knowledge
chown -R nongzhu:nongzhu /opt/nongzhu
chmod 700 /opt/nongzhu/data /opt/nongzhu/knowledge
chmod 600 .env
if [ ! -f /etc/nginx/nongzhu.htpasswd ]; then
 echo 'Set a website login password for user admin (input is hidden):'
 htpasswd -c /etc/nginx/nongzhu.htpasswd admin
fi
install -m 644 nongzhu.service /etc/systemd/system/nongzhu.service
install -m 644 nginx.conf /etc/nginx/sites-available/nongzhu
if [ -L /etc/nginx/sites-enabled/default ]; then unlink /etc/nginx/sites-enabled/default; fi
ln -sfn /etc/nginx/sites-available/nongzhu /etc/nginx/sites-enabled/nongzhu
nginx -t
systemctl daemon-reload
systemctl enable --now nongzhu
systemctl reload nginx
for attempt in $(seq 1 30); do
 if curl -fsS http://127.0.0.1:8017/api/health; then printf '\nBackend ready. Website requires admin login.\n'; exit 0; fi
 sleep 1
done
echo 'Backend not ready; run: journalctl -u nongzhu -n 40 --no-pager'
exit 1
