# 🤖 Чат-бот MAX — "Обучение служением. Первые"

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Custom-red.svg)](./LICENSE)

**Русский** · [English](./README_EN.md)

Чат-бот в национальном мессенджере **MAX** для информационной поддержки участников просветительской программы **"Обучение служением. Первые"** — социальная задача №4262 от Ассоциации Добро.рф.

---

## 📖 О проекте

Бот помогает педагогам, представителям образовательных организаций и региональным командам быстро находить ответы на типовые вопросы о программе: регистрация, документы, платформы, социальные проекты и контакты.

**Ключевое требование ТЗ** — возможность обновлять базу ответов силами сотрудников программы **без привлечения разработчиков**. Реализовано через визуальную админ-панель с полным CRUD.

### Как это работает

```
Пользователь (MAX) → webhook → bot-logic → поиск по FAQ → ответ
                                      ↘ LLM-фолбэк (если вопрос по теме, но ответа нет)
```

1. Пользователь пишет боту или нажимает inline-кнопку.
2. MAX присылает событие на `POST /api/max/webhook`.
3. Бот ищет ответ в базе знаний (нормализация текста, стоп-слова, скоринг по вопросу/ключевым словам/ответу).
4. Если ответа нет, но вопрос относится к программе — подключается LLM-фолбэк.
5. Всё логируется для аналитики.

---

## ✨ Возможности

### Для пользователя в MAX
- 🔍 **Поиск по ключевым словам** с ранжированием релевантных ответов
- 📂 **Навигация по категориям** через inline-кнопки
- 📃 **Закреплённые вопросы** — важное всегда сверху
- 👍 **Оценка ответа** ("Полезно" / "Не помогло")
- 🤖 **LLM-фолбэк** для вопросов по программе, которых нет в базе
- 💬 **Команды**: `/start`, `/help`, `/menu`, `/search <текст>`, `/show <id>`, `/faq`, `/about`, `/contacts`

### Для администратора
- 📊 **Дашборд** — ключевые метрики за сутки
- 📈 **Аналитика** — воронка ответов, доля FAQ/LLM, off-topic, графики
- 🗂️ **База знаний (FAQ)** — CRUD категорий и ответов, теги, закрепление
- ❓ **Запросы без ответа** — прямое добавление в базу в один клик
- 📝 **Логи обращений** — все входящие/исходящие с фильтрами и экспортом CSV
- 🔴 **Real-time логи** через SSE
- 🛡️ **Журнал действий** — аудит операций администратора
- ⚙️ **Настройки** — токен бота, webhook, тексты, проверка бота, health-статус
- 📣 **Рассылки** — отложенные сообщения пользователям
- 🔎 **Глобальный поиск** (`Ctrl+K`) по всей базе
- 🌓 Светлая/тёмная тема

---

## 🛠️ Технологии

| Слой | Стек |
|------|------|
| Backend | Next.js 16 (App Router), TypeScript 5 |
| База данных | Prisma ORM 6 + SQLite |
| Frontend | React 19, shadcn/ui, Tailwind CSS 4, Recharts |
| Интеграция | MAX Bot API — `https://platform-api2.max.ru/` |
| ИИ-фолбэк | z-ai-web-dev-sdk (только backend) |
| Runtime | Bun (рекомендуется) или Node.js 18+ |

---

## 🚀 Быстрый старт

### Требования
- **Bun** 1.0+ (рекомендуется) или **Node.js** 18+
- 256 MB RAM (dev) / 512 MB (prod)

### Установка

```bash
# 1. Клонировать репозиторий
git clone https://github.com/QuadDarv1ne/service-learning-max-chatbot.git
cd service-learning-max-chatbot

# 2. Установить зависимости
bun install

# 3. Настроить окружение
cp .env.example .env
# Отредактируйте .env: DATABASE_URL, ADMIN_PASSWORD

# 4. Создать схему БД и заполнить базу знаний
bun run db:push
bun run scripts/seed.ts

# 5. Запустить
bun run dev
```

Откройте **http://localhost:3000** — админ-панель. Пароль по умолчанию `admin123` (**смените его в `.env`!**).

### Подключение к боту MAX

