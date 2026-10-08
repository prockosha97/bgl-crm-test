# BGL Content Hub — стартовое ТЗ для Codex

Версия: 1.0  
Дата: 07.10.2026  
Продукт: внутренний сервис команды проекта «Библиотека готовых лекций»  
Рабочее название: **BGL Content Hub**

---

## 0. Инструкция для Codex

Это основной стартовый документ проекта. Считай его источником требований для первой версии.

### Что нужно сделать сначала

До реализации функционала:

1. Создай `ARCHITECTURE.md` с описанием модулей, границ ответственности и основных технических решений.
2. Создай `IMPLEMENTATION_PLAN.md` с этапами реализации и чек-листом.
3. Создай структуру репозитория.
4. Создай Prisma schema и миграцию для базовых сущностей.
5. Подготовь `.env.example`.
6. Подготовь `Dockerfile`.
7. Подготовь `amvera.yaml`.
8. Настрой локальный запуск.
9. Только после этого переходи к экранным формам и интеграциям.

Не пытайся реализовать весь проект одним большим коммитом.

Разбивай работу на небольшие завершенные этапы. После каждого этапа:
- запускай typecheck;
- запускай unit tests;
- запускай lint;
- проверяй production build;
- обновляй `IMPLEMENTATION_PLAN.md`.

Если API конкретной социальной сети отличается от описания ниже, **не придумывай endpoint или поля**. Проверь актуальную официальную документацию и зафиксируй изменение в `ARCHITECTURE.md`.

---

# 1. Задача продукта

Создать закрытую web-платформу для команды проекта «Библиотека готовых лекций», которая заменяет ручное ведение контент-плана и ручное копирование публикаций между социальными сетями.

Основной пользователь первой версии — менеджер по дистрибуции/контенту проекта.

Платформа должна объединить в одном интерфейсе:

- идеи и бэклог публикаций;
- контент-календарь;
- подготовку постов;
- хранение медиа;
- разные версии одного поста для разных площадок;
- согласование;
- отложенную публикацию;
- автопубликацию;
- повторные попытки при ошибках;
- ссылки на опубликованные посты;
- базовую аналитику;
- аудит действий.

Основной принцип продукта:

> одна сущность публикации → несколько платформ → отдельный статус и результат на каждой платформе.

---

# 2. Площадки

## MVP

1. Telegram
2. MAX
3. VK

## Архитектурно заложить сразу

4. Одноклассники

Интеграцию OK можно держать выключенной feature flag до получения необходимых доступов.

Не добавлять в MVP зарубежные социальные сети.

---

# 3. Что НЕ входит в MVP

Не реализовывать в первой версии:

- мобильное приложение;
- AI-автоответы;
- единый inbox комментариев;
- мультимессенджер;
- генерацию изображений;
- сложную SMM-аналитику;
- RSS-репостер;
- A/B-тестирование;
- публичную регистрацию;
- биллинг;
- внешних клиентов;
- multi-tenant SaaS;
- сложную CRM.

AI-помощник можно добавить отдельным этапом после стабильной работы публикаций.

---

# 4. Технологический стек

Использовать:

## Общий стек

- TypeScript
- Node.js LTS
- PostgreSQL
- Prisma ORM

## Frontend

- React
- Vite
- React Router
- TanStack Query
- react-hook-form
- zod

UI можно строить на:
- shadcn/ui, либо
- собственном небольшом наборе компонентов.

Не привязывать бизнес-логику к UI-библиотеке.

## Backend

- Fastify
- REST API
- zod для валидации входящих данных
- структурированные логи

## Tests

- Vitest
- Playwright для smoke/e2e сценариев

## Deployment

- Docker
- Amvera
- один основной application service в MVP
- отдельный managed PostgreSQL в Amvera

`docker-compose` не должен быть обязательным для production-развертывания в Amvera.

---

# 5. Архитектурный подход

Первая версия — **modular monolith**.

Не делать microservices.

Рекомендуемые модули:

