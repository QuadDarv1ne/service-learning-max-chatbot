// POST /api/max/test-send — send a test message to a user by maxUserId
// Body: { maxUserId: number, text: string }

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { maxApi } from '@/lib/max-api'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { maxUserId?: number; text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.maxUserId || !body.text) {
    return NextResponse.json({ error: 'maxUserId_and_text_required' }, { status: 400 })
  }

  const res = await maxApi.sendMessage({
    chat_id: body.maxUserId,
    text: body.text,
  })

  if (!res.ok) {
    await logAdmin({
      action: 'test_send',
      resource: String(body.maxUserId),
      ok: false,
      error: res.error ?? 'unknown',
    })
    return NextResponse.json({ ok: false, error: res.error, status: res.status }, { status: 502 })
  }

  // Log this outgoing message
  const user = await db.maxUser.findUnique({ where: { maxUserId: body.maxUserId } })
  if (user) {
    await db.messageLog.create({
      data: {
        userId: user.id,
        maxUserId: body.maxUserId,
        direction: 'out',
        messageType: 'system',
        text: body.text,
        payload: JSON.stringify({ source: 'admin_test' }),
        source: 'system',
        maxApiStatus: res.status,
      },
    })
  }

  await logAdmin({
    action: 'test_send',
    resource: String(body.maxUserId),
    detail: `Тестовая отправка пользователю ${body.maxUserId}: ${body.text.slice(0, 50)}`,
  })
  return NextResponse.json({ ok: true, result: res.data })
}
