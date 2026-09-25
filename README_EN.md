# 🤖 MAX Chatbot — "Service-Learning. First"

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Custom-red.svg)](./LICENSE)

[Русский](./README.md) · **English**

A chatbot for the national **MAX** messenger that provides information support to participants of the **"Service-Learning. First"** educational programme — social task No. 4262 from the Dobro.rf Association.

---

## 📖 About

The bot helps teachers, educational organisations and regional teams quickly find answers to common questions about the programme: registration, documents, platforms, social projects and contacts.

**The key requirement** was to let programme staff update the answer base **without involving developers**. This is implemented via a visual admin panel with full CRUD.

### How it works

```
User (MAX) → webhook → bot-logic → FAQ search → reply
                                ↘ LLM fallback (if on-topic but no answer found)
```

1. A user messages the bot or taps an inline button.
2. MAX delivers the event to `POST /api/max/webhook`.
3. The bot searches the knowledge base (text normalisation, stop-words, scoring across question/keywords/answer).
4. If no answer exists but the question is programme-related, an LLM fallback kicks in.
5. Everything is logged for analytics.

---

## ✨ Features

### For the MAX user
- 🔍 **Keyword search** with relevance ranking
- 📂 **Category navigation** via inline buttons
- 📌 **Pinned questions** — important items always on top
- 👍 **Answer feedback** ("Helpful" / "Not helpful")
- 🤖 **LLM fallback** for on-topic questions missing from the base
- 💬 **Commands**: `/start`, `/help`, `/menu`, `/search <text>`, `/show <id>`, `/faq`, `/about`, `/contacts`

### For the administrator
- 📊 **Dashboard** — key daily metrics
- 📈 **Analytics** — answer funnel, FAQ/LLM share, off-topic rate, charts
- 🗂️ **Knowledge base (FAQ)** — CRUD for categories and answers, tags, pinning
- ❓ **Unanswered requests** — add to the base in one click
- 📝 **Message logs** — all inbound/outbound with filters and CSV export
- 🔴 **Real-time logs** via SSE
- 🛡️ **Audit log** — every admin action recorded
- ⚙️ **Settings** — bot token, webhook, texts, bot check, health status
- 📣 **Broadcasts** — scheduled messages to users
- 🔎 **Global search** (`Ctrl+K`) across the whole base
- 🌓 Light/dark theme

---

## 🛠️ Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Next.js 16 (App Router), TypeScript 5 |
| Database | Prisma ORM 6 + SQLite |
| Frontend | React 19, shadcn/ui, Tailwind CSS 4, Recharts |
| Integration | MAX Bot API — `https://platform-api2.max.ru/` |
| AI fallback | z-ai-web-dev-sdk (backend only) |
| Runtime | Bun (recommended) or Node.js 18+ |

---

## 🚀 Quick Start

### Requirements
- **Bun** 1.0+ (recommended) or **Node.js** 18+
- 256 MB RAM (dev) / 512 MB (prod)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/QuadDarv1ne/service-learning-max-chatbot.git
cd service-learning-max-chatbot

# 2. Install dependencies
bun install

# 3. Configure environment
cp .env.example .env
# Edit .env: DATABASE_URL, ADMIN_PASSWORD

# 4. Create the DB schema and seed the knowledge base
bun run db:push
bun run scripts/seed.ts