```text
src/
  modules/
    auth/
    users/
    posts/
    calendar/
    media/
    approvals/
    publishing/
    integrations/
      telegram/
      max/
      vk/
      ok/
    analytics/
    audit/
    settings/
  shared/
  infrastructure/
```

Frontend можно разместить в отдельной директории `web/`, backend — `server/`, либо собрать monorepo.

Codex должен выбрать один вариант и обосновать его в `ARCHITECTURE.md`.

---

# 6. Роли

## ADMIN

Может:
- создавать пользователей;
- отключать пользователей;
- назначать роли;
- подключать каналы;
- менять настройки;
- видеть audit log;
- выполнять все действия Content Manager и Approver.

## CONTENT_MANAGER

Может:
- создавать публикации;
- редактировать свои и доступные публикации;
- работать с календарем;
- работать с бэклогом;
- загружать медиа;
- создавать варианты поста для площадок;
- отправлять на согласование;
- планировать согласованные публикации;
- запускать повтор публикации при ошибке;
- смотреть аналитику.

## APPROVER

Может:
- просматривать публикации;
- комментировать;
- согласовывать;
- возвращать на доработку;
- при наличии разрешения публиковать срочно.

## VIEWER

Может только:
- смотреть календарь;
- смотреть публикации;
- смотреть аналитику.

Публичной регистрации нет.

Пользователя создает ADMIN.

---

# 7. Основные статусы публикации

```text
idea
draft
review
changes_requested
approved
scheduled
publishing
published
partially_published
failed
cancelled
```

Статусы публикации на конкретной площадке:

```text
pending
queued
publishing
published
retrying
failed
cancelled
```

---

# 8. Основные экраны

## 8.1 Login

- email
- password
- восстановление пароля можно не делать в MVP;
- сброс пароля выполняет администратор.

## 8.2 Dashboard

Показывает:

- публикации сегодня;
- публикации на ближайшие 7 дней;
- ожидают согласования;
- требуют доработки;
- ошибки публикации;
- частично опубликованные;
- посты без даты;
- статус подключения Telegram / MAX / VK / OK.

## 8.3 Контент-календарь

Режимы:

- месяц;
- неделя;
- список.

Фильтры:

- период;
- площадка;
- статус;
- рубрика;
- кампания;
- автор.

В карточке:

- время;
- внутреннее название;
- рубрика;
- площадки;
- общий статус.

Поддержать drag&drop переноса даты.

После drag&drop обязательно открывать подтверждение:

```text
Перенести публикацию
Старая дата:
Новая дата:
[Отмена] [Перенести]
```

## 8.4 Бэклог

Публикации без `scheduled_at`.

Возможность:
- создать идею;
- превратить идею в черновик;
- назначить дату;
- перетащить в календарь.

## 8.5 Редактор публикации

Поля:

```text
internal_title
campaign
rubric
tags
base_text
cta_url
scheduled_at
timezone
platforms[]
media[]
```

После выбора платформ создать `PostVariant` для каждой площадки.

Для каждой площадки:

```text
inherit_base_text: boolean
text
platform_specific_settings
```

Пользователь должен уметь:
- оставить базовый текст;
- переключить конкретную площадку на отдельную версию;
- вернуть площадку на наследование базового текста.

## 8.6 Предпросмотр

Вкладки:

```text
Telegram | MAX | VK | OK
```

Показывать максимально близкий preview, но не обещать pixel-perfect соответствие UI социальной сети.

Перед сохранением/публикацией запускать platform validation.

## 8.7 Медиатека

Поддержать:

- изображения;
- видео;
- GIF;
- документы.

Поля asset:

```text
id
filename
original_name
mime_type
size
storage_path
title
description
source
rights_comment
rights_valid_until
uploaded_by
created_at
```

Дополнительно:
- tags;
- campaign;
- count использования.

Файлы MVP хранить через абстракцию `StorageProvider`.

Первая реализация:
`LocalPersistentStorageProvider` → `/data/media`.

