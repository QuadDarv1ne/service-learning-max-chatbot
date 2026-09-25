// /api/faqs/[id]
// GET, PUT, DELETE

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const item = await db.faqItem.findUnique({
    where: { id },
    include: { category: { select: { id: true, title: true } } },
  })

  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ faq: item })
}

export async function PUT(req: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  let body: {
    categoryId?: string
    question?: string
    answer?: string
    keywords?: string
    published?: boolean
    pinned?: boolean
    order?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  try {
    const updated = await db.faqItem.update({
      where: { id },
      data: {
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.question !== undefined ? { question: body.question } : {}),
        ...(body.answer !== undefined ? { answer: body.answer } : {}),
        ...(body.keywords !== undefined ? { keywords: body.keywords } : {}),
        ...(body.published !== undefined ? { published: body.published } : {}),
        ...(body.pinned !== undefined ? { pinned: body.pinned } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
      },
    })
    await logAdmin({
      action: 'faq_update',
      resource: id,
      detail: `Обновлён ответ: ${updated.question.slice(0, 60)}`,
    })
    return NextResponse.json({ faq: updated })
  } catch (e) {
    await logAdmin({
      action: 'faq_update',
      resource: id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: 'update_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  try {
    const existing = await db.faqItem.findUnique({ where: { id }, select: { question: true } })
    await db.faqItem.delete({ where: { id } })
    await logAdmin({
      action: 'faq_delete',
      resource: id,
      detail: `Удалён ответ: ${existing?.question?.slice(0, 60) ?? id}`,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    await logAdmin({
      action: 'faq_delete',
      resource: id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: 'delete_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
