# BGL Content Hub

Внутренний контент-хаб «Библиотеки готовых лекций». Реализованы Phase 0 (foundation) и Phase 1 (core content system). Основное ТЗ — [docs/CODEX_BGL_CONTENT_HUB_START.md](docs/CODEX_BGL_CONTENT_HUB_START.md).

Работают вход, роли, пользователи, редактор публикаций, варианты Telegram/MAX/VK, справочники, бэклог, календарь и минимальный status workflow. **Автопубликация, загрузка медиа, комментарии и реальные SocialAdapter ещё не реализованы.** scheduled сохраняет редакционный статус и дату; jobs/worker появятся в Phase 3.

## Структура

```text
server/src/        Fastify, auth, users, posts, settings, shared/infrastructure
web/src/           React SPA, editor, calendar, dashboard, admin forms
shared/            Zod contracts, state transitions, timezone conversion
prisma/            schema, versioned SQL migrations, dev seed
tests/             unit, real PostgreSQL integration, Playwright e2e
scripts/           first ADMIN, isolated test DB preparation, Docker entrypoint
docs/              original requirements
```

Подробности: [ARCHITECTURE.md](ARCHITECTURE.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [SECURITY.md](SECURITY.md).

## Локальный запуск

Node.js 24 LTS, npm, PostgreSQL 16+. Docker нужен только для optional local DB и проверки image; production compose не использует.

1. `cp .env.example .env`. Заполните DATABASE_URL, SESSION_SECRET (случайный секрет ≥32 символов), DEV_SEED_PASSWORD (уникальный пароль ≥12 символов), APP_ENCRYPTION_KEY (32 random bytes в hex для следующих фаз). Не коммитьте `.env`.
2. Подключите существующий PostgreSQL или запустите локальный: задайте `LOCAL_DB_PASSWORD` в shell, затем `docker compose up -d db`. Соответствующий DATABASE_URL: `postgresql://bgl:<password>@localhost:5432/bgl`; используйте URL-encoding для специальных символов пароля.
3. `npm ci` → `npm run db:generate` → `npm run db:deploy` → `npm run db:seed`.
4. Для Vite: установите `APP_BASE_URL=http://localhost:5173` в `.env`, оставьте `PORT=80`, выполните `npm run dev`. Frontend работает на 5173, API на 80 через Vite proxy. Если порт 80 требует привилегий, измените PORT и target proxy в `vite.config.ts` согласованно.
5. Для локальной production-сборки: `APP_BASE_URL=http://localhost:80`, `NODE_ENV=development` в `.env`, `npm run build && npm run start`. Настоящий NODE_ENV=production требует HTTPS origin и Secure cookie за reverse proxy.

Dev seed создаёт admin@example.local (ADMIN), content@example.local (CONTENT_MANAGER), approver@example.local (APPROVER), 7 рубрик и отключённые каналы. Все новые dev users получают значение DEV_SEED_PASSWORD. Повторный seed сохраняет существующие пароли/роли. Production seed запрещён. DATABASE_URL и SESSION_SECRET обязательны; текущая Phase 1 не требует токенов соцсетей.

npm cache при ограниченном доступе к домашней папке: `npm ci --cache /tmp/bgl-npm-cache`. Сетевые destinations: registry.npmjs.org, binaries.prisma.sh; для browser installation — cdn.playwright.dev, storage.googleapis.com, playwright.download.prss.microsoft.com.

## Миграции

`npm run db:deploy` запускает только закоммиченные миграции (`prisma migrate deploy`). Для нового изменения схемы: `npx prisma migrate dev --name <name>` на отдельной dev DB, затем review SQL и commit migration. Никогда не использовать db push в production. Все даты UTC/timestamptz; IANA timezone сохраняется в Post.

## Проверки

```sh
npm run check               # typecheck + 14 unit tests + lint + production build
npm run test:integration    # migrations + API/security/workflow against PostgreSQL
npm run test:e2e            # test DB seed + production server + Chromium scenarios
```

Задайте TEST_DATABASE_URL на **отдельную БД с именем, оканчивающимся `_test`** (например bgl_test), заранее создайте её. Integration tests очищают данные тестовой БД. Они не используют production/dev DB. E2E использует тот же test URL после integration и поднимает сервер на 3001. SESSION_SECRET и DEV_SEED_PASSWORD берутся из среды/локального `.env`. Не запускайте integration и E2E одновременно на одной test DB. Установите браузер: `npx playwright install --with-deps chromium`. В облачной среде с read-only home используйте `PLAYWRIGHT_BROWSERS_PATH=/workspace/bgl-crm-test/.cache/playwright` при установке и тестах. Если Chromium уже установлен, можно выполнить `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` без загрузки браузера.

CI: `.github/workflows/ci.yaml` с PostgreSQL service, всеми проверками и Docker build. Тесты очереди/ретраев/реальных API появятся в соответствующих Phase 2–4, не заменены фиктивно проходящими проверками.

## Первый production ADMIN

После миграций задайте ADMIN_EMAIL и ADMIN_PASSWORD (≥12 символов) через защищённую среду и выполните `npm run admin:create`. Команда работает только пока нет активного ADMIN, не выводит пароль. В собранном контейнере без tsx используйте операторский checkout с тем же DATABASE_URL; не выполняйте dev seed. После bootstrap уберите ADMIN_PASSWORD. Последующие учётные записи/сброс пароля — ADMIN в разделе «Пользователи».

## Docker и Amvera

`docker build -t bgl-content-hub .`. Dockerfile собирает frontend/backend, сохраняет Prisma CLI для migrations, запускается от node (non-root), слушает 0.0.0.0:80. `amvera.yaml`: Docker toolchain, containerPort=80, persistenceMount=/data. Entrypoint сначала `prisma migrate deploy`, затем `exec node` (SIGTERM корректно закрывает HTTP/Prisma).

Создайте отдельный managed PostgreSQL в Amvera; настройте DATABASE_URL, SESSION_SECRET, APP_BASE_URL=https://<ваш-домен>, APP_ENCRYPTION_KEY как secrets/variables. NODE_ENV=production, PORT=80, MEDIA_ROOT=/data/media, OK_ENABLED=false. Ни dev seed, ни локальные credentials в production не переносить. Compose там не нужен. Не включайте токены соцсетей, пока не готова зашифрованная credentials management.

`GET /health` → `{status:"ok"}`. `GET /ready` → 200 при доступной БД, ожидаемой завершённой миграции и отсутствии незавершённых ошибок миграции; иначе 503. Готовность не зависит от соцсетей. Для новой schema migration обновите readiness compatibility check.

Amvera deployment в этой задаче не выполнялся; конфигурация подготовлена для следующего шага оператора.

## Подключение Telegram (Phase 4)

Пока недоступно. Будущий этап: сверить официальный Bot API, создать бота, добавить его администратором канала с правами публикации, задать канал через «Настройки → Каналы», проверить connection, сохранить credentials только AES-256-GCM. Публикации выполняет worker, не HTTP route. Сначала довести milestone Telegram, затем MAX/VK, OK оставить выключенным. Сейчас UI честно показывает «Не подключён», не отправляет сообщения.

## Backup / restore

Используйте managed snapshots и `pg_dump` PostgreSQL; дополнительно резервируйте persistent `/data/media` и encryption key в отдельном защищённом хранилище. Backup должен охватывать согласованное состояние БД/файлов. Не кладите URL/пароль в command line или лог: используйте защищённый PGSERVICEFILE/.pgpass по инструкции PostgreSQL. Restore проверяйте на отдельной БД: восстановите dump через pg_restore, media и нужную версию ключа, выполните migrate deploy и /ready. При восстановлении отзовите Session rows. Будущие jobs требуют сверки внешних результатов перед возобновлением, чтобы backup restore не создал дубликаты публикаций.

## Текущая облачная среда

Локальные конфигурации `.env` и `.cache/postgres.env` созданы вне Git. `sh scripts/cloud-start.sh` перезапускает local PostgreSQL, применяет миграции, сохраняющий существующие аккаунты dev seed и собранное приложение на PORT из `.env`. Это helper только для данного `/workspace/bgl-crm-test`, не production workflow. Пароль dev accounts находится в локальном DEV_SEED_PASSWORD; не выводите его в логи/чат. Docker volume PostgreSQL принадлежит Docker daemon: сохранность local данных при переносе облачного snapshot не гарантируется. Для надёжной постоянной среды используйте внешний managed PostgreSQL.

В этой облачной машине Docker build требует настройки прокси/DNS BuildKit. Corporate CA можно передать как BuildKit secret `build_ca`; Dockerfile использует его только во время dependency installation, TLS verification сохраняется. Обычный Amvera build не требует этого secret.