1. Создайте и верифицируйте профиль на [Портале для бизнеса MAX](https://business.max.ru/self).
2. Раздел **"Чат-боты"** → создайте бота → пройдите модерацию (до 48 часов).
3. **"Чат-боты"** → выберите бота → **⋮** → **"Настройки"** → **"Токен доступа"** → скопируйте токен.
4. В админ-панели: **"Настройки"** → вставьте токен и URL вебхука → **"Сохранить"**.
5. Нажмите **"Подписать webhook"**, затем **"Проверить бота"**.

> Вебхук требует **HTTPS**. Для локальной разработки — `cloudflared tunnel --url http://localhost:3000` или `ngrok http 3000`.

Подробнее: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

---

## 📜 Скрипты

| Команда | Назначение |
|---------|-----------|
| `bun run dev` | Dev-сервер на `localhost:3000` |
| `bun run build` | Продакшен-сборка (standalone) |
| `bun run start` | Запуск собранного приложения |
| `bun run lint` | ESLint |
| `bun run autocommit` | Watcher авто-коммитов (см. ниже) |
| `bun run db:push` | Применить схему к БД |
| `bun run db:generate` | Сгенерировать Prisma Client |
| `bun run db:migrate` | Миграции (dev) |
| `bun run db:reset` | Сброс БД |
| `bun run scripts/seed.ts` | Заполнить базу знаний |

### Авто-коммит (опционально)

```bash
bun run autocommit                     # коммит + push после паузы
AUTOCOMMIT_PUSH=false bun run autocommit  # только коммит
AUTOCOMMIT_DEBOUNCE_MS=1000 bun run autocommit
```

---

## 📁 Структура проекта

```
.
├── docs/                    # 📚 Документация
│   ├── INDEX.md             # Карта документации
│   ├── ARCHITECTURE.md      # Архитектура и ER-диаграмма
│   ├── DEPLOYMENT.md        # Установка и подключение к MAX
│   ├── API_REFERENCE.md     # Все endpoints с примерами
│   ├── ADMIN_GUIDE.md       # Руководство администратора
│   ├── STAFF_GUIDE.md       # Руководство сотрудника
│   ├── USER_GUIDE.md        # Руководство пользователя
│   ├── FAQ_WRITING.md       # Как писать вопросы и ответы
│   ├── TROUBLESHOOTING.md   # Решение проблем
│   └── CHANGELOG.md         # История версий
├── prisma/
│   └── schema.prisma        # 10 моделей БД
├── scripts/
│   ├── seed.ts              # Наполнение базы знаний
│   └── autocommit.mjs       # Watcher авто-коммитов
├── src/
│   ├── app/
│   │   ├── api/             # 37 API endpoints
│   │   └── page.tsx         # Админ-панель (SPA)
│   ├── components/
│   │   ├── admin/           # UI админ-панели
│   │   └── ui/              # shadcn/ui компоненты
│   └── lib/                 # max-api, bot-logic, llm, auth, db
├── db/custom.db             # SQLite (создаётся автоматически)
├── Caddyfile                # Конфиг reverse-proxy
├── .env.example             # Шаблон переменных окружения
└── README.md
```

### Модели базы данных
`Category`, `FaqItem`, `Tag`, `FaqTag`, `MaxUser`, `MessageLog`, `BotSetting`, `BotCommand`, `Broadcast`, `AdminActionLog`

---

## ⚙️ Переменные окружения

| Переменная | Обязательно | По умолчанию | Назначение |
|------------|:-----------:|--------------|------------|
| `DATABASE_URL` | Да | `file:./db/custom.db` | Путь к SQLite базе |
| `ADMIN_PASSWORD` | Да | `admin123` | Пароль админ-панели |
| `MAX_BOT_TOKEN` | Нет | — | Токен бота (приоритет у значения из БД) |
| `CRON_SECRET` | Нет | — | Секрет для вызова рассылок из cron |
| `NODE_ENV` | Нет | `development` | `production` для продакшена |
| `PORT` | Нет | `3000` | Порт HTTP-сервера |

Полный список с комментариями — в [`.env.example`](./.env.example).

---

## 🚢 Деплой

- **VPS** — systemd + Caddy (рекомендуется), инструкция в [DEPLOYMENT.md](./docs/DEPLOYMENT.md#продакшен-деплой)
- **Docker** — готовый `Dockerfile` и `docker-compose.yml` там же
- **Vercel/Netlify** — ⚠️ не рекомендуется: SQLite не работает в serverless

Проверка после деплоя:
```bash
curl https://your-domain.ru/api/health
```

---

## 📚 Документация

| Документ | Для кого |
|----------|----------|
| [Карта документации](./docs/INDEX.md) | Все |
| [Архитектура](./docs/ARCHITECTURE.md) | Разработчики |
| [Разворачивание](./docs/DEPLOYMENT.md) | Администраторы, DevOps |
| [API Reference](./docs/API_REFERENCE.md) | Разработчики, интеграторы |
| [Руководство администратора](./docs/ADMIN_GUIDE.md) | Администраторы |
| [Руководство сотрудника](./docs/STAFF_GUIDE.md) | Сотрудники программы |
| [Руководство пользователя](./docs/USER_GUIDE.md) | Конечные пользователи |
| [Как писать FAQ](./docs/FAQ_WRITING.md) | Сотрудники программы |
| [Решение проблем](./docs/TROUBLESHOOTING.md) | Все |

---

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку: `git checkout -b feature/my-feature`
3. Закоммитьте изменения: `git commit -m "feat: my feature"`
4. Запушьте: `git push origin feature/my-feature`
5. Откройте Pull Request

Перед коммитом желательно прогнать `bun run lint`.

---

## 📞 Контакты

- **Социальный партнёр**: Ассоциация волонтёрских центров "Добро.рф"
- **Email**: info@dobro.ru (в теме письма укажите "Обучение служением")
- **Сайт программы**: [dobro.ru](https://dobro.ru)
- **Социальная задача №4262**: [dobro.ru/catalog/4262](https://dobro.ru/catalog/4262)
- **Документация MAX**: [dev.max.ru](https://dev.max.ru/docs)
- **Портал для бизнеса MAX**: [business.max.ru](https://business.max.ru/self)

---

## 📝 Лицензия

Проект распространяется под **специальной лицензией с условием sharealike и ограничением коммерческого использования**. См. [LICENSE](./LICENSE) (EN) и [LICENSE_RU](./LICENSE_RU) (RU).

Разработано в рамках социальной задачи №4262 Ассоциации Добро.рф.
Программа: "Обучение служением. Первые" · Copyright © 2025–2026 Dupley Maxim Igorevich (QuadDarv1ne) и Maestro7IT.
