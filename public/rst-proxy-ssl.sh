#!/usr/bin/env bash
set -e
BACKEND="rst-aero-systems-35-29rj.vercel.app"
echo ">>> Получаю SSL-сертификат для rst-aero.ru..."
certbot certonly --webroot -w /var/www/certbot -d rst-aero.ru \
  --agree-tos -m admin@rst-aero.ru --non-interactive || {
  echo ""; echo "!!! Сертификат не выдан. Убедись, что DNS rst-aero.ru уже указывает на этот сервер (178.20.208.26), и запусти команду ещё раз."; exit 1; }

echo ">>> Настраиваю прокси на Vercel с кешем..."
cat > /etc/nginx/sites-available/rst-aero.ru <<NGINX
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=rst:20m max_size=1g inactive=7d use_temp_path=off;

server {
    listen 80;
    listen [::]:80;
    server_name rst-aero.ru www.rst-aero.ru;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://rst-aero.ru\$request_uri; }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name rst-aero.ru;

    ssl_certificate     /etc/letsencrypt/live/rst-aero.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rst-aero.ru/privkey.pem;

    resolver 77.88.8.8 8.8.8.8 valid=60s;
    client_max_body_size 25m;
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location / {
        set \$backend "$BACKEND";
        proxy_pass https://\$backend;
        proxy_ssl_server_name on;
        proxy_ssl_name \$backend;
        proxy_http_version 1.1;
        proxy_set_header Host rst-aero.ru;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "";

        proxy_cache rst;
        proxy_cache_key \$scheme\$host\$request_uri;
        proxy_cache_use_stale error timeout updating http_502 http_503 http_504;
        add_header X-Proxy-Cache \$upstream_cache_status always;

        proxy_connect_timeout 15s;
        proxy_read_timeout 60s;
    }
}
NGINX
nginx -t
systemctl reload nginx
echo ""
echo "==== ГОТОВО: сайт rst-aero.ru работает через российский прокси с SSL ===="
