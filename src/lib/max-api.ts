// MAX Bot API client
// Docs: https://dev.max.ru/docs-api
//
// Base URL: https://platform-api2.max.ru
// Auth: header "Authorization: <access_token>" (NOT via query string)
// Limits: 30 rps max

import { db } from '@/lib/db'

const MAX_API_BASE = 'https://platform-api2.max.ru'

async function getToken(): Promise<string | null> {
  const setting = await db.botSetting.findUnique({ where: { key: 'botToken' } })
  return setting?.value || process.env.MAX_BOT_TOKEN || null
}

export interface MaxKeyboardButton {
  text: string
  payload: string
  type?: 'callback' | 'link' | 'chat'
  url?: string
}

export interface MaxKeyboard {
  buttons: MaxKeyboardButton[][]
}

export interface MaxUser {
  user_id: number
  first_name?: string
  last_name?: string
  username?: string
  is_bot?: boolean
  last_activity_time?: number
}

export interface MaxChat {
  chat_id: number
  chat_type: 'private' | 'group' | 'channel'
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

export interface MaxMessage {
  message_id?: number
  mid?: number
  text?: string
  from?: MaxUser
  chat?: MaxChat
  sender?: MaxUser
  chat_created?: boolean
  chat_type?: string
  timestamp?: number
  callback?: {
    query_id?: string
    payload?: string
    button_payload?: string
    data?: string
  }
  payload?: string
}

export interface MaxUpdate {
  update_id?: number
  update_type:
    | 'message_created'
    | 'message_callback'
    | 'bot_started'
    | 'bot_added'
    | 'bot_removed'
    | 'message_edited'
    | 'message_removed'
    | 'user_added'
    | 'user_removed'
    | 'chat_title_changed'
    | string
  message?: MaxMessage
  chat?: MaxChat
  from?: MaxUser
  user?: MaxUser
  query_id?: string
  payload?: string
  callback?: {
    query_id: string
    payload: string
  }
}

async function callMaxApi<T>(
  method: string,
  init: {
    httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: Record<string, unknown>
    path?: Record<string, string | number>
  } = {},
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  const token = await getToken()
  if (!token) {
    return { ok: false, error: 'Bot token is not configured', status: 401 }
  }

  // Substitute path params
  let path = method
  if (init.path) {
    for (const [k, v] of Object.entries(init.path)) {
      path = path.replace(`{${k}}`, String(v))
    }
  }

  const url = `${MAX_API_BASE}/${path.replace(/^\//, '')}`
  const httpMethod = init.httpMethod || 'GET'

  const headers: Record<string, string> = {
    Authorization: token,
    'Content-Type': 'application/json',
  }

  try {
    const response = await fetch(url, {
      method: httpMethod,
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
    })

    const text = await response.text()
    let parsed: unknown = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }

    if (!response.ok) {
      return {
        ok: false,
        error: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
        status: response.status,
      }
    }

    return { ok: true, data: parsed as T, status: response.status }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      status: 0,
    }
  }
}

// --- Public API ---

export const maxApi = {
  // GET /me — info about the bot
  async getMe(): Promise<MaxUser | null> {
    const res = await callMaxApi<MaxUser>('me')
    return res.ok && res.data ? res.data : null
  },

  // POST /messages — send message to user
  async sendMessage(params: {
    chat_id: number
    text: string
    attachments?: unknown[]
    keyboard?: MaxKeyboard
    reply_to_message_id?: number
    format?: 'html' | 'markdown'
    parse_mode?: string
  }) {
    return callMaxApi<{ mid: number; body: Record<string, unknown> }>('messages', {
      httpMethod: 'POST',
      body: params,
    })
  },

  // POST /messages/{messageId}/answer — answer callback (closes the callback query)
  async answerCallback(messageId: number | string, body: { query_id: string; text?: string; show_alert?: boolean }) {
    return callMaxApi(`messages/${messageId}/answer`, {
      httpMethod: 'POST',
      path: { messageId },
      body,
    })
  },

  // GET /subscriptions — list webhook subscriptions
  async getSubscriptions() {
    return callMaxApi<{ subscriptions: unknown[] }>('subscriptions', { httpMethod: 'GET' })
  },

  // POST /subscriptions — subscribe webhook
  async subscribeWebhook(params: {
    url: string
    // events to subscribe; MAX accepts a URL and a list of update types
    updates?: string[]
    secret?: string
  }) {
    return callMaxApi<{ subscription: Record<string, unknown> }>('subscriptions', {
      httpMethod: 'POST',
      body: params,
    })
  },

  // DEL /subscriptions — unsubscribe
  async unsubscribe(params: { url?: string; subscription_id?: string }) {
    return callMaxApi('subscriptions', {
      httpMethod: 'DELETE',
      body: params,
    })
  },

  // PATCH /bots — set bot commands list
  async setMyCommands(commands: Array<{ name: string; description: string }>) {
    return callMaxApi('me', {
      httpMethod: 'PATCH',
      body: { commands },
    })
  },

  raw: callMaxApi,
}

// --- Helpers ---

// Build a keyboard grid (rows of buttons)
export function buildKeyboard(rows: MaxKeyboardButton[][]): MaxKeyboard {
  return { buttons: rows }
}

// Common keyboards used by the bot

export async function getCategoriesKeyboard(): Promise<MaxKeyboard> {
  const categories = await db.category.findMany({
    where: { published: true },
    orderBy: { order: 'asc' },
    select: { id: true, title: true, slug: true },
  })

  // 1 button per row
  const rows: MaxKeyboardButton[][] = categories.map((c) => [
    { text: c.title, payload: `cat:${c.id}`, type: 'callback' },
  ])

  // Add a search button at the bottom
  rows.push([{ text: '🔍 Поиск по ключевым словам', payload: 'search', type: 'callback' }])
  rows.push([{ text: '❓ Помощь', payload: 'help', type: 'callback' }])

  return buildKeyboard(rows)
}

export function getFaqItemsKeyboard(
  items: Array<{ id: string; question: string; pinned?: boolean }>,
): MaxKeyboard {
  // Sort pinned first, then by original order
  const sorted = [...items].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0
  })
  // Truncate question if too long, prepend ★ for pinned
  const rows: MaxKeyboardButton[][] = sorted.map((it) => {
    const prefix = it.pinned ? '★ ' : ''
    const question = it.question
    const maxLen = 60 - prefix.length
    const text =
      question.length > maxLen
        ? prefix + question.slice(0, maxLen - 1) + '…'
        : prefix + question
    return [
      {
        text,
        payload: `faq:${it.id}`,
        type: 'callback',
      },
    ]
  })
  rows.push([{ text: '⬅️ Назад к разделам', payload: 'home', type: 'callback' }])
  return buildKeyboard(rows)
}

export function getHomeKeyboard(): MaxKeyboard {
  return buildKeyboard([
    [{ text: '🏠 Главное меню', payload: 'home', type: 'callback' }],
  ])
}

export function getAfterAnswerKeyboard(faqId: string, categoryId: string): MaxKeyboard {
  return buildKeyboard([
    [
      { text: '👍 Полезно', payload: `feedback:${faqId}:up`, type: 'callback' },
      { text: '👎 Не помогло', payload: `feedback:${faqId}:down`, type: 'callback' },
    ],
    [{ text: '🔄 Показать ещё вопросы из раздела', payload: `cat:${categoryId}`, type: 'callback' }],
    [{ text: '🏠 Главное меню', payload: 'home', type: 'callback' }],
    [{ text: '✍️ Связаться с командой', payload: 'contact_human', type: 'callback' }],
  ])
}