Это позволит позже заменить хранилище на S3-совместимое без переписывания бизнес-логики.

---

# 9. Рубрики, кампании и теги

## Rubric

Примеры:
- новая лекция;
- подборка;
- инструкция;
- история лектора;
- календарный повод;
- новости проекта;
- партнерство.

Рубрики редактируются администратором.

## Campaign

Нужна для объединения публикаций одной активности.

Пример:

```text
Осенняя кампания 2026
День учителя 2026
Новые лекции октября
```

Поля:

```text
name
slug
date_from
date_to
utm_campaign
description
```

## Tags

Произвольные внутренние метки.

---

# 10. UTM builder

При добавлении `cta_url` система должна уметь автоматически создавать URL для каждой площадки.

Стандарт:

```text
utm_source=telegram | max | vk | ok
utm_medium=social
utm_campaign=<campaign.utm_campaign>
utm_content=<автогенерируемое или введенное значение>
```

Важно:

- не терять существующие query params;
- корректно работать с anchor;
- позволять пользователю отключить UTM;
- показывать итоговый URL перед публикацией.

---

# 11. Workflow согласования

Переходы:

```text
draft
→ review
→ approved
→ scheduled
```

или:

```text
review
→ changes_requested
→ draft
```

При отправке на согласование:

- фиксировать автора;
- фиксировать время;
- разрешать комментарий.

При согласовании:

- сохранять approver;
- timestamp;
- комментарий опционально.

После изменения содержимого уже согласованного поста:

- по умолчанию сбрасывать `approved` обратно в `draft`;
- исключение: системные безопасные изменения, если они будут отдельно описаны.

Для MVP считать любое изменение текста, медиа, CTA, площадки или времени публикации существенным.

---

# 12. Планировщик и очередь публикаций

Все расписание хранить в нашей БД.

Не полагаться на встроенное планирование конкретной соцсети как на основной механизм.

Основное поле:

```text
scheduled_at timestamptz
```

Все время в БД хранить UTC.

В UI показывать выбранный timezone.

## PublicationJob

Для каждого Post + Platform создается отдельная задача.

Пример:

```text
POST 184
Telegram -> queued
MAX      -> queued
VK       -> queued
```

Worker регулярно забирает due jobs.

Для конкурентного захвата jobs использовать безопасную схему PostgreSQL:
- транзакция;
- `FOR UPDATE SKIP LOCKED` либо эквивалент;
- lease/lock timeout;
- уникальный idempotency key.

## Retry

Базовая стратегия:

```text
attempt 1 -> сразу
attempt 2 -> +1 min
attempt 3 -> +5 min
attempt 4 -> +15 min
```

После исчерпания попыток:

```text
failed
```

Не повторять автоматически:
- ошибки авторизации;
- revoked token;
- validation errors;
- запрещенный формат;
- отсутствие прав.

Для них нужен actionable error в UI.

## Idempotency

Обязательна.

Уникальный ключ:

```text
post_id + platform + publication_version
```

Рестарт приложения не должен создавать дубль публикации.

---

# 13. Интерфейс SocialAdapter

Бизнес-логика не должна напрямую использовать SDK/API конкретной сети.

Базовый контракт:

```ts
export interface SocialAdapter {
  platform: SocialPlatform;

  verifyConnection(): Promise<ConnectionStatus>;

  validate(post: PlatformPostInput): Promise<ValidationResult>;

  publish(post: PlatformPostInput): Promise<PublishResult>;

  edit?(
    externalPostId: string,
    post: PlatformPostInput
  ): Promise<PublishResult>;

  delete?(
    externalPostId: string
  ): Promise<void>;

  getMetrics?(
    externalPostId: string
  ): Promise<PostMetrics>;
}
```

Реализации:

```text
TelegramAdapter
MaxAdapter
VkAdapter
OkAdapter
```

Все platform-specific payloads должны оставаться внутри адаптера.

---

# 14. Telegram

