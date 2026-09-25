// Bot message processing logic
// Receives MaxUpdate and dispatches to the right handler.
//
// v1.1: enriched logging — records durationMs, source (faq/llm/callback/command/fallback),
//       llmOk, maxApiStatus, maxApiError, searchText, callbackPayload.

import { db } from '@/lib/db'
import {
  maxApi,
  type MaxUpdate,
  type MaxKeyboard,
  getCategoriesKeyboard,
  getFaqItemsKeyboard,
  getHomeKeyboard,
  getAfterAnswerKeyboard,
} from '@/lib/max-api'
import { generateSmartReply, isProgrammeRelated } from '@/lib/llm'

// Re-export for consumers (e.g. webhook route)
export type { MaxUpdate }

type MessageSource =
  | 'system'
  | 'command'
  | 'callback'
  | 'search'
  | 'faq'
  | 'llm'
  | 'fallback'
  | 'off_topic'

// Helper: get or create a MaxUser row
async function ensureUser(maxUserId: number, payload: { firstName?: string; lastName?: string; username?: string }) {
  let user = await db.maxUser.findUnique({ where: { maxUserId } })
  if (!user) {
    user = await db.maxUser.create({
      data: {
        maxUserId,
        firstName: payload.firstName ?? null,
        lastName: payload.lastName ?? null,
        username: payload.username ?? null,
      },
    })
  } else {
    // Update profile fields if changed
    await db.maxUser.update({
      where: { id: user.id },
      data: {
        firstName: payload.firstName ?? user.firstName,
        lastName: payload.lastName ?? user.lastName,
        username: payload.username ?? user.username,
        lastSeenAt: new Date(),
      },
    })
  }
  return user
}

// Helper: log a message with rich metadata
async function logMessage(params: {
  userDbId: string
  maxUserId: number
  direction: 'in' | 'out'
  messageType: 'text' | 'callback' | 'command' | 'system'
  text?: string | null
  payload?: unknown
  matchedFaqId?: string | null
  source?: MessageSource | null
  durationMs?: number | null
  llmOk?: boolean | null
  maxApiStatus?: number | null
  maxApiError?: string | null
  searchText?: string | null
  callbackPayload?: string | null
}) {
  return db.messageLog.create({
    data: {
      userId: params.userDbId,
      maxUserId: params.maxUserId,
      direction: params.direction,
      messageType: params.messageType,
      text: params.text ?? null,
      payload: params.payload ? JSON.stringify(params.payload) : null,
      matchedFaqId: params.matchedFaqId ?? null,
      source: params.source ?? null,
      durationMs: params.durationMs ?? null,
      llmOk: params.llmOk ?? null,
      maxApiStatus: params.maxApiStatus ?? null,
      maxApiError: params.maxApiError ?? null,
      searchText: params.searchText ?? null,
      callbackPayload: params.callbackPayload ?? null,
    },
  })
}

// Helper: send message to MAX and capture HTTP status / error
async function sendToMax(
  chatId: number,
  text: string,
  keyboard?: MaxKeyboard,
  format?: 'html' | 'plain',
): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await maxApi.sendMessage({
    chat_id: chatId,
    text,
    keyboard,
    format: format === 'html' ? 'html' : undefined,
  })
  return { ok: res.ok, status: res.status, error: res.error }
}

// Helper: read a setting
async function getSetting(key: string, fallback = ''): Promise<string> {
  const row = await db.botSetting.findUnique({ where: { key } })
  return row?.value || fallback
}

// Helper: set user state (search mode, etc.)
async function setUserState(maxUserId: number, state: string | null, stateData?: unknown) {
  await db.maxUser.update({
    where: { maxUserId },
    data: {
      state: state ?? null,
      stateData: stateData ? JSON.stringify(stateData) : null,
    },
  })
}

// Helper: normalize text for search — lower case, ё→е, strip punctuation, collapse whitespace
// Used both for user query and FAQ haystack to maximize match rate
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е') // unify ё/е — users type either
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // strip all punctuation except letters/numbers/spaces/dashes
    .replace(/\s+/g, ' ')
    .trim()
}

