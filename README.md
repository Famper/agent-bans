# agent-bans — Kanban Constructor

Настраиваемая kanban-доска. Каждый пользователь создаёт свои колонки (имя, цвет, порядок), карточки с markdown-телом, комментариями и прикреплёнными картинками. Drag-and-drop между и внутри колонок.

## Стек

- Next.js 15 (App Router) + React 19
- Auth.js v5 (email + пароль)
- Prisma + SQLite
- @dnd-kit для drag-and-drop
- @uiw/react-md-editor + react-markdown
- Tailwind v4 + shadcn/ui

## Запуск

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