Использовать официальный Telegram Bot API.

Подключение:
- бот;
- бот добавлен администратором канала;
- необходимые права публикации.

MVP methods внутри адаптера:

```text
verifyConnection()
validate()
publishText()
publishPhoto()
publishVideo()
publishAlbum()
publish()
edit()
delete()
```

Сохранять после публикации:

```text
external_post_id
chat_id
message_id
post_url
published_at
raw_response
```

Не считать Telegram reach обязательной метрикой MVP.

Ссылочный трафик измерять через UTM.

Официальная документация:
https://core.telegram.org/bots/api

---

# 15. MAX

Использовать только официальный API MAX и актуальную официальную документацию на момент реализации.

Основной endpoint/documentation root:
https://dev.max.ru/docs-api

Текущая документация API:
https://platform-api2.max.ru/

Не хардкодить предположения о лимитах без проверки актуальной документации.

Адаптер:

```text
verifyConnection()
validate()
uploadMedia()
publish()
edit()
delete()
getMetrics()
```

Сохранять:

```text
external_post_id
post_url
published_at
raw_response
```

Учитывать:
- права бота/приложения;
- ограничения запросов;
- rate limit;
- особенности загрузки медиа.

---

# 16. VK

Использовать официальный VK API.

Документация:
https://dev.vk.com/

Для публикаций сообщества использовать актуальный поддерживаемый метод wall API и официальный flow загрузки медиа.

Адаптер:

```text
verifyConnection()
validate()
uploadPhoto()
uploadVideo() // если MVP поддержит видео
publish()
edit()
delete()
getMetrics()
```

После публикации хранить:

```text
owner_id
post_id
external_post_id
post_url
published_at
raw_response
```

Не копировать старые примеры API без проверки текущей версии VK API.

---

# 17. Одноклассники

Архитектуру создать сразу.

Feature flag:

```text
OK_ENABLED=false
```

Официальная документация:
https://apiok.ru/

Для первой реализации проверить актуальные:
- OAuth permissions;
- публикацию media topic;
- статистику публикаций;
- требования к приложениям и группам.

До получения реальных credentials:
- реализовать интерфейс;
- mock adapter;
- validation;
- UI состояния `not_connected` и `disabled`.

---

# 18. Подключение каналов

Раздел:

```text
Настройки → Каналы
```

Каждая запись:

```text
platform
display_name
external_channel_id
is_enabled
connection_status
last_verified_at
credentials_encrypted
created_at
updated_at
```

Кнопки:

```text
Проверить подключение
Переподключить
Отключить
```

После сохранения токен нельзя показывать пользователю в открытом виде.

---

# 19. Шифрование credentials

Токены социальных сетей не хранить plaintext.

Использовать application-level encryption:

- AES-256-GCM;
- случайный IV;
- auth tag;
- master secret из environment:

```text
APP_ENCRYPTION_KEY
```

В БД хранить только ciphertext + IV + auth tag.

`APP_ENCRYPTION_KEY`:
- никогда не коммитить;
- не выводить в лог;
- хранить только как secret Amvera.

---

# 20. Аутентификация

Для MVP:

- email + password;
- invite/admin-created accounts;
- Argon2id;
- server-side session либо безопасная session architecture;
- HttpOnly;
- Secure;
- SameSite;
- CSRF protection для state-changing requests;
- rate limit на login.

Не использовать localStorage для auth token.

---

# 21. Audit Log

Логировать:

- login;
- failed login;
- создание поста;
- изменение поста;
- удаление/отмену;
- отправку на согласование;
- approve/reject;
- изменение даты;
- manual publish;
- retry;
- подключение/отключение канала;
- изменение пользователя/роли.

Audit log append-only на уровне приложения.

Поля:

```text
id
actor_user_id
action
entity_type
entity_id
metadata_json
created_at
ip_optional
```

---

# 22. Аналитика MVP

Единый формат:

