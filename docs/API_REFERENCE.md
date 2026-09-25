# 📡 API Reference

Версия 1.3 · Справочник всех 18 API endpoints

## Содержание

- [Аутентификация](#аутентификация)
- [Health-check](#health-check)
- [Категории](#категории)
- [FAQ-ответы](#faq-ответы)
- [Логи обращений](#логи-обращений)
- [Аналитика](#аналитика)
- [Admin actions (audit)](#admin-actions-audit)
- [База знаний (export/import)](#база-знаний-exportimport)
- [Пользователи](#пользователи)
- [Настройки](#настройки)
- [MAX Bot API интеграция](#max-bot-api-интеграция)

---

## Аутентификация

Все endpoints (кроме `/api/health` и `/api/max/webhook`) требуют cookie-сессию.

### POST `/api/auth/login`

Войти в админ-панель. Устанавливает cookie `max_bot_admin_session` (7 дней).

**Тело запроса:**
```json
{
  "password": "admin123"
}
```

**Ответ (200 OK):**
```json
{ "ok": true }
```

**Ответ (401 Unauthorized):**
```json
{ "error": "invalid_credentials" }
```

**Логируется в audit:** `login` (успешно) или `login_failed` (с причиной).

**Пример curl:**
```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}'
```

### POST `/api/auth/logout`

Уничтожает сессию (удаляет cookie).

**Ответ (200 OK):**
```json
{ "ok": true }
```

**Логируется в audit:** `logout`.

### GET `/api/auth/me`

Проверить, авторизован ли текущий запрос.

**Ответ:**
```json
{ "authenticated": true }
```

---

## Health-check

### GET `/api/health`

⚠️ **Без авторизации** — для uptime-мониторинга.

Возвращает сводку состояния системы.

**Ответ (200 OK):**
```json
{
  "ok": false,
  "version": "1.3",
  "service": "max-bot-admin-panel",
  "programme": "Обучение служением. Первые",
  "timestamp": "2026-09-24T17:14:11.209Z",
  "uptime": 8,
  "checks": {
    "database": { "ok": true },
    "botTokenConfigured": false,
    "webhookUrl": "",
    "webhookSubscribed": false,
    "llmEnabled": true,
    "knowledgeBase": {
      "categories": 6,
      "publishedCategories": 6,
      "faqs": 23,
      "publishedFaqs": 23,
      "empty": false
    },
    "last24h": {
      "incomingMessages": 0,
      "outgoingMessages": 0,
      "maxApiErrors": 0,
      "llmHandled": 0,
      "avgResponseMs": 0
    },
    "lastActivityAt": null
  }
}
```

**Поле `ok`:** `true` только если: БД работает, токен настроен, база знаний не пуста.

**Пример curl:**
```bash
curl http://localhost:3000/api/health
```

Используйте в uptime-мониторинге (Uptime Robot, Better Stack, etc.) — алерт при `ok=false` или HTTP-коде не 200.

---

## Категории

### GET `/api/categories`

Получить список всех категорий с количеством FAQ в каждой.

**Ответ:**
```json
{
  "categories": [
    {
      "id": "cmufn2bxz000bpmysbq7ccufc",
      "title": "О программе «Обучение служением. Первые»",
      "slug": "about-programme",
      "description": "Общие сведения о просветительской программе...",
      "order": 0,
      "published": true,
      "itemCount": 4,
      "createdAt": "2026-09-24T14:10:26.357Z",
      "updatedAt": "2026-09-24T14:10:26.357Z"
    }
  ]
}
```

### POST `/api/categories`

Создать новую категорию. **Требует авторизации.**

**Тело:**
```json
{
  "title": "Финансирование",
  "slug": "finance",
  "description": "Вопросы о грантах и финансировании проектов",
  "published": true
}
```

`slug` — необязательное, генерируется из `title` если пустое.

**Ответ:** `{ "category": { ... } }`

**Логируется:** `category_create` с названием категории.

### GET `/api/categories/{id}`

Получить одну категорию со всеми её FAQ-ответами.

### PUT `/api/categories/{id}`

Обновить категорию. Принимает те же поля, что и POST, но все опциональны.

**Логируется:** `category_update`.

### DELETE `/api/categories/{id}`

Удалить категорию. **Каскадно удаляются все её FAQ-ответы.**

**Логируется:** `category_delete` с названием удалённой категории.

**Пример:**
```bash
curl -b cookies.txt -X DELETE http://localhost:3000/api/categories/abc123
```

---

## FAQ-ответы

### GET `/api/faqs?categoryId=X`

Получить список FAQ. Опциональный фильтр `categoryId`.

**Ответ:**
```json
{
  "faqs": [
    {
      "id": "cmufn2bxz000dpmys54g3wzvq",
      "categoryId": "abc123",
      "question": "Что такое программа «Обучение служением. Первые»?",
      "answer": "«Обучение служением. Первые» — это...",
      "keywords": "программа, обучение служением, ...",
      "order": 0,
      "published": true,
      "viewCount": 0,
      "category": { "id": "abc123", "title": "О программе" }
    }
  ]
}
```

### POST `/api/faqs`

Создать новый FAQ. **Требует авторизации.**

**Тело:**
```json
{
  "categoryId": "abc123",
  "question": "Как получить грант на проект?",
  "answer": "Гранты на проекты программы «Обучение служением» предоставляются через...",
  "keywords": "грант, финансирование, деньги, спонсорство",
  "published": true
}
```

`order` генерируется автоматически (макс+1 в категории).

**Логируется:** `faq_create` с обрезанным текстом вопроса.

### GET `/api/faqs/{id}`

Получить один FAQ с категорией.

### PUT `/api/faqs/{id}`

Обновить FAQ. Любые поля опциональны.

**Логируется:** `faq_update`.

### DELETE `/api/faqs/{id}`

Удалить FAQ.

**Логируется:** `faq_delete` с обрезанным текстом вопроса.

---

## Логи обращений

### GET `/api/logs`

Получить журнал сообщений с пагинацией и фильтрами.

**Query-параметры (все опциональны):**
- `page` — номер страницы (по умолчанию 1)
- `pageSize` — размер страницы (по умолчанию 50, максимум 200)
- `direction` — `in` | `out`
- `messageType` — `text` | `callback` | `command` | `system`
- `source` — `system` | `command` | `callback` | `search` | `faq` | `llm` | `fallback` | `off_topic`
- `maxUserId` — фильтр по ID пользователя в MAX
- `dateFrom` — ISO datetime (например, `2026-09-24T00:00:00`)
- `dateTo` — ISO datetime
- `search` — поиск по тексту сообщения (contains)

**Ответ:**
```json
{
  "logs": [
    {
      "id": "cmuf...",
      "maxUserId": 12345,
      "direction": "in",
      "messageType": "text",
      "source": "command",
      "text": "как зарегистрироваться",
      "durationMs": null,
      "llmOk": null,
      "maxApiStatus": null,
      "maxApiError": null,
      "searchText": "как зарегистрироваться",
      "callbackPayload": null,
      "matchedFaqId": null,
      "createdAt": "2026-09-24T14:23:06.123Z",
      "user": {
        "id": "...",
        "maxUserId": 12345,
        "firstName": "Иван",
        "lastName": null,
        "username": "ivan_petrov"
      }
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 50,
  "totalPages": 2
}
```

**Пример:**
```bash
# Все LLM-ответы за последний час
curl -b cookies.txt "http://localhost:3000/api/logs?source=llm&dateFrom=$(date -d '1 hour ago' -Iseconds)"
```

### GET `/api/logs/export` (CSV)

Выгрузить логи в CSV. **Те же фильтры, что и у GET /api/logs.**

Колонки CSV: `timestamp, direction, message_type, source, duration_ms, llm_ok, max_api_status, max_user_id, user_first_name, user_last_name, user_username, text, search_text, callback_payload, matched_faq_id`

**Ответ:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="max-bot-logs-YYYY-MM-DD.csv"`

**Пример:**
```bash
# Скачать все логи за сегодня
curl -b cookies.txt -o logs.csv "http://localhost:3000/api/logs/export?dateFrom=$(date +%Y-%m-%d)"
```

---

## Аналитика

### GET `/api/analytics`

Получить комплексную аналитику по обращениям.

**Query-параметры:**
- `period` — `7d` (по умолчанию) | `30d` | `90d` | `all`
- `groupBy` — `day` (по умолчанию) | `hour` | `week`

**Ответ:**
```json
{
  "period": "7d",
  "groupBy": "day",
  "startDate": "2026-09-17T17:14:11.209Z",
  "funnel": {
    "incoming": 47,
    "outgoing": 52,
    "callbacks": 18,
    "commands": 5,
    "faqMatched": 35,
    "llmHandled": 3,
    "llmFailures": 0,
    "fallbackShown": 4,
    "offTopicBlocked": 5,
    "maxApiErrors": 0
  },
  "metrics": {
    "faqMatchRate": 74,
    "llmRate": 6,
    "fallbackRate": 9,
    "offTopicRate": 11,
    "llmSuccessRate": 100,
    "uniqueUsers": 12,
    "avgMessagesPerUser": 8.2
  },
  "activity": [
    { "date": "2026-09-18", "in": 5, "out": 5, "llm": 0 },
    { "date": "2026-09-19", "in": 8, "out": 9, "llm": 1 }
  ],
  "topQueries": [
    { "query": "как зарегистрироваться", "count": 5 },
    { "query": "что такое программа", "count": 3 }
  ],
  "topCategories": [
    { "id": "...", "title": "Регистрация", "itemCount": 4, "totalViews": 12 }
  ],
  "topFaqs": [
    { "id": "...", "question": "Как зарегистрироваться?", "viewCount": 8, "category": { "title": "Регистрация" } }
  ],
  "responseTime": {
    "avgMs": 850,
    "minMs": 12,
    "maxMs": 4200,
    "p95Ms": 2500,
    "samples": 52
  },
  "sourceDistribution": {
    "search": 35,
    "faq": 12,
    "llm": 3,
    "fallback": 4,
    "off_topic": 5
  },
  "unansweredQueries": [
    { "query": "какие документы нужны для гранта", "count": 2, "lastAsked": "2026-09-23T10:00:00Z", "sampleUser": 54321 }
  ],
  "apiFailures": [
    { "maxApiStatus": 401, "maxApiError": "Invalid token", "createdAt": "2026-09-23T10:00:00Z" }
  ]
}
```

**Пример:**
```bash
curl -b cookies.txt "http://localhost:3000/api/analytics?period=30d&groupBy=day"
```

---

## Admin actions (audit)

### GET `/api/admin-actions`

Получить журнал admin-действий с фильтрами.

**Query-параметры:**
- `action` — фильтр по типу (например, `login`, `category_create`, `faq_delete`)
- `ok` — `true` | `false` — фильтр по статусу
- `page`, `pageSize` — пагинация
- `dateFrom`, `dateTo` — диапазон дат

**Ответ:**
```json
{
  "logs": [
    {
      "id": "cmuf...",
      "action": "category_create",
      "resource": "cmufn2bxz000bpmysbq7ccufc",
      "detail": "Создана категория «Финансирование»",
      "ipHash": "eff8e7ca506627fe",
      "userAgent": "Mozilla/5.0...",
      "ok": true,
      "error": null,
      "createdAt": "2026-09-24T17:14:52.906Z"
    }
  ],
  "total": 10,
  "page": 1,
  "pageSize": 50,
  "totalPages": 1
}
```

**Список всех типов actions:**
- `login`, `logout`, `login_failed`
- `settings_update`, `bot_token_set`
- `category_create`, `category_update`, `category_delete`
- `faq_create`, `faq_update`, `faq_delete`
- `webhook_subscribe`
- `commands_register`
- `test_send`
- `knowledge_import`, `knowledge_export`
- `audit_export`

### GET `/api/admin-actions/export` (CSV)

Выгрузить журнал в CSV. **Те же фильтры, что и у GET /api/admin-actions.**

Колонки: `timestamp, action, ok, resource, detail, error, ip_hash, user_agent`

Сам экспорт логируется как `audit_export`.

---

## База знаний (export/import)

### GET `/api/knowledge/export`

Скачать полную базу знаний в JSON.

**Ответ:** JSON с полями `version`, `exportedAt`, `programme`, `categories` (с вложенными `items`), `settings` (без токена!).

```json
{
  "version": "1.0",
  "exportedAt": "2026-09-24T15:00:00.000Z",
  "programme": "Обучение служением. Первые",
  "categories": [
    {
      "title": "О программе",
      "slug": "about-programme",
      "description": "...",
      "order": 0,
      "published": true,
      "items": [
        {
          "question": "Что такое программа?",
          "answer": "...",
          "keywords": "...",
          "order": 0,
          "published": true
        }
      ]
    }
  ],
  "settings": {
    "welcomeMessage": "Здравствуйте!...",
    "helpMessage": "Я могу помочь...",
    "llmEnabled": "true"
  }
}
```

**Логируется:** `knowledge_export` с количеством категорий.

### POST `/api/knowledge/import`

Восстановить базу из JSON. **Требует авторизации.**

**Тело:** JSON в том же формате, что и экспорт.

**Ответ:**
```json
{
  "ok": true,
  "imported": { "categories": 6, "items": 23 }
}
```

⚠️ **Атомарная транзакция:** либо все данные заменены, либо ничего не изменено (если файл некорректный).

⚠️ **Все текущие категории и ответы будут удалены** — сделайте резервную копию через export сначала!

**Логируется:** `knowledge_import` с количеством категорий и ответов (или `knowledge_import` failure с ошибкой).

**Пример:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/knowledge/import \
  -H "Content-Type: application/json" \
  --data-binary @knowledge-backup.json
```

---

## Пользователи

### GET `/api/users/{maxUserId}`

Получить конкретного пользователя MAX со всей историей сообщений.

**Параметр:** `maxUserId` — числовой ID пользователя в MAX (не внутренний UUID).

**Ответ:**
```json
{
  "user": {
    "id": "cmuf...",
    "maxUserId": 12345,
    "firstName": "Иван",
    "lastName": "Петров",
    "username": "ivan_petrov",
    "state": null,
    "createdAt": "2026-09-24T14:00:00.000Z",
    "lastSeenAt": "2026-09-24T15:30:00.000Z"
  },
  "messages": [
    {
      "id": "...",
      "direction": "in",
      "messageType": "text",
      "source": "command",
      "text": "как зарегистрироваться",
      "durationMs": null,
      "llmOk": null,
      "maxApiStatus": null,
      "maxApiError": null,
      "searchText": "как зарегистрироваться",
      "callbackPayload": null,
      "matchedFaqId": null,
      "createdAt": "2026-09-24T14:23:06.123Z"
    },
    ...
  ]
}
```

Возвращает максимум 500 последних сообщений.

**Пример:**
```bash
curl -b cookies.txt http://localhost:3000/api/users/12345
```

---

## Настройки

### GET `/api/settings`

Получить настройки. **Без авторизации** возвращает только публичные (`welcomeMessage`, `helpMessage`, `webhookUrl`, `webhookSubscribed`). **С авторизацией** — дополнительно `botToken` (маской ••••) и `llmEnabled`.

**Ответ (без авторизации):**
```json
{
  "settings": {
    "welcomeMessage": "Здравствуйте!...",
    "helpMessage": "Я могу помочь...",
    "webhookUrl": "",
    "webhookSubscribed": "false"
  },
  "authenticated": false
}
```

**Ответ (с авторизацией):**
```json
{
  "settings": {
    "welcomeMessage": "...",
    "helpMessage": "...",
    "webhookUrl": "https://...",
    "webhookSubscribed": "true",
    "botToken": "••••••••••••••••1234",
    "llmEnabled": "true"
  },
  "authenticated": true
}
```

### PUT `/api/settings`

Обновить настройки. **Требует авторизации.**

**Тело (опциональные поля):**
```json
{
  "botToken": "your_token_here",
  "webhookUrl": "https://your-domain.ru/api/max/webhook",
  "welcomeMessage": "Здравствуйте! Я бот...",
  "helpMessage": "Я могу помочь...",
  "llmEnabled": "true"
}
```

⚠️ Если `botToken` содержит `•` (замаскированный), он **не обновляется** — нужно передавать реальный токен.

⚠️ `llmEnabled` должен быть строкой `"true"` или `"false"` (не boolean).

**Логируется:** `settings_update` (список изменённых полей без токена) + `bot_token_set` отдельно для чувствительного токена.

**Пример:**
```bash
curl -b cookies.txt -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"welcomeMessage":"Новый текст приветствия"}'
```

---

## MAX Bot API интеграция

### POST `/api/max/webhook`

⚠️ **Без авторизации** — endpoint для приёма событий от MAX.

Принимает JSON-объект Update от MAX Bot API. Поддерживаемые типы `update_type`:
- `bot_started` — пользователь запустил бота (отправляет приветствие + клавиатуру категорий)
- `message_callback` — нажатие на inline-кнопку (парсинг payload: `home`, `help`, `search`, `cat:{id}`, `faq:{id}`, `contact_human`)
- `message_created` — новое текстовое сообщение (команда /start /help или поиск по FAQ)
- другие типы — логируются, но не обрабатываются

**Пример входящего Update (от MAX):**
```json
{
  "update_id": 12345,
  "update_type": "message_created",
  "message": {
    "message_id": 67890,
    "text": "как зарегистрироваться",
    "from": { "user_id": 12345, "first_name": "Иван" }
  },
  "chat": { "chat_id": 12345, "chat_type": "private" },
  "user": { "user_id": 12345, "first_name": "Иван", "username": "ivan_petrov" }
}
```

**Ответ:** `200 OK` с `{ "ok": true }`. Любой ответ ≠ 200 заставит MAX повторить запрос.

**Пример curl (имитация webhook):**
```bash
curl -X POST http://localhost:3000/api/max/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "update_type": "message_created",
    "user": { "user_id": 12345, "first_name": "Иван" },
    "chat": { "chat_id": 12345, "chat_type": "private" },
    "message": { "text": "как зарегистрироваться" }
  }'
```

### POST `/api/max/subscribe`

Подписать webhook на MAX Bot API. **Требует авторизации.**

1. Берёт `botToken` и `webhookUrl` из `BotSetting`
2. Делает POST-запрос на `https://platform-api2.max.ru/subscriptions` с URL и списком update types
3. При успехе — устанавливает `webhookSubscribed=true` в `BotSetting`

**Логируется:** `webhook_subscribe` (с URL) или failure (с ошибкой).

### GET `/api/max/bot-info`

Получить информацию о боте из MAX API (GET `/me`). **Требует авторизации.**

**Ответ:**
```json
{
  "bot": {
    "user_id": 12345678,
    "first_name": "Бот Обучение служением",
    "username": "id1234567_bot",
    "is_bot": true,
    "last_activity_time": 1737500130100
  }
}
```

### POST `/api/max/test-send`

Отправить произвольное сообщение конкретному пользователю. **Требует авторизации.**

**Тело:**
```json
{
  "maxUserId": 12345,
  "text": "Тестовое сообщение от администратора"
}
```

**Логируется:** `test_send` (с получателем и обрезанным текстом) + `MessageLog` с source=system, maxApiStatus.

### POST `/api/max/register-commands`

Зарегистрировать команды `/start` и `/help` в MAX (PATCH `/me`). **Требует авторизации.**

После вызова команды появятся в автодополнении команд мессенджера MAX.

**Логируется:** `commands_register` или failure.

---

## Коды ответов

| Код | Значение |
|-----|----------|
| 200 | Успешный запрос |
| 400 | Неверный запрос (невалидный JSON, отсутствие обязательного поля) |
| 401 | Не авторизован (нет cookie или неверный пароль) |
| 404 | Ресурс не найден (например, категория/FAQ по ID) |
| 500 | Внутренняя ошибка сервера (ошибка БД, исключение) |
| 502 | Bad gateway — MAX Bot API вернул ошибку |

---

## Лимиты

- **MAX Bot API**: 30 запросов в секунду
- **Pagination API**: максимум 200 элементов на страницу
- **Логи (один запрос)**: максимум 10 000 записей в CSV-экспорте
- **История пользователя**: максимум 500 последних сообщений

---

## Ссылки

- [Архитектура](./ARCHITECTURE.md)
- [Разворачивание](./DEPLOYMENT.md)
- [Руководство администратора](./ADMIN_GUIDE.md)
- [Документация MAX Bot API](https://dev.max.ru/docs-api)
