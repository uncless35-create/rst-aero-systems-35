#!/usr/bin/env bash
set -e
export DEBIAN_FRONTEND=noninteractive
echo ">>> Устанавливаю nginx и certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot >/dev/null
mkdir -p /var/www/certbot
cat > /etc/nginx/sites-available/rst-aero.ru <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name rst-aero.ru www.rst-aero.ru;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'RST proxy: setup in progress'; add_header Content-Type text/plain; }
}
NGINX
ln -sf /etc/nginx/sites-available/rst-aero.ru /etc/nginx/sites-enabled/rst-aero.ru
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx >/dev/null 2>&1 || true
echo ""
echo "==== ШАГ 1 ГОТОВ: nginx установлен и запущен ===="