```text
platform
post_id
external_post_id
snapshot_at

views nullable
reach nullable
reactions nullable
likes nullable
comments nullable
shares nullable
link_clicks nullable

raw_metrics_json
```

Если площадка не дает метрику:
- хранить `null`;
- отображать `—`;
- никогда не подменять отсутствующие данные нулем.

Dashboard аналитики:

- публикации по площадкам;
- публикации по рубрикам;
- публикации по кампаниям;
- % успешной публикации;
- ошибки;
- лучшие публикации по доступным метрикам.

Продвинутую аналитику строить позже.

---

# 23. Связь публикации с БГЛ

Заложить в Post optional-поля:

```text
content_entity_type
content_entity_id
content_entity_url
```

В MVP допустимые значения type:

```text
lecture
collection
campaign_page
news
other
```

Это нужно, чтобы позже связать:

```text
социальный пост
→ переход
→ страница лекции
→ запуск материала
→ мероприятие
→ слушатели
```

Не реализовывать всю эту сквозную аналитику в MVP, но не блокировать ее схемой данных.

---

# 24. База данных — обязательные сущности

Минимальный набор:

```text
User
Session
Role / role enum

Post
PostVariant
PostPlatform

Asset
AssetTag
Tag

Rubric
Campaign

Approval
PostComment

SocialChannel
SocialCredential

PublicationJob
PublicationAttempt
PlatformPost

MetricSnapshot

AuditLog
```

Codex должен подробно спроектировать связи и индексы в Prisma schema.

Обязательные индексы:
- `Post.scheduled_at`;
- `Post.status`;
- `PublicationJob.status + scheduled_at`;
- `PlatformPost.post_id + platform`;
- `MetricSnapshot.platform_post_id + snapshot_at`;
- `AuditLog.created_at`.

---

# 25. Amvera deployment

Production target — Amvera.

Проект должен включать:

```text
Dockerfile
amvera.yaml
.env.example
```

Amvera не должна требовать docker-compose для запуска production.

Пример логики `amvera.yaml`:

```yaml
meta:
  environment: docker
  toolchain:
    name: docker

build:
  dockerfile: Dockerfile
  skip: false

run:
  persistenceMount: /data
  containerPort: "80"
```

Если реальный backend слушает `process.env.PORT`, привести Docker/Amvera конфигурацию к одному порту.

Приложение должно:
- слушать `0.0.0.0`;
- иметь `/health`;
- иметь `/ready`;
- корректно завершаться по SIGTERM;
- запускать migrations безопасно;
- не терять media в `/data/media`.

---

# 26. PostgreSQL в Amvera

БД — отдельный managed PostgreSQL service.

Приложение получает:

```text
DATABASE_URL
```

через secret/environment.

Не хардкодить:
- host;
- username;
- password;
- database.

Prisma migrations должны запускаться в production через:

```text
prisma migrate deploy
```

Нельзя использовать `prisma db push` как production migration workflow.

---

# 27. Environment variables

Сформировать `.env.example` минимум с:

```env
NODE_ENV=development
PORT=80

DATABASE_URL=

APP_BASE_URL=http://localhost:80
SESSION_SECRET=
APP_ENCRYPTION_KEY=

MEDIA_ROOT=/data/media

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=

MAX_ACCESS_TOKEN=
MAX_CHANNEL_ID=

VK_ACCESS_TOKEN=
VK_GROUP_ID=

OK_ENABLED=false
OK_ACCESS_TOKEN=
OK_APPLICATION_KEY=
OK_APPLICATION_SECRET=
OK_GROUP_ID=
```

Если конкретный API требует дополнительные значения — расширить.

В `.env.example` никаких реальных секретов.

---

# 28. Health checks

## GET /health

Проверяет:
- процесс жив.

Ответ:

```json
{"status":"ok"}
```

## GET /ready

Проверяет:
- PostgreSQL доступен;
- migrations compatible;
- приложение готово принимать запросы.

Не делать readiness зависимым от доступности всех соцсетей.