// Helper: search FAQ by query text (matches question, keywords, or answer).
// Filters out short stopwords so single common words don't trigger false positives.
const STOPWORDS = new Set([
  'и', 'а', 'но', 'или', 'что', 'как', 'где', 'когда', 'почему', 'зачем', 'кто', 'чем',
  'на', 'в', 'с', 'по', 'для', 'от', 'до', 'из', 'к', 'у', 'о', 'об',
  'не', 'нет', 'да', 'же', 'ли', 'бы', 'то', 'это', 'эта', 'эти', 'тот',
  'я', 'мы', 'вы', 'он', 'она', 'они', 'ты',
  'the', 'a', 'an', 'is', 'are', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for',
])

async function searchFaq(query: string) {
  // Normalize the query (ё→е, lower, strip punctuation)
  const normalizedQuery = normalizeForSearch(query)
  const terms = normalizedQuery
    .split(/\s+/)
    .filter((t) => t.length > 2) // 3+ chars
    .filter((t) => !STOPWORDS.has(t)) // skip stopwords
  if (terms.length === 0) return []

  const allItems = await db.faqItem.findMany({
    where: { published: true },
    include: { category: true },
    orderBy: [{ pinned: 'desc' }, { order: 'asc' }],
  })

  const scored = allItems.map((item) => {
    // Normalize haystack the same way as query
    const haystack = normalizeForSearch(
      `${item.question} ${item.keywords ?? ''} ${item.answer}`,
    )
    let score = 0
    for (const term of terms) {
      if (haystack.includes(term)) score += 1
      // Bonus for matching question directly
      const normalizedQuestion = normalizeForSearch(item.question)
      if (normalizedQuestion.includes(term)) score += 2
      // Extra bonus for matching keywords (more relevant)
      if (item.keywords && normalizeForSearch(item.keywords).includes(term)) score += 1.5
    }
    // Bonus for pinned items — they show first even with same score
    if (item.pinned) score += 0.5
    return { item, score }
  })

  // Require at least one term to be present (score > 0)
  // Sort by: score desc, then pinned (already in prisma order), then order
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // Within same score, pinned first
      if (a.item.pinned !== b.item.pinned) return a.item.pinned ? -1 : 1
      return a.item.order - b.item.order
    })
    .slice(0, 5)
    .map((s) => s.item)
}

// --- Handlers ---

async function handleBotStarted(update: MaxUpdate) {
  const t0 = Date.now()
  const user = update.user || update.from!
  const chat = update.chat!
  const dbUser = await ensureUser(user.user_id, {
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
  })

  const welcome = await getSetting(
    'welcomeMessage',
    'Здравствуйте! Я бот-помощник программы «Обучение служением. Первые».',
  )

  await logMessage({
    userDbId: dbUser.id,
    maxUserId: user.user_id,
    direction: 'in',
    messageType: 'system',
    text: 'bot_started',
    source: 'system',
  })

  const keyboard = await getCategoriesKeyboard()
  const sendRes = await sendToMax(chat.chat_id, welcome, keyboard)

  await logMessage({
    userDbId: dbUser.id,
    maxUserId: user.user_id,
    direction: 'out',
    messageType: 'text',
    text: welcome,
    payload: { keyboard: 'categories' },
    source: 'system',
    durationMs: Date.now() - t0,
    maxApiStatus: sendRes.status,
    maxApiError: sendRes.error,
  })
}

