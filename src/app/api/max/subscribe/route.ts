// POST /api/max/subscribe — subscribe webhook to MAX Bot API
// GET  /api/max/subscribe — list current subscriptions

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { maxApi } from '@/lib/max-api'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

// Default list of update types to subscribe
const DEFAULT_UPDATES = [
  'message_created',
  'message_callback',
  'bot_started',
  'bot_added',
  'bot_removed',
  'message_edited',
  'message_removed',
]

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const res = await maxApi.getSubscriptions()
  return NextResponse.json(res)
}

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const webhookRow = await db.botSetting.findUnique({ where: { key: 'webhookUrl' } })
  const webhookUrl = webhookRow?.value

  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'webhookUrl_not_set', detail: 'Set webhookUrl in settings first' },
      { status: 400 },
    )
  }

  const tokenRow = await db.botSetting.findUnique({ where: { key: 'botToken' } })
  const token = tokenRow?.value
  if (!token) {
    return NextResponse.json(
      { error: 'botToken_not_set', detail: 'Set botToken in settings first' },
      { status: 400 },
    )
  }

  const res = await maxApi.subscribeWebhook({
    url: webhookUrl,
    updates: DEFAULT_UPDATES,
  })

  if (res.ok) {
    await db.botSetting.upsert({
      where: { key: 'webhookSubscribed' },
      update: { value: 'true' },
      create: { key: 'webhookSubscribed', value: 'true' },
    })
    await logAdmin({
      action: 'webhook_subscribe',
      resource: webhookUrl,
      detail: `Подписка на webhook: ${webhookUrl}`,
    })
    return NextResponse.json({ ok: true, subscription: res.data })
  }

  await logAdmin({
    action: 'webhook_subscribe',
    resource: webhookUrl,
    ok: false,
    error: res.error ?? 'unknown',
  })
  return NextResponse.json({ ok: false, error: res.error, status: res.status }, { status: 500 })
}
