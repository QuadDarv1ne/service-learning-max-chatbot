// POST /api/commands/reorder — bulk update command order

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { order?: Array<{ id: string; order: number }> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.order || !Array.isArray(body.order)) {
    return NextResponse.json({ error: 'order_required' }, { status: 400 })
  }

  try {
    await db.$transaction(
      body.order.map((item) =>
        db.botCommand.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    )

    await logAdmin({
      action: 'command_update',
      detail: `Изменён порядок команд (${body.order.length} шт.)`,
    })

    return NextResponse.json({ ok: true, updated: body.order.length })
  } catch (e) {
    await logAdmin({
      action: 'command_update',
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: 'reorder_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