async function handleCallback(update: MaxUpdate) {
  const t0 = Date.now()
  const user = update.user || update.from!
  const chat = update.chat!
  const dbUser = await ensureUser(user.user_id, {
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
  })

  // payload is on the update itself for `message_callback`
  const rawPayload = update.payload ?? update.callback?.payload ?? ''
  const payload = String(rawPayload)

  await logMessage({
    userDbId: dbUser.id,
    maxUserId: user.user_id,
    direction: 'in',
    messageType: 'callback',
    text: payload,
    source: 'callback',
    callbackPayload: payload,
  })

  // Parse payload: cat:{id} | faq:{id} | home | help | search | contact_human
  let responseText = ''
  let keyboard: MaxKeyboard | null = null
  let matchedFaqId: string | null = null
  let responseSource: MessageSource = 'callback'

  if (payload === 'home') {
    responseText = await getSetting('welcomeMessage', 'Выберите интересующий раздел:')
    keyboard = await getCategoriesKeyboard()
    await setUserState(user.user_id, null)
  } else if (payload === 'help') {
    responseText = await getSetting(
      'helpMessage',
      'Я могу помочь вам с вопросами по программе. Используйте кнопки навигации или напишите свой вопрос текстом.',
    )
    keyboard = await getCategoriesKeyboard()
    await setUserState(user.user_id, null)
  } else if (payload === 'search') {
    responseText =
      '🔍 Режим поиска активирован.\n\nНапишите ключевые слова вашего вопроса текстом — например, «как зарегистрироваться» или «документы для участия». Я подберу наиболее подходящие ответы.'
    keyboard = getHomeKeyboard()
    await setUserState(user.user_id, 'search')
  } else if (payload === 'contact_human') {
    responseText =
      '✉️ Для обращения к федеральной команде программы используйте:\n\n• Эл. почта: info@dobro.ru (в теме письма укажите «Обучение служением»)\n• Форму обратной связи на платформе Добро.рф\n\nСрок ответа: до 3 рабочих дней.'
    keyboard = getHomeKeyboard()
    await setUserState(user.user_id, null)
  } else if (payload.startsWith('feedback:')) {
    // Feedback on FAQ answer: feedback:<faqId>:up | feedback:<faqId>:down
    const parts = payload.split(':')
    const faqId = parts[1]
    const direction = parts[2] as 'up' | 'down'
    if (direction === 'up') {
      responseText = '\u{1F44D} Спасибо за отзыв! Рад, что ответ был полезен.'
    } else {
      responseText = '\u{1F44E} Спасибо за отзыв! Постараемся улучшить этот ответ. Если нужен другой вопрос — воспользуйтесь /search или /menu.'
    }
    keyboard = getHomeKeyboard()
    // Log feedback for analytics
    await db.messageLog.create({
      data: {
        userId: dbUser.id,
        maxUserId: user.user_id,
        direction: 'in',
        messageType: 'callback',
        text: `feedback:${direction}`,
        payload: JSON.stringify({ faqId, feedback: direction }),
        source: 'callback',
        callbackPayload: payload,
        searchText: null,
      },
    })
    await setUserState(user.user_id, null)
  } else if (payload.startsWith('cat:')) {
    const categoryId = payload.slice(4)
    const category = await db.category.findUnique({ where: { id: categoryId } })
    if (!category) {
      responseText = 'Категория не найдена. Вернёмся в главное меню.'
      keyboard = await getCategoriesKeyboard()
    } else {
      const items = await db.faqItem.findMany({
        where: { categoryId, published: true },
        orderBy: [{ pinned: 'desc' }, { order: 'asc' }],
        select: { id: true, question: true, pinned: true },
      })
      responseText = `📋 Раздел: ${category.title}\n\nВыберите вопрос:`
      keyboard = getFaqItemsKeyboard(items)
      await setUserState(user.user_id, null)
    }
  } else if (payload.startsWith('faq:')) {
    const faqId = payload.slice(4)
    const item = await db.faqItem.findUnique({
      where: { id: faqId },
      include: { category: true },
    })
    if (!item || !item.published) {
      responseText = 'Ответ не найден. Вернёмся в главное меню.'
      keyboard = await getCategoriesKeyboard()
    } else {
      responseText = `❓ ${item.question}\n\n${item.answer}`
      keyboard = getAfterAnswerKeyboard(item.id, item.categoryId)
      matchedFaqId = item.id
      responseSource = 'faq'

      // Increment view count
      await db.faqItem.update({
        where: { id: item.id },
        data: { viewCount: { increment: 1 } },
      })
      await setUserState(user.user_id, null)
    }
  } else {
    responseText = 'Неизвестная команда. Выберите раздел из меню.'
    keyboard = await getCategoriesKeyboard()
  }

  const sendRes = await sendToMax(chat.chat_id, responseText, keyboard ?? undefined)

  await logMessage({
    userDbId: dbUser.id,
    maxUserId: user.user_id,
    direction: 'out',
    messageType: 'text',
    text: responseText,
    payload: { keyboard: 'inline', sourcePayload: payload },
    matchedFaqId,
    source: responseSource,
    durationMs: Date.now() - t0,
    maxApiStatus: sendRes.status,
    maxApiError: sendRes.error,
    callbackPayload: payload,
  })
}

