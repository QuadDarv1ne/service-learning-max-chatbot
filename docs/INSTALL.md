# 📦 Установка и запуск

Версия 1.7 · Чат-бот MAX для программы «Обучение служением. Первые»

> Краткое руководство по разворачиванию проекта с нуля.

## Быстрый старт (5 минут)

### Требования

- **Bun** 1.0+ или **Node.js** 18+ (рекомендуется Bun)
- 256 MB RAM (для разработки), 512 MB (для продакшена)
- 100 MB на диске

### Шаг 1. Распаковать архив

```bash
tar -xzf max-chatbot-v1.7.tar.gz
cd max-chatbot
```

Если архив распакован в текущую директорию (без вложенной папки), просто продолжайте:

```bash
ls
# Должны увидеть: package.json, src/, prisma/, scripts/, docs/, .env, etc.
```

### Шаг 2. Установить зависимости

```bash
bun install
```

Если Bun не установлен:
```bash
# Linux/macOS
curl -fsSL https://bun.sh/install | bash

# Или через npm
npm install
```

### Шаг 3. Настроить переменные окружения

Файл `.env` уже включён в архив. Проверьте и при необходимости отредактируйте:

```bash
cat .env
```

Должно быть:
```bash
DATABASE_URL=file:./db/custom.db
ADMIN_PASSWORD=admin123
```

⚠️ **Смените пароль** в продакшене! Минимум 12 символов.

### Шаг 4. Создать базу данных

```bash
bun run db:push
```

Это создаст SQLite базу в `db/custom.db` со всеми таблицами.

### Шаг 5. Заполнить базу знаний

```bash
bun run scripts/seed.ts
```

Создаст:
- 6 категорий FAQ (О программе, Регистрация, Документы, Платформы, Социальные проекты, Контакты)
- 23 типовых вопроса с ответами
- 8 команд бота (/start, /help, /menu, /search, /show, /about, /contacts, /faq)
- Настройки по умолчанию

### Шаг 6. Запустить dev-сервер

```bash
bun run dev
```

Откройте http://localhost:3000 в браузере.

### Шаг 7. Войти в админ-панель

- Пароль: `admin123` (если не меняли в `.env`)
- После входа вы увидите Дашборд

### Шаг 8. Проверить health endpoint

```bash
curl http://localhost:3000/api/health
```

Должен вернуть JSON с `"version": "1.7"` и `"database": {"ok": true}`.

---

## Частые проблемы

### Проблема: `Cannot find module '.next/standalone/server.js'`

**Решение**: Это сообщение об ошибке от `bun run start`. Используйте `bun run dev` для разработки.

Если нужен продакшен:
```bash
bun run build
bun run start
```

### Проблема: `DATABASE_URL` не работает

Проверьте `.env`:
```bash
# ✅ Правильно (относительный путь):
DATABASE_URL=file:./db/custom.db

# ❌ Неправильно (абсолютный путь, не переносим):
DATABASE_URL=file:/home/user/my-project/db/custom.db
```

### Проблема: `prisma:command not found` или `prisma generate` errors

Переустановите зависимости:
```bash
rm -rf node_modules
rm bun.lock
bun install
bun run db:generate
```

### Проблема: Порт 3000 уже занят

```bash
# Найти и завершить процесс
lsof -i :3000
kill <PID>

# Или использовать другой порт
PORT=3001 bun run dev
```

### Проблема: База данных повреждена

```bash
# Остановить сервер
# (Ctrl+C если запущен в терминале)

# Удалить старую базу
rm db/custom.db

# Пересоздать
bun run db:push
bun run scripts/seed.ts

# Запустить снова
bun run dev
```

### Проблема: TypeScript ошибки при сборке

`next.config.ts` уже содержит `typescript.ignoreBuildErrors: true` — это означает что TypeScript ошибки не блокируют сборку.

Если вы хотите строгую проверку:
1. Уберите `ignoreBuildErrors: true` из `next.config.ts`
2. Запустите `bun run lint` для проверки

### Проблема: `EADDRINUSE` или `address already in use`

```bash
# Linux/macOS
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## Подключение к реальному боту MAX

### 1. Создать бота на платформе MAX

1. Зарегистрироваться на [max.ru](https://max.ru/) как партнёр (юрлицо/ИП/самозанятый РФ)
2. Создать чат-бота в личном кабинете
3. Пройти модерацию (до 48 часов)
4. Получить токен бота

### 2. Настроить webhook URL

Для разработки используйте ngrok или Cloudflare Tunnel:

```bash
# Установить ngrok: https://ngrok.com/
ngrok http 3000
# Получите URL вида: https://abc123.ngrok.io
```

### 3. Внести настройки в админ-панель

1. Откройте http://localhost:3000 (или ваш URL)
2. Раздел **«Настройки»**
3. Вставьте **токен бота** в поле «Токен бота»
4. Вставьте **URL вебхука**: `https://abc123.ngrok.io/api/max/webhook`
5. Нажмите **«Сохранить настройки»**
6. Нажмите **«Подписать webhook»** — статус сменится на «Подписка активна»
7. Нажмите **«Проверить бота»** — должно показать имя и ID
8. В карточке «Команды бота» нажмите **«Зарегистрировать все в MAX»** — команды появятся в автодополнении

### 4. Протестировать

