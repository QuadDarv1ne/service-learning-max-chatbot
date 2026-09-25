// POST /api/max/register-commands — register bot commands (start, help)
// so they appear in the MAX command autocomplete

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { maxApi } from '@/lib/max-api'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const tokenRow = await db.botSetting.findUnique({ where: { key: 'botToken' } })
  if (!tokenRow?.value) {
    return NextResponse.json({ error: 'botToken_not_set' }, { status: 400 })
  }

  const res = await maxApi.setMyCommands([
    { name: 'start', description: 'Запустить бота — главное меню' },
    { name: 'help', description: 'Справка по работе с ботом' },
  ])

  if (!res.ok) {
    await logAdmin({
      action: 'commands_register',
      ok: false,
      error: res.error ?? 'unknown',
    })
    return NextResponse.json(
      { ok: false, error: res.error, status: res.status },
      { status: 502 },
    )
  }

  await logAdmin({
    action: 'commands_register',
    detail: 'Команды /start, /help зарегистрированы в MAX',
  })
  return NextResponse.json({ ok: true })
}