async function handleTextMessage(update: MaxUpdate) {
  const t0 = Date.now()
  const user = update.user || update.from!
  const chat = update.chat!
  const text = update.message?.text || ''
  const dbUser = await ensureUser(user.user_id, {
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
  })

  await logMessage({
    userDbId: dbUser.id,
    maxUserId: user.user_id,
    direction: 'in',
    messageType: 'text',
    text,
    source: 'command',
    searchText: text,
  })

  // Handle commands — check if text starts with /
  const trimmed = text.trim()
  const trimmedLower = trimmed.toLowerCase()
  if (trimmedLower.startsWith('/')) {
    // Parse command + optional args
    const parts = trimmed.slice(1).split(/\s+/) // remove / and split
    const commandName = parts[0]?.toLowerCase()
    const args = parts.slice(1).join(' ').trim()

    if (commandName) {
      const cmd = await db.botCommand.findUnique({
        where: { name: commandName },
      })

      if (cmd && cmd.enabled) {
        let responseText = ''
        let keyboard: MaxKeyboard | null = null

        if (cmd.type === 'function') {
          // Built-in handlers
          if (cmd.name === 'start' || cmd.name === 'menu') {
            responseText = await getSetting('welcomeMessage', 'Здравствуйте!')
            keyboard = await getCategoriesKeyboard()
          } else if (cmd.name === 'help') {
            responseText = await getSetting('helpMessage', 'Я могу помочь вам с вопросами по программе. Используйте кнопки навигации.')
            keyboard = await getCategoriesKeyboard()
          } else if (cmd.name === 'search') {
            // /search <text> — search FAQ
            if (!args) {
              responseText = '🔍 Использование: /search <текст запроса>\n\nПример: /search как зарегистрироваться'
              keyboard = getHomeKeyboard()
            } else {
              const results = await searchFaq(args)
              if (results.length === 0) {
                responseText = `🔎 По запросу «${args}» ничего не нашёл в базе знаний.\n\nПопробуйте переформулировать или используйте /menu для просмотра разделов.`
                keyboard = getHomeKeyboard()
              } else {
                responseText = `🔎 По запросу «${args}» нашёл ${results.length} ${results.length === 1 ? 'ответ' : results.length < 5 ? 'ответа' : 'ответов'}:\n\nВыберите подходящий:`
                keyboard = getFaqItemsKeyboard(
                  results.map((r) => ({ id: r.id, question: r.question, pinned: r.pinned })),
                )
              }
            }
          } else if (cmd.name === 'show') {
            // /show <faqId> — show specific FAQ
            if (!args) {
              responseText = '🔍 Использование: /show <id ответа>\n\nID можно посмотреть в карточке ответа через админ-панель или в команде /faq.'
              keyboard = getHomeKeyboard()
            } else {
              const item = await db.faqItem.findUnique({
                where: { id: args },
                include: { category: true },
              })
              if (!item || !item.published) {
                responseText = `❌ Ответ с ID «${args}» не найден.\n\nИспользуйте /menu для просмотра разделов или /search для поиска.`
                keyboard = getHomeKeyboard()
              } else {
                responseText = `❓ ${item.question}\n\n${item.answer}`
                keyboard = getAfterAnswerKeyboard(item.id, item.categoryId)
                await db.faqItem.update({
                  where: { id: item.id },
                  data: { viewCount: { increment: 1 } },
                })
              }
            }
          } else if (cmd.name === 'faq') {
            // /faq — list all FAQ items grouped by category
            const categories = await db.category.findMany({
              where: { published: true },
              orderBy: { order: 'asc' },
              include: {
                items: {
                  where: { published: true },
                  orderBy: { order: 'asc' },
                  select: { id: true, question: true },
                },
              },
            })
            const lines: string[] = ['📚 Полный список вопросов по программе:\n']
            for (const cat of categories) {
              lines.push(`\n■ ${cat.title}`)
              cat.items.forEach((item, i) => {
                lines.push(`${i + 1}. ${item.question}`)
                lines.push(`   → /show ${item.id}`)
              })
            }
            lines.push('\n\n🏠 Главное меню: /menu')
            responseText = lines.join('\n')
            keyboard = getHomeKeyboard()
          }
        } else if (cmd.type === 'text') {
          // Static text response from DB
          responseText = cmd.response ?? '(пустой ответ)'
          keyboard = getHomeKeyboard()
        } else if (cmd.type === 'faq') {
          // Show specific FAQ item
          if (cmd.faqId) {
            const item = await db.faqItem.findUnique({
              where: { id: cmd.faqId },
              include: { category: true },
            })
            if (item && item.published) {
              responseText = `❓ ${item.question}\n\n${item.answer}`
              keyboard = getAfterAnswerKeyboard(item.id, item.categoryId)
              await db.faqItem.update({
                where: { id: item.id },
                data: { viewCount: { increment: 1 } },
              })
            } else {
              responseText = 'Привязанный ответ не найден. Свяжитесь с администратором.'
              keyboard = getHomeKeyboard()
            }
          } else {
            responseText = cmd.response ?? cmd.description
            keyboard = getHomeKeyboard()
          }
        }

        const sendRes = await sendToMax(
          chat.chat_id,
          responseText,
          keyboard ?? undefined,
          cmd.format === 'html' ? 'html' : 'plain',
        )
        await logMessage({
          userDbId: dbUser.id,
          maxUserId: user.user_id,
          direction: 'out',
          messageType: 'text',
          text: responseText,
          payload: { keyboard: 'command', command: cmd.name, args },
          source: 'command',
          durationMs: Date.now() - t0,
          maxApiStatus: sendRes.status,
          maxApiError: sendRes.error,
        })
        await setUserState(user.user_id, null)
        return
      }

      // Command not found — show available commands
      const allCmds = await db.botCommand.findMany({
        where: { enabled: true },
        orderBy: { order: 'asc' },
        select: { name: true, description: true },
      })
      const lines: string[] = [`❓ Команда /${commandName} не найдена.\n\nДоступные команды:`]
      for (const c of allCmds) {
        lines.push(`/${c.name} — ${c.description}`)
      }
      const helpText = lines.join('\n')
      const sendRes = await sendToMax(chat.chat_id, helpText, getHomeKeyboard())
      await logMessage({
        userDbId: dbUser.id,
        maxUserId: user.user_id,
        direction: 'out',
        messageType: 'text',
        text: helpText,
        payload: { keyboard: 'help', unknownCommand: commandName },
        source: 'command',
        durationMs: Date.now() - t0,
        maxApiStatus: sendRes.status,
        maxApiError: sendRes.error,
      })
      await setUserState(user.user_id, null)
      return
    }
  }

  // Aliases without slash (старт/помощь)
  if (trimmedLower === 'start' || trimmedLower === 'старт') {
    const welcome = await getSetting('welcomeMessage', 'Здравствуйте!')
    const keyboard = await getCategoriesKeyboard()
    const sendRes = await sendToMax(chat.chat_id, welcome, keyboard)
    await logMessage({
      userDbId: dbUser.id,
      maxUserId: user.user_id,
      direction: 'out',
      messageType: 'text',
      text: welcome,
      payload: { keyboard: 'categories' },
      source: 'command',
      durationMs: Date.now() - t0,
      maxApiStatus: sendRes.status,
      maxApiError: sendRes.error,
    })
    await setUserState(user.user_id, null)
    return
  }

  if (trimmedLower === 'help' || trimmedLower === 'помощь') {
    const help = await getSetting('helpMessage', 'Используйте кнопки навигации.')
    const keyboard = await getCategoriesKeyboard()
    const sendRes = await sendToMax(chat.chat_id, help, keyboard)
    await logMessage({
      userDbId: dbUser.id,
      maxUserId: user.user_id,
      direction: 'out',
      messageType: 'text',
      text: help,
      payload: { keyboard: 'categories' },
      source: 'command',
      durationMs: Date.now() - t0,
      maxApiStatus: sendRes.status,
      maxApiError: sendRes.error,
    })
    await setUserState(user.user_id, null)
    return
  }

  // Run search (always — but always show "did you mean" links)
  const results = await searchFaq(text)
  if (results.length === 0) {
    // No FAQ match — try LLM if the query is programme-related
    const programmeRelated = isProgrammeRelated(text)
    const llmEnabledRow = await db.botSetting.findUnique({ where: { key: 'llmEnabled' } })
    const llmEnabled = llmEnabledRow?.value !== 'false' // default ON

    if (programmeRelated && llmEnabled) {
      const llmResult = await generateSmartReply(text)

      const keyboard = getHomeKeyboard()
      const sendRes = await sendToMax(chat.chat_id, llmResult.text, keyboard)

      await logMessage({
        userDbId: dbUser.id,
        maxUserId: user.user_id,
        direction: 'out',
        messageType: 'text',
        text: llmResult.text,
        payload: { llm: true, ok: llmResult.ok, sourceText: text },
        source: 'llm',
        durationMs: Date.now() - t0,
        llmOk: llmResult.ok,
        maxApiStatus: sendRes.status,
        maxApiError: sendRes.error,
        searchText: text,
      })
      await setUserState(user.user_id, null)
      return
    }

    // Either off-topic or LLM is disabled — show standard fallback
    const notFound = programmeRelated
      ? 'К сожалению, не нашёл точного ответа в базе знаний. 🤔\n\nПопробуйте:\n• Переформулировать вопрос\n• Воспользоваться кнопкой «🏠 Главное меню» для навигации по разделам\n• Связаться с федеральной командой через info@dobro.ru (тема «Обучение служением»)'
      : 'Я — бот-помощник по просветительской программе «Обучение служением. Первые» и могу отвечать только на вопросы, связанные с программой. 🎓\n\nЕсли у вас вопрос по программе — задайте его иначе или воспользуйтесь кнопкой «🏠 Главное меню».'

    const keyboard = getHomeKeyboard()
    const sendRes = await sendToMax(chat.chat_id, notFound, keyboard)

    await logMessage({
      userDbId: dbUser.id,
      maxUserId: user.user_id,
      direction: 'out',
      messageType: 'text',
      text: notFound,
      payload: { sourceText: text, offTopic: !programmeRelated },
      source: programmeRelated ? 'fallback' : 'off_topic',
      durationMs: Date.now() - t0,
      maxApiStatus: sendRes.status,
      maxApiError: sendRes.error,
      searchText: text,
    })
    await setUserState(user.user_id, null)
    return
  }

  const found = `🔎 По вашему запросу нашёл ${results.length} ${results.length === 1 ? 'ответ' : results.length < 5 ? 'ответа' : 'ответов'}:\n\nВыберите подходящий:`
  const keyboard = getFaqItemsKeyboard(
    results.map((r) => ({ id: r.id, question: r.question, pinned: r.pinned })),
  )
  const sendRes = await sendToMax(chat.chat_id, found, keyboard)

  await logMessage({
    userDbId: dbUser.id,
    maxUserId: user.user_id,
    direction: 'out',
    messageType: 'text',
    text: found,
    payload: { searchResults: results.map((r) => r.id), sourceText: text },
    source: 'search',
    durationMs: Date.now() - t0,
    maxApiStatus: sendRes.status,
    maxApiError: sendRes.error,
    searchText: text,
  })
  await setUserState(user.user_id, null)
}

// Main entry point — dispatch an update
export async function processMaxUpdate(update: MaxUpdate): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (update.update_type) {
      case 'bot_started':
        await handleBotStarted(update)
        return { ok: true }
      case 'message_callback':
        await handleCallback(update)
        return { ok: true }
      case 'message_created':
        await handleTextMessage(update)
        return { ok: true }
      // Other update types — log & ignore
      default:
        return { ok: true }
    }
  } catch (e) {
    console.error('processMaxUpdate error:', e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
