// GET /api/settings — public-safe settings (no secrets)
// PUT /api/settings — update settings (auth required)
//
// Settings keys:
//   botToken — MAX Bot API token (secret)
//   webhookUrl — public URL for webhook
//   webhookSubscribed — boolean flag
//   welcomeMessage — text shown on /start
//   helpMessage — text shown on /help

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

const PUBLIC_KEYS = ['welcomeMessage', 'helpMessage', 'webhookUrl', 'webhookSubscribed']
const ALL_KEYS = [...PUBLIC_KEYS, 'botToken', 'llmEnabled']

export async function GET() {
  const isAuthed = await isAuthenticated()
  const keys = isAuthed ? ALL_KEYS : PUBLIC_KEYS

  const rows = await db.botSetting.findMany({ where: { key: { in: keys } } })

  // Mask token if shown to authed users — still allow editing
  const settings: Record<string, string> = {}
  for (const r of rows) {
    if (r.key === 'botToken' && r.value) {
      // Show partial — last 4 chars only
      const v = r.value
      settings[r.key] = v.length > 8 ? '•'.repeat(Math.min(v.length - 4, 32)) + v.slice(-4) : v
    } else {
      settings[r.key] = r.value ?? ''
    }
  }

  return NextResponse.json({ settings, authenticated: isAuthed })
}

export async function PUT(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Only allow known keys
  const updates = Object.entries(body).filter(([k, v]) => ALL_KEYS.includes(k) && typeof v === 'string')

  // Track which keys were actually changed for the audit log
  const changedKeys: string[] = []

  for (const [key, value] of updates) {
    // Skip token if it's just masked placeholder
    if (key === 'botToken' && value.includes('•')) continue
    // llmEnabled should be 'true'/'false' as string
    if (key === 'llmEnabled' && value !== 'true' && value !== 'false') continue

    const before = await db.botSetting.findUnique({ where: { key } })
    // Skip if value didn't actually change
    if (before?.value === value) continue

    await db.botSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })

    changedKeys.push(key)
    // Special audit entry for sensitive settings
    if (key === 'botToken') {
      await logAdmin({
        action: 'bot_token_set',
        detail: 'Обновлён токен бота MAX',
      })
    }
  }

  if (changedKeys.length > 0) {
    const nonTokenKeys = changedKeys.filter((k) => k !== 'botToken')
    if (nonTokenKeys.length > 0) {
      await logAdmin({
        action: 'settings_update',
        detail: `Обновлены настройки: ${nonTokenKeys.join(', ')}`,
      })
    }
  }

  // Re-read and return
  const rows = await db.botSetting.findMany({ where: { key: { in: ALL_KEYS } } })
  const settings: Record<string, string> = {}
  for (const r of rows) {
    if (r.key === 'botToken' && r.value) {
      const v = r.value
      settings[r.key] = v.length > 8 ? '•'.repeat(Math.min(v.length - 4, 32)) + v.slice(-4) : v
    } else {
      settings[r.key] = r.value ?? ''
    }
  }

  return NextResponse.json({ settings })
}
