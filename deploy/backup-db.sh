#!/usr/bin/env bash
# Ежедневная копия базы, с которой работает сайт (DIRECT_URL из /srv/rst/shared/.env).
# Запускается таймером rst-backup.timer; хранит копии 14 дней.
# Восстановление: pg_restore --clean --if-exists --no-owner -d "<url>" <файл.dump>
set -euo pipefail

BASE="/srv/rst"
DEST="$BASE/backups"
mkdir -p "$DEST"
cd "$DEST" # при ручном запуске через sudo рабочая папка может быть недоступна (/root)

url=$(grep -E '^DIRECT_URL=' "$BASE/shared/.env" | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')
file="$DEST/rst-$(date +%Y%m%d-%H%M).dump"

pg_dump --format=custom --no-owner --no-privileges --schema=public --file="$file.tmp" "$url"
mv "$file.tmp" "$file"
find "$DEST" -name 'rst-*.dump' -mtime +14 -delete
echo "Копия базы: $file ($(du -h "$file" | cut -f1))"
