// GET /api/broadcasts — list all broadcasts
// POST /api/broadcasts — create new broadcast

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const broadcasts = await db.broadcast.findMany({
    orderBy: { scheduledAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ broadcasts })
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { text?: string; scheduledAt?: string; format?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.text || !body.text.trim()) {
    return NextResponse.json({ error: 'text_required' }, { status: 400 })
  }

  if (!body.scheduledAt) {
    return NextResponse.json({ error: 'scheduledAt_required' }, { status: 400 })
  }

  const scheduledAt = new Date(body.scheduledAt)
  if (isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 })
  }

  // Don't allow scheduling in the past
  if (scheduledAt < new Date()) {
    return NextResponse.json({ error: 'date_in_past' }, { status: 400 })
  }

  const format = body.format === 'html' ? 'html' : 'plain'

  try {
    const broadcast = await db.broadcast.create({
      data: {
        text: body.text.trim(),
        format,
        scheduledAt,
        status: 'scheduled',
        targetAll: true,
      },
    })
    await logAdmin({
      action: 'broadcast_create',
      resource: broadcast.id,
      detail: `Создана рассылка на ${scheduledAt.toLocaleString('ru-RU')}: ${body.text.slice(0, 60)}`,
    })
    return NextResponse.json({ broadcast })
  } catch (e) {
    await logAdmin({
      action: 'broadcast_create',
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: 'create_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
