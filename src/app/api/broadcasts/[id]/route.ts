// /api/broadcasts/[id]
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
  const broadcast = await db.broadcast.findUnique({ where: { id } })
  if (!broadcast) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ broadcast })
}

export async function PUT(req: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  let body: { text?: string; scheduledAt?: string; format?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Only allow updates if still scheduled
  const existing = await db.broadcast.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (existing.status === 'sent' || existing.status === 'sending') {
    return NextResponse.json({ error: 'already_sent' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.text !== undefined) data.text = body.text
  if (body.format !== undefined) data.format = body.format === 'html' ? 'html' : 'plain'
  if (body.scheduledAt !== undefined) {
    const dt = new Date(body.scheduledAt)
    if (!isNaN(dt.getTime())) data.scheduledAt = dt
  }
  if (body.status !== undefined && body.status === 'cancelled') {
    data.status = 'cancelled'
  }

  try {
    const updated = await db.broadcast.update({ where: { id }, data })
    await logAdmin({
      action: 'broadcast_update',
      resource: id,
      detail: body.status === 'cancelled' ? 'Рассылка отменена' : 'Рассылка обновлена',
    })
    return NextResponse.json({ broadcast: updated })
  } catch (e) {
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
    const existing = await db.broadcast.findUnique({ where: { id } })
    if (existing && (existing.status === 'sent' || existing.status === 'sending')) {
      return NextResponse.json({ error: 'already_sent' }, { status: 400 })
    }
    await db.broadcast.delete({ where: { id } })
    await logAdmin({
      action: 'broadcast_delete',
      resource: id,
      detail: 'Рассылка удалена',
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: 'delete_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
