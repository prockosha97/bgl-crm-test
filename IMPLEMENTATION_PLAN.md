# План реализации

Источник: `docs/CODEX_BGL_CONTENT_HUB_START.md`. Статус обновляется после проверок каждого этапа.

## Phase 0 — foundation
- [x] Архитектура, границы модулей, структура репозитория и основное ТЗ.
- [x] Prisma schema, первая SQL migration, PostgreSQL.
- [x] Fastify, React/Vite, strict TypeScript, общие контракты.
- [x] Auth: Argon2id, server sessions, CSRF, RBAC; первый ADMIN и dev seed.
- [x] Health/readiness, graceful shutdown, Docker, Amvera, env example.
- [x] CI и local typecheck / unit / lint / production build.

## Phase 1 — core content system
- [x] Users: список, создание, роли, отключение, сброс пароля.
- [x] Posts: CRUD без физического удаления, optimistic version, выбор площадок, наследование текста.
- [x] Status workflow с серверными ограничениями, минимальный approve/reject, сброс approval.
- [x] Rubrics / campaigns / tags.
- [x] Editor, backlog, dashboard, calendar (месяц/неделя/список), фильтры, подтверждение переноса.
- [x] Unit, PostgreSQL integration, browser smoke/e2e и production build.

## Phase 2 — media + approval
- [ ] StorageProvider и безопасная загрузка, MIME/size, `/data/media`.
- [ ] Медиатека, привязка assets, rights metadata.
- [ ] Полный workflow согласования, комментарии, история, UI audit.
- [ ] Encryption AES-256-GCM, unit tests, integration approval lifecycle.

## Phase 3 — publishing engine
- [ ] PublicationJob, SKIP LOCKED, lease timeout, versioned idempotency.
- [ ] PublicationAttempt, normalized errors, retry +1/+5/+15 min, manual retry.
- [ ] Aggregated platform status, partial failure UI, restart/recovery checks.
- [ ] Mock SocialAdapter в CI; никакого вызова publish в HTTP request.

## Phase 4 — Telegram milestone
- [ ] Сверить актуальный Bot API и права канала по официальной документации.
- [ ] Connection/settings + зашифрованные credentials.
- [ ] validate/publish text/photo/video/album, edit/delete, IDs и URL.
- [ ] E2E create → review → approve → schedule → worker → Telegram.
- [ ] Проверить Amvera, media persistence, restart без дублей.

Далее Phase 5 MAX, Phase 6 VK, Phase 7 OK preparation (disabled), Phase 8 analytics/UTM. Публикация в соцсети не входит в Phase 1 и не представляется как работающая.

## Журнал проверок

Проверено в текущей облачной машине (Node 24, PostgreSQL 16):

- Phase 0: реальная первая SQL migration и повторный migrate deploy; dev seed дважды без изменения существующих учётных записей; 3 security unit + 3 foundation integration tests.
- Итог Phase 0/1: `npm run check` — typecheck, 14 unit tests, ESLint, production build PASS.
- `npm run test:integration` — 15 tests PASS на отдельной PostgreSQL `bgl_test`; проверены роли, CSRF/session, optimistic concurrency, минимальное согласование, schedule, reset approval, справочники, пользователи и аудит.
- `npm run test:e2e` с установленным Chromium — 3 scenarios PASS: полный редакционный workflow, идея в бэклоге → drag/drop → подтверждение даты, мобильная навигация.
- `npm audit` — 0 vulnerabilities, включая dev dependencies. Toolchain: Vite 8.3.3, Vitest 5.0.3, @vitejs/plugin-react 6.1.2. deepmerge-ts override 8.0.2 проверен generate/migrate/API.
- `prisma migrate diff` — no difference между реальной БД и schema.
- First ADMIN bootstrap на отдельной свежей БД PASS; повторное создание корректно запрещено.
- Docker build PASS через сетевой proxy/DNS текущей облачной среды, TLS/checksum verification сохранена. Non-root runtime, production Secure/HttpOnly cookie, DB session, /health, /ready, container restart и сохранность sentinel в /data/media проверены. Финальный image с production-only dependencies проверен повторно: migrate deploy, /health, /ready, SPA, Secure login; media сохранилось при замене контейнера новым image, .env отсутствует в image.
- `sh scripts/cloud-start.sh` проверен: local PostgreSQL → migrate deploy → сохраняющий seed → собранный server/SPA. Приложение в текущем экземпляре запущено, /health и /ready PASS.
- Локальные `.env` и `.cache` игнорируются Git и Docker context; исходное ТЗ сохранено в docs. Изменения находятся в рабочем checkout, commit/push не выполнялись.

Остаются вне scope: реальные media uploads, полный approval/comment UI, worker/retry/idempotency execution, интеграции и аналитика. Схема данных и контракты предусматривают их. Проверки Amvera deployment и реальных API соцсетей не запускались. Cloud snapshot не гарантирует сохранение Docker-managed local DB volume; production использует внешний managed PostgreSQL. Замечание pg@8 о конкурентной внутренней query — предупреждение driver adapter, все PostgreSQL tests прошли; переход на pg@9 потребует отдельной проверки adapter.
