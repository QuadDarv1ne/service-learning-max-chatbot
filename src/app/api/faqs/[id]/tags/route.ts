// POST /api/faqs/[id]/tags — assign tags to FAQ (body: { tagIds: string[] })
// DELETE /api/faqs/[id]/tags — remove all tags from FAQ
// GET /api/faqs/[id]/tags — list tags assigned to FAQ

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const tags = await db.faqTag.findMany({
    where: { faqId: id },
    include: { tag: true },
  })
  return NextResponse.json({ tags: tags.map((ft) => ft.tag) })
}

export async function POST(req: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  let body: { tagIds?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.tagIds || !Array.isArray(body.tagIds)) {
    return NextResponse.json({ error: 'tagIds_required' }, { status: 400 })
  }

  try {
    // Remove existing tags, then add new ones (replace strategy)
    await db.faqTag.deleteMany({ where: { faqId: id } })

    if (body.tagIds.length > 0) {
      await db.faqTag.createMany({
        data: body.tagIds.map((tagId) => ({ faqId: id, tagId })),
      })
    }

    const faq = await db.faqItem.findUnique({ where: { id }, select: { question: true } })
    await logAdmin({
      action: 'faq_update',
      resource: id,
      detail: `Теги обновлены для: ${faq?.question?.slice(0, 60) ?? id} (${body.tagIds.length} тегов)`,
    })

    return NextResponse.json({ ok: true, assigned: body.tagIds.length })
  } catch (e) {
    await logAdmin({
      action: 'faq_update',
      resource: id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: 'assign_failed', detail: e instanceof Error ? e.message : String(e) },
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
    await db.faqTag.deleteMany({ where: { faqId: id } })
    await logAdmin({
      action: 'faq_update',
      resource: id,
      detail: 'Все теги сняты с ответа',
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: 'delete_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