Статус соцсетей отображается отдельно в UI.

---

# 29. Логи

Использовать structured JSON logs.

Логировать:
- request id;
- route;
- status;
- duration;
- publication job id;
- platform;
- error code.

Не логировать:
- password;
- session cookies;
- access tokens;
- encrypted credentials;
- полные platform payloads, если там могут быть secrets.

---

# 30. Ошибки публикации

Нужен внутренний normalized error:

```ts
type PublicationErrorCode =
  | "AUTH_FAILED"
  | "PERMISSION_DENIED"
  | "RATE_LIMITED"
  | "VALIDATION_FAILED"
  | "MEDIA_UPLOAD_FAILED"
  | "REMOTE_SERVER_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";
```

UI должен показывать человеку понятное сообщение.

Пример:

```text
MAX
Публикация не выполнена.
Причина: у подключенного бота недостаточно прав.
[Проверить подключение]
```

---

# 31. Работа с медиа

В MVP:

```text
/data/media
```

При загрузке:
- генерировать UUID filename;
- оригинальное имя хранить отдельно;
- проверять MIME;
- ограничивать размер через config;
- не исполнять загруженные файлы;
- выдавать медиа через безопасный endpoint.

Создать abstraction:

```ts
interface StorageProvider {
  save(...)
  open(...)
  delete(...)
  exists(...)
}
```

---

# 32. UI-принципы

Это внутренний рабочий инструмент.

Приоритет:
1. скорость работы;
2. понятность статусов;
3. минимальное число кликов;
4. отсутствие декоративной перегрузки.

Цветовая система БГЛ:
- белый фон;
- черный текст;
- основной синий `#0501CE`;
- ошибки/предупреждения — системные цвета UI;
- без градиентов.

Desktop-first, но адаптивность обязательна.

Ключевая рабочая ширина:
- 1440px desktop;
- поддержать 1024px;
- мобильную версию сделать пригодной для просмотра и срочных действий, но не оптимизировать под полноценную ежедневную работу в MVP.

---

# 33. MVP этапы

## Phase 0 — foundation

- repo;
- architecture docs;
- TypeScript;
- Fastify;
- React;
- PostgreSQL;
- Prisma;
- auth skeleton;
- Docker;
- Amvera config;
- CI/local checks.

## Phase 1 — core content system

- users;
- roles;
- posts;
- status workflow;
- rubrics;
- campaigns;
- tags;
- calendar;
- backlog;
- editor.

## Phase 2 — media + approval

- media library;
- upload;
- approval workflow;
- comments;
- audit log.

## Phase 3 — publishing engine

- PublicationJob;
- worker;
- retries;
- idempotency;
- platform status;
- failure UI.

## Phase 4 — Telegram

Полностью рабочий TelegramAdapter.

Конечный сценарий:

```text
create
→ review
→ approve
→ schedule
→ worker
→ Telegram publish
→ сохранить message_id и URL
```

## Phase 5 — MAX

Подключить реальный MAXAdapter.

## Phase 6 — VK

Подключить реальный VkAdapter.

## Phase 7 — OK preparation

- mock;
- credentials UI;
- feature flag;
- документация для подключения.

## Phase 8 — analytics

- metrics snapshots;
- dashboard;
- UTM;
- export CSV.

---

# 34. Definition of Done MVP

MVP готов, если Content Manager может:

1. войти;
2. открыть календарь;
3. создать черновик;
4. прикрепить медиа;
5. выбрать Telegram + MAX + VK;
6. написать базовый текст;
7. изменить Telegram-версию отдельно;
8. отправить на согласование;
9. Approver согласует;
10. назначить дату/время;
11. закрыть браузер;
12. дождаться автоматической публикации;
13. снова открыть приложение;
14. увидеть по каждой площадке:

```text
published / failed / retrying
```

15. открыть URL опубликованного поста;
16. вручную повторить failed publication;
17. увидеть историю действий;
18. после перезапуска контейнера не получить дубль публикации;
19. после пересборки не потерять media;
20. после рестарта worker продолжает корректно работать с незавершенными jobs.

