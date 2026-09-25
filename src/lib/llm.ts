// LLM helper — generates context-aware responses when FAQ search returns nothing.
// Uses z-ai-web-dev-sdk (backend only).
//
// Strategy:
// - System prompt constrains LLM to answer only based on the programme's knowledge base
// - We pass all FAQ Q&A pairs as context
// - LLM is told to never invent information outside this base
// - When it can't answer, it politely redirects to a human support channel

import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

type FaqContext = {
  question: string
  answer: string
  categoryTitle: string
}

async function loadFaqContext(): Promise<FaqContext[]> {
  const items = await db.faqItem.findMany({
    where: { published: true },
    include: { category: { select: { title: true } } },
    orderBy: { order: 'asc' },
  })
  return items.map((i) => ({
    question: i.question,
    answer: i.answer,
    categoryTitle: i.category.title,
  }))
}

function buildSystemPrompt(faqContext: FaqContext[]): string {
  const knowledgeBase = faqContext
    .map((f, idx) => `Q${idx + 1} [${f.categoryTitle}]: ${f.question}\nA: ${f.answer}`)
    .join('\n\n---\n\n')

  return `Ты — бот-помощник просветительской программы «Обучение служением. Первые» (организатор — Ассоциация Добро.рф). Отвечай на русском языке, дружелюбно и по делу.

Твоя задача — помочь педагогам, представителям образовательных организаций и региональных команд найти ответы на типовые вопросы по программе.

НИЖЕ ПРИВЕДЕНА БАЗА ЗНАНИЙ — это твой единственный источник информации. Отвечай ТОЛЬКО на основе этой базы. Не выдумывай факты, даты, имена, контакты или процедуры, которых нет в базе.

Если вопрос касается программы, но в базе нет точного ответа:
- Кратко скажи, что точного ответа в базе нет
- Предложи обратиться в федеральную команду: info@dobro.ru (тема «Обучение служением»)
- Или посоветуй воспользоваться кнопкой «🏠 Главное меню» для просмотра разделов

Если вопрос вообще не связан с программой — мягко объясни, что ты помогаешь только по программе «Обучение служением. Первые».

Если вопрос сформулирован размыто — задай уточняющий вопрос.

Длина ответа — 2-5 предложений. Не используй emoji чаще одного раза. Не дублируй полный текст базы, переформулируй кратко.

=== БАЗА ЗНАНИЙ ===
${knowledgeBase}
=== КОНЕЦ БАЗЫ ===`
}

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export async function generateSmartReply(userQuery: string): Promise<{ text: string; source: 'llm'; ok: boolean }> {
  try {
    const faqContext = await loadFaqContext()

    if (faqContext.length === 0) {
      return {
        text: 'К сожалению, база знаний пока пуста. Обратитесь к федеральной команде программы через info@dobro.ru.',
        source: 'llm',
        ok: false,
      }
    }

    const zai = await getZai()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: buildSystemPrompt(faqContext) },
        { role: 'user', content: userQuery },
      ],
      thinking: { type: 'disabled' },
    })

    const text = completion.choices?.[0]?.message?.content?.trim()
    if (!text) {
      return {
        text: 'Не удалось сформировать ответ. Попробуйте переформулировать вопрос или воспользуйтесь кнопкой «🏠 Главное меню».',
        source: 'llm',
        ok: false,
      }
    }

    // Append a small footer with options
    const footer = '\n\n— — —\n🏠 Главное меню · ✉️ info@dobro.ru'
    return { text: text + footer, source: 'llm', ok: true }
  } catch (e) {
    console.error('LLM error:', e)
    return {
      text: 'К сожалению, не удалось обработать запрос. Попробуйте переформулировать или воспользуйтесь кнопкой «🏠 Главное меню» для навигации по разделам.',
      source: 'llm',
      ok: false,
    }
  }
}

// Helper: detect whether the user query is "off-topic" relative to programme keywords.
// Uses a two-tier system:
//   - STRONG terms are unique to the programme — any one match is enough.
//   - WEAK terms are common educational/social words — need at least 2 matches
//     (otherwise a random query like "проект" alone wouldn't qualify).
const STRONG_TERMS = [
  'служени', // core programme name
  'добро.рф', 'dobro.ru', 'dobro_rf',
  'обучение служением', // full phrase
  'программа первые', // full programme name fragment
  'просветительск', // programme type
  'росмолодёж', 'росмолодеж',
  'ассоциац', // Ассоциация Добро.рф
]

const WEAK_TERMS = [
  'педагог', 'наставник', 'рефлекс', 'каталог', 'добровол', 'волонтёр', 'волонтер',
  'согласие', 'регистрац', 'заявка', 'социальн', 'просвещен',
  'школ', 'вуз', 'колледж', 'студент', 'обучающ', 'региональн',
  'федеральн', 'отчёт', 'отчет', 'документ', 'методич',
  'chat-bot', 'чат-бот', 'max', 'мессенджер', 'платформ',
  'наставник.рф', 'добрино', 'dobro.center', 'добро.центр',
]

export function isProgrammeRelated(query: string): boolean {
  const q = query.toLowerCase()

  // Any strong term — definitely on-topic
  if (STRONG_TERMS.some((term) => q.includes(term))) return true

  // Need at least 2 weak terms to be considered on-topic
  const weakMatches = WEAK_TERMS.filter((term) => q.includes(term)).length
  return weakMatches >= 2
}
