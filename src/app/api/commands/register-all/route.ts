// POST /api/commands/register-all — register all enabled commands in MAX via PATCH /me

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

  // Get all enabled commands
  const commands = await db.botCommand.findMany({
    where: { enabled: true },
    orderBy: { order: 'asc' },
    select: { name: true, description: true },
  })

  if (commands.length === 0) {
    return NextResponse.json({ error: 'no_commands' }, { status: 400 })
  }

  // MAX accepts commands in format { name, description }
  const res = await maxApi.setMyCommands(
    commands.map((c) => ({ name: c.name, description: c.description })),
  )

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
    detail: `Зарегистрировано команд в MAX: ${commands.length}`,
  })

  return NextResponse.json({
    ok: true,
    registered: commands.length,
    commands: commands.map((c) => c.name),
  })
}
