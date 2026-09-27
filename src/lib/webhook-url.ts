// Webhook URL validation for the MAX Bot API.
//
// MAX only accepts webhooks that are publicly reachable over HTTPS, and it
// rejects URLs carrying a query string or a fragment. All of these are hard
// failures on MAX's side with an unhelpful error message, so we check them
// locally and explain the problem before calling the API.
//
// Pure function on purpose: it is unit-tested in webhook-url.test.ts and can
// be reused by the UI for inline validation.

export type WebhookUrlCheck = { ok: true; normalized: string } | { ok: false; error: string }

// Hostnames MAX can never reach — a common copy-paste mistake during setup.
const UNREACHABLE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

export function checkWebhookUrl(raw: string | null | undefined): WebhookUrlCheck {
  const value = (raw ?? '').trim()

  if (!value) {
    return { ok: false, error: 'URL вебхука не заполнен' }
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return {
      ok: false,
      error:
        'URL вебхука некорректен — ожидается полный адрес, например https://bot.example.ru/api/max/webhook',
    }
  }

  if (parsed.protocol !== 'https:') {
    return {
      ok: false,
      error:
        parsed.protocol === 'http:'
          ? 'MAX принимает только HTTPS. Поставьте reverse-proxy с сертификатом (см. Caddyfile) или используйте туннель'
          : `Неподдерживаемая схема "${parsed.protocol}" — нужен https://`,
    }
  }

  if (parsed.search) {
    return {
      ok: false,
      error: 'URL вебхука не должен содержать query-строку — MAX отклоняет такую подписку',
    }
  }

  if (parsed.hash) {
    return { ok: false, error: 'URL вебхука не должен содержать якорь (#...)' }
  }

  const host = parsed.hostname.toLowerCase()
  const unreachable =
    UNREACHABLE_HOSTS.has(host) ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.startsWith('127.')

  if (unreachable) {
    return {
      ok: false,
      error: `Адрес "${host}" недоступен из интернета — укажите публичный домен или URL туннеля (cloudflared/ngrok)`,
    }
  }

  // MAX stores the URL verbatim; a trailing slash is a frequent source of 404s
  // on the Next.js route, so we drop it.
  return { ok: true, normalized: value.replace(/\/+$/, '') }
}