---

# 35. Обязательные тесты

## Unit

- state transitions;
- UTM builder;
- retry policy;
- idempotency key;
- encryption/decryption;
- post variant inheritance;
- platform validation mapping.

## Integration

- PostgreSQL job claiming;
- PublicationJob lifecycle;
- approval lifecycle.

## E2E Playwright

Минимум:

```text
login
→ create post
→ edit platform variant
→ submit for review
→ approve
→ schedule
```

Для публикации использовать mock SocialAdapter в CI.

---

# 36. Seed data

Для dev окружения:

Users:
- admin@example.local / ADMIN
- content@example.local / CONTENT_MANAGER
- approver@example.local / APPROVER

Рубрики:
- Новая лекция
- Подборка
- Инструкция
- История лектора
- Календарный повод
- Новости проекта
- Партнерство

Площадки:
- Telegram
- MAX
- VK
- OK disabled

Никогда не использовать эти dev users/passwords в production.

---

# 37. Первый реальный milestone для Codex

Не начинать с четырех API одновременно.

Первая рабочая цель:

> BGL Content Hub локально и в Amvera позволяет создать, согласовать, запланировать и автоматически опубликовать пост в Telegram.

После этого подключить MAX.

После MAX — VK.

После этого готовить OK.

---

# 38. Что Codex должен создать в репозитории в первую очередь

```text
README.md
ARCHITECTURE.md
IMPLEMENTATION_PLAN.md
SECURITY.md

.env.example
.gitignore
Dockerfile
amvera.yaml

package.json
tsconfig...

server/
web/
prisma/
tests/
```

В README обязательно описать:

- локальный запуск;
- миграции;
- seed;
- production build;
- deployment в Amvera;
- добавление первой учетной записи ADMIN;
- подключение Telegram;
- backup/restore notes.

---

# 39. Правила разработки

1. Не коммитить secrets.
2. Не хранить access tokens plaintext.
3. Не смешивать platform API с domain logic.
4. Не делать внешнюю соцсеть источником истины для расписания.
5. Не считать метрику `0`, если API ее не предоставляет.
6. Не публиковать повторно без idempotency check.
7. Не выполнять destructive DB changes без migration.
8. Не удалять AuditLog каскадно вместе с сущностью.
9. Не блокировать интерфейс ожиданием внешних API.
10. Все публикации выполнять background worker'ом.
11. Manual "Опубликовать сейчас" также создает job, а не вызывает API прямо из HTTP request.
12. Все platform responses нормализовать.
13. Внешние API считать нестабильными: timeout, retry, normalized errors.
14. Если официальная документация API изменилась — обновить adapter и документацию, а не обходить проблему неофициальной автоматизацией.

---

# 40. Официальные источники для реализации

Amvera:
- https://docs.amvera.ru/
- https://docs.amvera.ru/applications/configuration/docker.html
- https://docs.amvera.ru/applications/configuration/variables.html
- https://docs.amvera.ru/databases/postgreSQL.html

Telegram:
- https://core.telegram.org/bots/api

MAX:
- https://dev.max.ru/docs-api

VK:
- https://dev.vk.com/

Одноклассники:
- https://apiok.ru/

При расхождении этого ТЗ с актуальной официальной документацией конкретного API приоритет имеет официальная документация по техническому контракту API, но продуктовое поведение BGL Content Hub должно быть сохранено.

---

# 41. Начни работу

Первый ответ/результат Codex должен включать:

1. предлагаемую структуру репозитория;
2. `ARCHITECTURE.md`;
3. первичную Prisma schema;
4. список env variables;
5. план Phase 0 → Phase 4;
6. перечень открытых технических вопросов, если они действительно блокируют разработку.

После этого реализуй Phase 0 и Phase 1.

Не останавливайся на создании красивого frontend-макета: ядро продукта — надежный workflow и движок публикаций.
