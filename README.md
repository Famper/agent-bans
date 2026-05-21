# agent-bans — Kanban Constructor

Настраиваемая kanban-доска. Каждый пользователь создаёт свои колонки (имя, цвет, порядок), карточки с markdown-телом, комментариями и прикреплёнными картинками. Drag-and-drop между и внутри колонок.

## Стек

- Next.js 15 (App Router) + React 19
- Auth.js v5 (email + пароль)
- Prisma + SQLite
- @dnd-kit для drag-and-drop
- @uiw/react-md-editor + react-markdown
- Tailwind v4 + shadcn/ui

## Запуск (dev в Docker)

```bash
docker compose up -d
```

Открыть [http://localhost:3000](http://localhost:3000), зарегистрироваться и начать пользоваться.

Данные (SQLite + загруженные картинки) живут в named volumes — переживают `docker compose down`.

## Локальная разработка без Docker

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

## Production-образ

Multistage `Dockerfile` содержит `runner` target — минимальный production-образ с healthcheck. Запуск:

```bash
docker build --target runner -t agent-bans:prod .
docker run -d -p 3000:3000 \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e AUTH_TRUST_HOST=true \
  -e DATABASE_URL="file:/data/db/kanban.db" \
  -e UPLOAD_DIR="/data/uploads" \
  -v kanban-db:/data/db \
  -v kanban-uploads:/data/uploads \
  agent-bans:prod
```

Entrypoint автоматически прогоняет `prisma migrate deploy` перед стартом `next start`.

## Hermes REST API (для агентов)

Помимо UI agent-bans отдаёт REST-эндпойнты, совместимые с `kanban-server` из проекта [ai-revolution](https://github.com/Famper/ai-revolution). Это позволяет использовать один и тот же образ как kanban-бэкенд для мультиагентной системы.

Авторизация — Bearer-токен из `KANBAN_API_KEY` (если переменной нет — dev-режим без авторизации, **не использовать в проде**).

| Метод | Путь | Назначение |
|---|---|---|
| POST   | `/api/tasks`                                | Создать задачу. Тело: `{ title, description?, type?, complexity?, status?, parentId?, projectId, boardId? }`. `boardId` берётся из `parentId` если не передан. |
| GET    | `/api/tasks/:id`                            | Получить задачу. |
| PATCH  | `/api/tasks/:id`                            | Обновить поля (`status`, `agentId`, `iterations`, `costUsd`, `prUrl`, `errorLog`, `model`, `notionCardId`, `notionTlNotified`, …). Смена `status` перемещает карточку в колонку с этим именем (колонка создаётся при отсутствии). |
| POST   | `/api/tasks/:id/comments`                   | Добавить комментарий. Тело: `{ agentId, text }`. |
| GET    | `/api/boards/:boardId/tasks?status=<name>`  | Список задач доски (можно фильтровать по статусу). |
| POST   | `/api/boards/:boardId/claim`                | Атомарно захватить ближайшую задачу из статуса. Тело: `{ fromStatus, agentId }`. `200` — задача, `204` — нет задач. |

Статусы Hermes (`Incoming`, `Architect`, `AwaitingTLApproval`, `Development`, `Testing`, `TLDecision`, `Done`, `Rejected`, `Blocked`) маппятся в одноимённые колонки доски. Тимлид может двигать карточки drag-and-drop'ом — агенты увидят новый статус.

### Bootstrap агентского борда

```bash
AGENT_BOARD_ID=board-project-alpha \
AGENT_BOARD_NAME="AI Revolution" \
npm run db:seed:agent-board
```

Создаёт системного пользователя `agent-bot@local` + доску с указанным id + все колонки под Hermes-статусы. Идемпотентно. Распечатывает `HERMES_BOARD_ID` для `.env` ai-revolution.

## CI / CD

`.github/workflows/`:

| Workflow | Trigger | Что делает |
|---|---|---|
| `ci.yml` | PR, push в `main` | `npm ci` → `prisma generate/validate` → `tsc --noEmit` → `next build` + smoke-сборка `dev` и `runner` Docker-образов через buildx (с GHA-кешом) |
| `publish.yml` | Push в `main`, теги `v*.*.*`, ручной dispatch | Сборка multi-arch (`linux/amd64,linux/arm64`) `runner` образа и публикация в GHCR с тегами `latest`, `sha-<short>`, `<version>`, `<major.minor>` |

Образы публикуются в `ghcr.io/famper/agent-bans`. Аутентификация через `GITHUB_TOKEN` (с правами `packages: write`).

Чтобы запустить опубликованный образ:

```bash
docker pull ghcr.io/famper/agent-bans:latest
```
