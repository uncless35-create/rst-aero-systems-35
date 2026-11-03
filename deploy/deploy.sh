#!/usr/bin/env bash
# Выкладка сайта: забирает main из GitHub, собирает релиз и переключает на него.
# Запускается таймером rst-deploy.timer раз в минуту; если новых коммитов нет — сразу выходит.
# Ручной запуск (пересобрать текущий коммит): sudo -u rst /srv/rst/bin/deploy.sh --force
set -euo pipefail

REPO="https://github.com/uncless35-create/rst-aero-systems-35.git"
BASE="/srv/rst"
KEEP=3 # сколько релизов хранить для отката

exec 9>"$BASE/deploy.lock"
flock -n 9 || exit 0

force=false
[ "${1:-}" = "--force" ] && force=true

env_value() {
  grep -E "^$1=" "$BASE/shared/.env" | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'
}

# Сообщение владельцу в Telegram — только о проблемах, чтобы не засорять чат с покупателями.
notify() {
  local token chat
  token=$(env_value TELEGRAM_BOT_TOKEN) chat=$(env_value TELEGRAM_CHAT_ID)
  [ -n "$token" ] && [ -n "$chat" ] || return 0
  curl -fsS -m 15 -o /dev/null "https://api.telegram.org/bot$token/sendMessage" \
    --data-urlencode "chat_id=$chat" --data-urlencode "text=$1" || true
}

sha=$(git ls-remote "$REPO" refs/heads/main | cut -f1)
[ -n "$sha" ] || { echo "GitHub недоступен" >&2; exit 1; }
current=$(basename "$(readlink -f "$BASE/current" 2>/dev/null || echo none)")
if ! $force; then
  [ "$sha" = "$current" ] && exit 0
  [ -e "$BASE/releases/.failed-$sha" ] && exit 0
fi

dir="$BASE/releases/$sha"
log="$BASE/logs/deploy-$(date +%Y%m%d-%H%M%S)-${sha:0:7}.log"

# Шаги связаны через &&: set -e внутри условия if не срабатывает.
build() {
  rm -rf "$dir" &&
    git clone -q --depth 1 --branch main "$REPO" "$dir" &&
    [ "$(git -C "$dir" rev-parse HEAD)" = "$sha" ] &&
    ln -s "$BASE/shared/.env" "$dir/.env" &&
    cd "$dir" &&
    pnpm install --frozen-lockfile &&
    pnpm exec prisma migrate deploy &&
    NODE_OPTIONS=--max-old-space-size=1536 nice -n 10 pnpm build
}

echo "Сборка ${sha:0:7}, лог: $log"
if ! build >"$log" 2>&1; then
  touch "$BASE/releases/.failed-$sha"
  rm -rf "$dir"
  notify "⚠️ Сайт: сборка ${sha:0:7} не удалась, работает прежняя версия. Лог: $log"
  exit 1
fi

previous=$(readlink -f "$BASE/current" 2>/dev/null || true)
ln -sfn "$dir" "$BASE/current.tmp" && mv -Tf "$BASE/current.tmp" "$BASE/current"
sudo /usr/bin/systemctl restart rst-web

healthy() {
  for _ in $(seq 1 45); do
    curl -fsS -m 10 -o /dev/null http://127.0.0.1:3000/ && return 0
    sleep 2
  done
  return 1
}

if ! healthy; then
  if [ -n "$previous" ] && [ -d "$previous" ]; then
    ln -sfn "$previous" "$BASE/current.tmp" && mv -Tf "$BASE/current.tmp" "$BASE/current"
    sudo /usr/bin/systemctl restart rst-web
  fi
  touch "$BASE/releases/.failed-$sha"
  notify "⚠️ Сайт: версия ${sha:0:7} не запустилась, вернул прежнюю. Лог: $log"
  exit 1
fi
echo "Выложено: ${sha:0:7}"

# Чистка: старые релизы (кроме текущего) и логи старше 30 дней.
live=$(readlink -f "$BASE/current")
ls -1dt "$BASE"/releases/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  [ "$(readlink -f "$old")" = "$live" ] || rm -rf "$old"
done
find "$BASE/logs" -name 'deploy-*.log' -mtime +30 -delete