# 5. Run
bun run dev
```

Open **http://localhost:3000** — the admin panel. Default password is `admin123` (**change it in `.env`!**).

### Connecting to a MAX bot

1. Create and verify a profile on the [MAX Business Portal](https://business.max.ru/self).
2. **"Chat-bots"** section → create a bot → pass moderation (up to 48 hours).
3. **"Chat-bots"** → select the bot → **⋮** → **"Settings"** → **"Access token"** → copy the token.
4. In the admin panel: **"Settings"** → paste the token and webhook URL → **"Save"**.
5. Click **"Subscribe webhook"**, then **"Check bot"**.

> Webhooks require **HTTPS**. For local development use `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`.

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) (Russian) for details.

---

## 📜 Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Dev server on `localhost:3000` |
| `bun run build` | Production build (standalone) |
| `bun run start` | Run the built app |
| `bun run lint` | ESLint |
| `bun run autocommit` | Auto-commit watcher (see below) |
| `bun run db:push` | Apply schema to the DB |
| `bun run db:generate` | Generate Prisma Client |
| `bun run db:migrate` | Migrations (dev) |
| `bun run db:reset` | Reset the DB |
| `bun run scripts/seed.ts` | Seed the knowledge base |

### Auto-commit (optional)

```bash
bun run autocommit                        # commit + push after a quiet period
AUTOCOMMIT_PUSH=false bun run autocommit  # commit only
AUTOCOMMIT_DEBOUNCE_MS=1000 bun run autocommit
```

---

## 📁 Project Structure

```
.
├── docs/                    # 📚 Documentation (Russian)
│   ├── INDEX.md             # Documentation map
│   ├── ARCHITECTURE.md      # Architecture & ER diagram
│   ├── DEPLOYMENT.md        # Setup & MAX integration
│   ├── API_REFERENCE.md     # All endpoints with examples
│   ├── ADMIN_GUIDE.md       # Administrator guide
│   ├── STAFF_GUIDE.md       # Staff guide
│   ├── USER_GUIDE.md        # End-user guide
│   ├── FAQ_WRITING.md       # How to write Q&A
│   ├── TROUBLESHOOTING.md   # Troubleshooting
│   └── CHANGELOG.md         # Version history
├── prisma/
│   └── schema.prisma        # 10 database models
├── scripts/
│   ├── seed.ts              # Knowledge base seeding
│   └── autocommit.mjs       # Auto-commit watcher
├── src/
│   ├── app/
│   │   ├── api/             # 37 API endpoints
│   │   └── page.tsx         # Admin panel (SPA)
│   ├── components/
│   │   ├── admin/           # Admin panel UI
│   │   └── ui/              # shadcn/ui components
│   └── lib/                 # max-api, bot-logic, llm, auth, db
├── db/custom.db             # SQLite (created automatically)
├── Caddyfile                # Reverse-proxy config
├── .env.example             # Environment template
└── README.md
```

### Database models
`Category`, `FaqItem`, `Tag`, `FaqTag`, `MaxUser`, `MessageLog`, `BotSetting`, `BotCommand`, `Broadcast`, `AdminActionLog`

---

## ⚙️ Environment Variables

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `DATABASE_URL` | Yes | `file:./db/custom.db` | SQLite database path |
| `ADMIN_PASSWORD` | Yes | `admin123` | Admin panel password |
| `MAX_BOT_TOKEN` | No | — | Bot token (DB value takes priority) |
| `CRON_SECRET` | No | — | Secret for cron-triggered broadcasts |
| `NODE_ENV` | No | `development` | `production` for production |
| `PORT` | No | `3000` | HTTP server port |

Full annotated list — in [`.env.example`](./.env.example).

---

## 🚢 Deployment

- **VPS** — systemd + Caddy (recommended), see [DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- **Docker** — ready-made `Dockerfile` and `docker-compose.yml` there too
- **Vercel/Netlify** — ⚠️ not recommended: SQLite does not work in serverless

Post-deploy health check:
```bash
curl https://your-domain.ru/api/health
```

---

## 📚 Documentation

The full documentation set is currently available in **Russian** — see [docs/INDEX.md](./docs/INDEX.md).

| Document | Audience |
|----------|----------|
| [Documentation map](./docs/INDEX.md) | Everyone |
| [Architecture](./docs/ARCHITECTURE.md) | Developers |
| [Deployment](./docs/DEPLOYMENT.md) | Admins, DevOps |
| [API Reference](./docs/API_REFERENCE.md) | Developers, integrators |
| [Admin guide](./docs/ADMIN_GUIDE.md) | Administrators |
| [Staff guide](./docs/STAFF_GUIDE.md) | Programme staff |
| [User guide](./docs/USER_GUIDE.md) | End users |
| [Writing FAQ](./docs/FAQ_WRITING.md) | Programme staff |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | Everyone |

---

## 🤝 Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

Please run `bun run lint` before committing.

---

## 📞 Contacts

- **Social partner**: Association of Volunteer Centres "Dobro.rf"
- **Email**: info@dobro.ru (mention "Обучение служением" in the subject)
- **Programme website**: [dobro.ru](https://dobro.ru)
- **Social task No. 4262**: [dobro.ru/catalog/4262](https://dobro.ru/catalog/4262)
- **MAX developer docs**: [dev.max.ru](https://dev.max.ru/docs)
- **MAX Business Portal**: [business.max.ru](https://business.max.ru/self)

---

## 📝 License

This project is distributed under a **custom license with a sharealike condition and commercial-use restrictions**. See [LICENSE](./LICENSE) (EN) and [LICENSE_RU](./LICENSE_RU) (RU).

Developed within social task No. 4262 of the Dobro.rf Association.
Programme: "Service-Learning. First" · Copyright © 2025–2026 Dupley Maxim Igorevich (QuadDarv1ne) and Maestro7IT.