1. Откройте мессенджер MAX
2. Найдите бота по никнейму (например, `@idИНН_bot`)
3. Нажмите «Начать диалог»
4. Отправьте `/start` — бот ответит приветствием
5. Отправьте `/menu` — увидите inline-кнопки категорий
6. Отправьте `/search регистрация` — бот найдёт релевантные ответы

---

## Продакшен-деплой

### Вариант 1: systemd + Caddy (рекомендуется)

#### 1. Установить Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

#### 2. Настроить Caddyfile

`/etc/caddy/Caddyfile`:
```
your-domain.ru {
    reverse_proxy localhost:3000
}
```

Caddy автоматически получит SSL-сертификат от Let's Encrypt.

#### 3. Установить проект

```bash
sudo mkdir -p /opt/max-bot
sudo chown $USER:$USER /opt/max-bot
cd /opt/max-bot

# Скопировать архив и распаковать
scp max-chatbot-v1.7.tar.gz user@server:/opt/max-bot/
tar -xzf max-chatbot-v1.7.tar.gz --strip-components=0

# Установить зависимости
bun install --production

# Сменить пароль в .env!
nano .env
# ADMIN_PASSWORD=your-strong-password-here

# Создать базу
mkdir -p data
bun run db:push
bun run scripts/seed.ts
```

#### 4. Создать systemd-сервис

`/etc/systemd/system/max-bot.service`:
```ini
[Unit]
Description=MAX Chat Bot — Обучение служением
After=network.target

[Service]
Type=simple
User=maxbot
WorkingDirectory=/opt/max-bot
EnvironmentFile=/opt/max-bot/.env
ExecStart=/home/maxbot/.bun/bin/bun run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable max-bot
sudo systemctl start max-bot
sudo systemctl status max-bot
```

### Вариант 2: Docker

`Dockerfile`:
```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

RUN mkdir -p /app/data
ENV DATABASE_URL=file:/app/data/custom.db
RUN bun run db:push

EXPOSE 3000
CMD ["bun", "run", "start"]
```

`docker-compose.yml`:
```yaml
version: '3.8'
services:
  max-bot:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - DATABASE_URL=file:/app/data/custom.db
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Запуск:
```bash
ADMIN_PASSWORD=your-strong-password docker-compose up -d
```

---

## Структура проекта

```
.
├── docs/                    # 10 файлов документации
│   ├── INDEX.md
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── API_REFERENCE.md
│   ├── ADMIN_GUIDE.md
│   ├── STAFF_GUIDE.md
│   ├── USER_GUIDE.md
│   ├── FAQ_WRITING.md
│   ├── TROUBLESHOOTING.md
│   └── CHANGELOG.md
├── prisma/
│   └── schema.prisma         # 7 моделей (Category, FaqItem, MaxUser, MessageLog, BotSetting, BotCommand, AdminActionLog)
├── scripts/
│   └── seed.ts               # Инициализация базы (6 категорий, 23 FAQ, 8 команд)
├── src/
│   ├── app/
│   │   ├── api/              # 22+ API endpoints
│   │   ├── layout.tsx        # Корневой layout с ThemeProvider
│   │   ├── page.tsx          # Главная: login + админ-панель
│   │   └── globals.css      # Фирменная палитра MAX
│   ├── components/
│   │   ├── admin/            # 12 UI компонентов
│   │   └── ui/               # shadcn/ui компоненты
│   └── lib/
│       ├── db.ts             # Prisma клиент
│       ├── max-api.ts        # MAX Bot API клиент
│       ├── bot-logic.ts      # Обработка событий
│       ├── llm.ts            # ИИ-фолбэк
│       ├── auth.ts           # Cookie-сессии
│       ├── admin-log.ts      # Аудит admin-действий
│       ├── api-client.ts     # Fetch wrapper
│       └── format.ts         # timeAgo, formatDurationMs
├── public/
│   ├── logo.svg
│   └── robots.txt
├── .env                     # DATABASE_URL, ADMIN_PASSWORD
├── .env.example             # Шаблон для копирования
├── package.json             # Скрипты: dev, build, start, lint, db:push, db:generate, db:migrate, db:reset
├── bun.lock                 # Точные версии зависимостей
├── tsconfig.json
├── next.config.ts           # output: "standalone"
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json          # shadcn/ui конфиг
├── eslint.config.mjs
├── Caddyfile               # Конфиг для продакшена
├── INSTALL.md              # Этот файл
└── README.md               # Краткое описание
```

---

## Скрипты package.json

| Скрипт | Команда | Назначение |
|--------|---------|------------|
| `dev` | `next dev -p 3000` | Dev-сервер с авто-reload |
| `build` | `next build` | Production-сборка в `.next/standalone/` |
| `start` | `bun .next/standalone/server.js` | Production-сервер |
| `lint` | `eslint .` | Проверка кода |
| `db:push` | `prisma db push` | Применить схему к БД (без миграций) |
| `db:generate` | `prisma generate` | Перегенерировать Prisma клиент |
| `db:migrate` | `prisma migrate dev` | Создать миграцию |
| `db:reset` | `prisma migrate reset` | Сбросить БД (с потерей данных) |

---

## Контакты

- **Email**: info@dobro.ru (тема «Обучение служением»)
- **Документация MAX**: [dev.max.ru](https://dev.max.ru/docs)
- **Полная документация**: см. каталог `docs/` (особенно `INDEX.md`)
- **Решение проблем**: `docs/TROUBLESHOOTING.md`
