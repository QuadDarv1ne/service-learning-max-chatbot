// /api/tags/[id]
// GET, PUT, DELETE

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
  const tag = await db.tag.findUnique({
    where: { id },
    include: { faqs: { include: { faq: { select: { id: true, question: true } } } } },
  })
  if (!tag) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ tag })
}

export async function PUT(req: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  let body: { name?: string; color?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const data: Record<string, string> = {}
  if (body.name) {
    data.name = body.name.trim()
    data.slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s-]/giu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
  }
  if (body.color && ['blue', 'red', 'green', 'amber', 'violet', 'cyan', 'indigo', 'sky', 'teal', 'rose'].includes(body.color)) {
    data.color = body.color
  }

  try {
    const updated = await db.tag.update({ where: { id }, data })
    await logAdmin({
      action: 'tag_update',
      resource: id,
      detail: `Обновлён тег "${updated.name}"`,
    })
    return NextResponse.json({ tag: updated })
  } catch (e) {
    await logAdmin({
      action: 'tag_update',
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
    const existing = await db.tag.findUnique({ where: { id }, select: { name: true } })
    await db.tag.delete({ where: { id } })
    await logAdmin({
      action: 'tag_delete',
      resource: id,
      detail: `Удалён тег "${existing?.name ?? id}"`,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    await logAdmin({
      action: 'tag_delete',
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
