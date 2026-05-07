#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# ── defaults (можно переопределить через env) ─────────────────────
DOMAIN="${DOMAIN:-db.cashercollection.com}"
ACME_EMAIL="${ACME_EMAIL:-admin@cashercollection.com}"
SERVER_IP="${SERVER_IP:-186.246.4.160}"
SSH_USER="${SSH_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/proizvodstvo}"
MODE="${MODE:-auto}"

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
red()   { printf '\033[1;31m%s\033[0m\n' "$*" >&2; }
hr()    { printf '%s\n' "──────────────────────────────────────────────────────────────"; }

# ── auto-detect: server (linux + docker + наш IP на интерфейсе) ───
if [[ "$MODE" == "auto" ]]; then
  if [[ "$(uname -s)" == "Linux" ]] && command -v docker >/dev/null 2>&1; then
    if (command -v ip  >/dev/null 2>&1 && ip -4 addr show 2>/dev/null | grep -q "$SERVER_IP") \
    || (command -v hostname >/dev/null 2>&1 && hostname -I 2>/dev/null | grep -q "$SERVER_IP"); then
      MODE="server"
    fi
  fi
fi
[[ "$MODE" == "auto" ]] && MODE="local"

# ════════════════════════════════════════════════════════════════
# LOCAL MODE  (Mac/laptop) — sync to remote and trigger server mode
# ════════════════════════════════════════════════════════════════
if [[ "$MODE" == "local" ]]; then
  command -v rsync >/dev/null 2>&1 || { red "rsync не найден. brew install rsync"; exit 1; }
  command -v ssh   >/dev/null 2>&1 || { red "ssh не найден"; exit 1; }

  bold "▶ Деплой на ${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}"
  hr

  bold "▶ Проверяю SSH-доступ"
  if ! ssh -p "$SSH_PORT" -o BatchMode=yes -o ConnectTimeout=8 \
        "${SSH_USER}@${SERVER_IP}" 'echo ok' >/dev/null 2>&1; then
    red "SSH не пускает: ${SSH_USER}@${SERVER_IP}:${SSH_PORT}"
    red "Добавь публичный ключ:  ssh-copy-id -p ${SSH_PORT} ${SSH_USER}@${SERVER_IP}"
    exit 1
  fi
  green "  ssh: ok"

  bold "▶ Готовлю каталог на сервере"
  ssh -p "$SSH_PORT" "${SSH_USER}@${SERVER_IP}" "mkdir -p '${REMOTE_DIR}' '${REMOTE_DIR}/.data'"

  bold "▶ Проверяю Docker на сервере"
  if ! ssh -p "$SSH_PORT" "${SSH_USER}@${SERVER_IP}" \
        'command -v docker && docker compose version' >/dev/null 2>&1; then
    red "На сервере нет Docker / compose-плагина."
    echo "Установить (Debian/Ubuntu):"
    echo "  ssh ${SSH_USER}@${SERVER_IP} 'curl -fsSL https://get.docker.com | sh'"
    exit 1
  fi
  green "  docker: ok"

  bold "▶ Синхронизирую файлы (rsync)"
  rsync -az --delete \
    --exclude='/node_modules/' \
    --exclude='/.next/' \
    --exclude='/.data/' \
    --exclude='/.git/' \
    --exclude='/.cursor/' \
    --exclude='.DS_Store' \
    -e "ssh -p ${SSH_PORT}" \
    ./ "${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/"

  bold "▶ Поднимаю стек на сервере"
  hr
  ssh -p "$SSH_PORT" -t "${SSH_USER}@${SERVER_IP}" \
    "cd '${REMOTE_DIR}' && \
     chmod +x deploy.sh && \
     DOMAIN='${DOMAIN}' \
     ACME_EMAIL='${ACME_EMAIL}' \
     SERVER_IP='${SERVER_IP}' \
     MODE=server \
     ./deploy.sh"

  exit 0
fi

# ════════════════════════════════════════════════════════════════
# SERVER MODE — собирает и запускает стек на этой машине
# ════════════════════════════════════════════════════════════════

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  red "Не найден docker / docker compose. Поставьте Docker и повторите."
  exit 1
fi

mkdir -p .data

bold "▶ Собираю и запускаю стек"
hr
DOMAIN="$DOMAIN" ACME_EMAIL="$ACME_EMAIL" $DC up -d --build

bold "▶ Жду, пока приложение поднимется"
hr
attempts=0
while ! $DC exec -T app wget -q --spider http://127.0.0.1:3000 >/dev/null 2>&1; do
  attempts=$((attempts+1))
  if [ "$attempts" -ge 90 ]; then
    red "Приложение не отвечает за 90с. Логи:"
    $DC logs --tail=80 app caddy || true
    exit 1
  fi
  sleep 1
done
green "  app: ok"

PUBLIC_BASE="https://${DOMAIN}"
WEBHOOK="${PUBLIC_BASE}/api/production"

echo
green "✓ Развёрнуто"
hr
bold "Сервер"
echo "  IP:       ${SERVER_IP}"
echo "  Домен:    ${DOMAIN}"
echo "  URL:      ${PUBLIC_BASE}"
echo
bold "POST-вебхук производства"
echo "  URL:          ${WEBHOOK}"
echo "  Method:       POST"
echo "  Content-Type: application/json"
echo "  Body:"
cat <<'JSON'
  {
    "items": [
      { "name": "BLACK CASHER BEANIE", "qty": 3, "size": "M" },
      { "name": "WHITE CASHER BEANIE", "qty": 1 }
    ]
  }
JSON
echo
bold "Команды на сервере"
echo "  Логи:        ${DC} logs -f app caddy"
echo "  Статус:      ${DC} ps"
echo "  Стоп:        ${DC} down"
echo "  Перезапуск:  ./deploy.sh   (с локальной машины — пересинкает и поднимет)"
echo
bold "DNS"
echo "  A   ${DOMAIN}   →   ${SERVER_IP}"
echo "Caddy сам выпустит TLS-сертификат при первом обращении по HTTPS."
