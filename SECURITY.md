# Безопасность

BGL Content Hub — закрытый single-tenant сервис. Регистрации нет; первого ADMIN создаёт оператор, остальных пользователей ADMIN через интерфейс.

- Argon2id (19 MiB, t=2, p=1), пароли 12–128 символов при создании/сбросе.
- Opaque session token 256 bit только в HttpOnly cookie. БД хранит HMAC SHA-256 с SESSION_SECRET. Сессия истекает через 7 дней. Пароль/роль/отключение пользователя отзывают сессии.
- В production cookie `__Host-bgl_session`, Secure, SameSite=Lax, Path=/; APP_BASE_URL обязан быть HTTPS.
- POST/PUT/DELETE требуют совпадения Origin и session-bound X-CSRF-Token. Login также проверяет Origin. CSRF token хранится в памяти клиента, не localStorage.
- На login максимум 10 запросов/IP/мин; trustProxy=false. За reverse proxy это консервативно ограничивает всю команду по адресу ingress. Включать trustProxy можно только для документированных доверенных прокси, не для произвольных X-Forwarded-For.
- VIEWER и APPROVER не редактируют контент; approve/reject доступны ADMIN/APPROVER; users/settings writes — ADMIN. Последний активный ADMIN защищён транзакционным advisory lock.
- Конфликт сохранения: 409, версия обязательна. Одновременные изменения не перетирают друг друга.
- Аудит append-only через приложение, в транзакции с изменением; нет HTTP endpoint для удаления. Production роль БД желательно ограничить INSERT/SELECT на AuditLog. Архивирование — отдельная процедура оператора.
- Логи не содержат body/cookie/password/token; DTO не возвращают passwordHash и секреты. Клиент видит только нормализованные ошибки.
- Токены соцсетей пока не принимаются. SocialCredential предусматривает ciphertext, IV и auth tag; Phase 2/4 должен реализовать AES-256-GCM до любого сохранения credentials. APP_ENCRYPTION_KEY сохраняется только как secret, не вместе с ciphertext backup.
- CSP, nosniff, запрет embedding. Медиа endpoints ещё не реализованы; `/data/media` не раздаётся как static directory.
- `.env`, кеши, БД и browser results игнорируются Git/Docker. Dev seed запрещён в production, не содержит предустановленного пароля и не меняет существующие пароли/роли. CI credentials фиктивные и применяются только к изолированным test services.

Никогда не публиковать `.env` или dev accounts. Перед production: HTTPS, уникальные SESSION_SECRET и ключ шифрования, managed PostgreSQL TLS по инструкции провайдера, права БД, backups и restore drill. Ротация SESSION_SECRET инвалидирует все текущие сессии. Ротация encryption key в будущих фазах требует re-encryption и сохранения версии ключа.

Сообщения об уязвимости передавать владельцу репозитория приватным каналом; не включать секреты в GitHub issues.
