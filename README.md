# proizvodstvo

Внутренний сервис учёта производства Casher Collection: дашборд остатков, очередь
производства, оприходование товаров, расходники.

## Локальная разработка

```bash
pnpm install
pnpm dev
```

Откройте `http://localhost:3000`.

## Прод-деплой одной командой

Сервер уже зашит в скрипт: `db.cashercollection.com` → `186.246.4.160`.

```bash
./deploy.sh
```

### Что произойдёт

1. **С Mac/ноута (по умолчанию)**: скрипт идёт по SSH на `root@186.246.4.160`,
   проверяет наличие Docker, синхронизирует код через `rsync` в `/opt/proizvodstvo`
   (папка `.data/` на сервере не трогается), и запускает себя на сервере в режиме
   `MODE=server`.
2. **На сервере (auto-detect по IP)**: поднимает Docker Compose стек —
   контейнер `app` (Next.js standalone) + `caddy` (auto-HTTPS Let's Encrypt).
3. Caddy выпускает TLS-сертификат при первом обращении по HTTPS.
4. Очередь производства живёт в `/opt/proizvodstvo/.data` на хосте,
   переживает перезапуски.
5. В конце печатает публичный URL и параметры POST-вебхука.

### Что нужно один раз

- На сервере `186.246.4.160`: открытые `80/443/tcp`, `443/udp`, установленный Docker
  с плагином `compose`. Если нет:
  ```bash
  ssh root@186.246.4.160 'curl -fsSL https://get.docker.com | sh'
  ```
- DNS: `A db.cashercollection.com → 186.246.4.160`.
- SSH-ключ:
  ```bash
  ssh-copy-id root@186.246.4.160
  ```

### Переопределение по умолчанию

```bash
DOMAIN=db.example.com \
ACME_EMAIL=ops@example.com \
SERVER_IP=1.2.3.4 \
SSH_USER=deploy \
./deploy.sh
```

### Запуск без SSH (если уже на сервере)

Скрипт сам определяет, что находится на нужном сервере (Linux + наличие Docker +
IP `186.246.4.160` на интерфейсе) и сразу переходит в `server`-режим.
Принудительно: `MODE=server ./deploy.sh`.

### Полезные команды

| Действие        | Команда                          |
| --------------- | -------------------------------- |
| Логи            | `docker compose logs -f`         |
| Статус          | `docker compose ps`              |
| Перезапуск      | `./deploy.sh`                    |
| Остановка       | `docker compose down`            |
| Полная очистка  | `docker compose down -v` *(стирает кэш Caddy, не данные приложения)* |

## Webhook для очереди производства

После деплоя сервис принимает входящие позиции:

```
POST https://db.cashercollection.com/api/production
Content-Type: application/json

{
  "items": [
    { "name": "BLACK CASHER BEANIE", "qty": 3, "size": "M" },
    { "name": "WHITE CASHER BEANIE", "qty": 1 }
  ]
}
```

Каждый POST **полностью заменяет** очередь — присылайте текущий снимок плана.

## Состав

- `Dockerfile` — multi-stage: deps → build → runner на `node:22-alpine`.
- `docker-compose.yml` — два сервиса: `app` и `caddy` (порты 80/443/tcp+udp).
- `Caddyfile` — реверс-прокси с авто-TLS, CORS на `/api/production`.
- `deploy.sh` — построить и запустить стек, вывести URL вебхука.
