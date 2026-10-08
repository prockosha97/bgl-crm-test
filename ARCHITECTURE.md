# BGL Content Hub — архитектура

Основное ТЗ: `docs/CODEX_BGL_CONTENT_HUB_START.md`, версия 1.0. Реализуем Phase 0 и Phase 1; последующие модули пока представлены моделью данных и границами ответственности.

## Структура и решения

Один npm-проект с `server/` (Fastify REST), `web/` (React + Vite), `shared/` (Zod-контракты и workflow), `prisma/`, `tests/`. Modular monolith, один application process. В production Fastify раздаёт собранный SPA и API на одном origin. Vite в development проксирует API; это исключает необходимость CORS и хранения токенов в browser storage. Node.js 24 LTS, TypeScript strict, PostgreSQL 16+, Prisma 6.19.3 (client engineType=client с официальным @prisma/adapter-pg; стандартный schema engine для migrate deploy), React Router, TanStack Query, react-hook-form.

## Границы модулей

- auth: Argon2id, opaque server-side sessions, CSRF, rate limiting, вход/выход.
- users: ADMIN создаёт пользователей, назначает роли, отключает, сбрасывает пароли; отключение/сброс удаляет сессии. Нельзя отключить/понизить последнего ADMIN.
- posts: идеи, черновики, версии для площадок, статусы, optimistic concurrency.
- calendar: представление тех же Post, а не отдельный источник данных; месяц/неделя/список, фильтры, подтверждение переноса.
- settings: рубрики, кампании, теги. Изменение справочников — ADMIN.
- approvals (Phase 2): полные согласования и комментарии. В Phase 1 есть минимальные approve/reject и запись решений для проверки status workflow.
- media (Phase 2): StorageProvider, LocalPersistentStorageProvider `/data/media`; assets не исполняются.
- publishing (Phase 3): PostgreSQL worker, lease, SKIP LOCKED, retry, idempotency; scheduling в Phase 1 сохраняет состояние, но ещё не публикует.
- integrations (Phase 4–7): SocialAdapter, отдельные адаптеры Telegram → MAX → VK, OK выключен. В Phase 0/1 никаких внешних API/выдуманных endpoint.
- analytics (Phase 8): MetricSnapshot, отсутствующие метрики nullable.
- audit: append-only в приложении, записи в одной транзакции с изменением. AuditLog не каскадируется при удалении пользователя/публикации.

## Данные

Все даты PostgreSQL `timestamptz`, время UTC; Post хранит IANA timezone для отображения. PostPlatform выбирает площадку и хранит её статус; PostVariant — индивидуальный текст/наследование и настройки. SocialChannel независим от платформенного варианта: канал назначается на этапе подготовки job. PlatformPost хранит результат одной версии публикации; PublicationJob уникален по post + platform + publicationVersion. PublicationAttempt хранит историю попыток. Lease и external IDs позволят продолжать работу после рестарта, но внешнее exactly-once без поддержки соцсети не гарантируется: неопределённый результат публикации требует сверки, а не слепого retry.

Post.version — optimistic revision всех изменений и действий. PublicationVersion — отдельная версия публикуемого содержимого. Изменение текста, вариантов, медиа, CTA, площадок, времени сбрасывает approved/scheduled в draft. В Phase 1 более консервативно любое сохранение approved/scheduled сбрасывает согласование. Финальные и выполняющиеся публикации нельзя редактировать. Назначенная дата у draft не означает согласование/планирование. scheduled требует approved, будущую дату и хотя бы одну площадку. Переходы publishing/published/failed — только будущий worker, HTTP не может их выставлять.

Удаление Post в Phase 1 заменено cancellation с аудитом. Справочники, на которые есть ссылки, нельзя удалить до снятия связи. User отключается, а не удаляется. Assets и AuditLog не удаляются каскадом с Post. Ограничения FK, unique и индексы описаны в schema и SQL migration.

## Безопасность

Пароль Argon2id. В cookie только случайный token; БД хранит его HMAC SHA-256 с SESSION_SECRET, expiry, CSRF token. Cookie HttpOnly, SameSite=Lax, Secure в production. Все изменяющие API требуют точный Origin APP_BASE_URL и session-bound X-CSRF-Token; login требует Origin и JSON. Лимит login по IP, generic error для неизвестного email/пароля, без публичной регистрации. Проверка роли на сервере, DTO никогда не возвращает passwordHash/session/token. Логи скрывают cookies/authorization. APP_ENCRYPTION_KEY зарезервирован для AES-256-GCM в Phase 2/4; токены пока не принимаются. Секреты не входят в seed/репозиторий. Dev seed запрещён при NODE_ENV=production.

## Deployment и эксплуатация

Multi-stage Docker: build → production runtime; `prisma migrate deploy` перед запуском, PostgreSQL managed вне приложения. Один процесс слушает 0.0.0.0:80; SIGTERM закрывает HTTP и Prisma. /health проверяет процесс, /ready — БД, наличие ожидаемой завершённой миграции и отсутствие failed migrations. /data/media — persistent mount Amvera; compose только для локального PostgreSQL. Состояние сессий живёт в БД.

## Валидация и этапы

После Phase 0 и Phase 1: typecheck, Vitest, ESLint, production build. Интеграционные тесты используют реальный выделенный PostgreSQL и Fastify.inject; E2E Playwright проверяет браузерный workflow. Production Amvera и внешние API проверяются только после предоставления реального deployment/credentials. Их отсутствие не блокирует Phase 0/1.

## Неблокирующие вопросы для будущих этапов

Точные каналы и права ботов; подтверждение лимитов API по официальной документации; политика retention media/backup; permission срочной публикации для APPROVER. Сейчас все content managers работают с общей командной базой (single tenant).

## Уточнения после проверки среды

Для Prisma нужен binaries.prisma.sh. WASM schema engine был рассмотрен при сетевом 403, но миграция показала неподдержанный тип PostgreSQL name; финальная конфигурация использует стандартный migration engine и сохраняет checksum/TLS verification. Client driver adapter стабилен и не требует query engine binary. @fastify/static обновлён до 10.1.5; deepmerge-ts внутри @prisma/config зафиксирован override 8.0.2 для устранения опубликованных security advisories. Generate/migrate/API/build проверяются с этими версиями.
