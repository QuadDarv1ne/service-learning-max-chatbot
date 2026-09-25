// GET /api/faqs — list FAQs (optionally filtered by categoryId)
// POST /api/faqs — create new FAQ item

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('categoryId') || undefined
  const tagId = searchParams.get('tagId') || undefined

  // If filtering by tag, find FaqItems that have this tag
  let tagFaqIds: string[] | undefined
  if (tagId) {
    const tagFaqs = await db.faqTag.findMany({
      where: { tagId },
      select: { faqId: true },
    })
    tagFaqIds = tagFaqs.map((tf) => tf.faqId)
    if (tagFaqIds.length === 0) {
      return NextResponse.json({ faqs: [] })
    }
  }

  const items = await db.faqItem.findMany({
    where: {
      ...(categoryId ? { categoryId } : {}),
      ...(tagFaqIds ? { id: { in: tagFaqIds } } : {}),
    },
    orderBy: [{ pinned: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
    include: {
      category: { select: { id: true, title: true } },
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
    },
  })

  return NextResponse.json({
    faqs: items.map((item) => ({
      ...item,
      tags: item.tags.map((ft) => ft.tag),
    })),
  })
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: {
    categoryId?: string
    question?: string
    answer?: string
    keywords?: string
    published?: boolean
    pinned?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.categoryId || !body.question || !body.answer) {
    return NextResponse.json(
      { error: 'categoryId_question_and_answer_required' },
      { status: 400 },
    )
  }

  const maxOrder = await db.faqItem.aggregate({
    _max: { order: true },
    where: { categoryId: body.categoryId },
  })
  const order = (maxOrder._max.order ?? -1) + 1

  try {
    const item = await db.faqItem.create({
      data: {
        categoryId: body.categoryId,
        question: body.question,
        answer: body.answer,
        keywords: body.keywords ?? '',
        published: body.published ?? true,
        pinned: body.pinned ?? false,
        order,
      },
    })
    await logAdmin({
      action: 'faq_create',
      resource: item.id,
      detail: `Создан ответ: ${item.question.slice(0, 60)}`,
    })
    return NextResponse.json({ faq: item })
  } catch (e) {
    await logAdmin({
      action: 'faq_create',
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: 'create_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
