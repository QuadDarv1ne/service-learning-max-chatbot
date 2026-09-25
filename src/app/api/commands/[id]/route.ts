// /api/commands/[id]
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
  const cmd = await db.botCommand.findUnique({ where: { id } })
  if (!cmd) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ command: cmd })
}

export async function PUT(req: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  let body: Partial<{
    name: string
    description: string
    type: string
    response: string | null
    faqId: string | null
    enabled: boolean
    order: number
  }>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Normalize name if provided
  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const n = body.name.replace(/^\//, '').trim().toLowerCase()
    if (!/^[a-z0-9_-]+$/.test(n)) {
      return NextResponse.json(
        { error: 'name_invalid', detail: 'Только латиница, цифры, _ и -' },
        { status: 400 },
      )
    }
    updateData.name = n
  }
  if (body.description !== undefined) updateData.description = body.description
  if (body.type !== undefined) {
    if (!['text', 'faq', 'function'].includes(body.type)) {
      return NextResponse.json({ error: 'type_invalid' }, { status: 400 })
    }
    updateData.type = body.type
  }
  if (body.response !== undefined) updateData.response = body.response
  if (body.faqId !== undefined) updateData.faqId = body.faqId || null
  if (body.enabled !== undefined) updateData.enabled = body.enabled
  if (body.order !== undefined) updateData.order = body.order

  try {
    const before = await db.botCommand.findUnique({ where: { id }, select: { name: true } })
    const updated = await db.botCommand.update({ where: { id }, data: updateData })
    await logAdmin({
      action: 'command_update',
      resource: id,
      detail: `Обновлена команда /${updated.name} (было: /${before?.name ?? id})`,
    })
    return NextResponse.json({ command: updated })
  } catch (e) {
    await logAdmin({
      action: 'command_update',
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
    const existing = await db.botCommand.findUnique({ where: { id }, select: { name: true } })
    await db.botCommand.delete({ where: { id } })
    await logAdmin({
      action: 'command_delete',
      resource: id,
      detail: `Удалена команда /${existing?.name ?? id}`,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    await logAdmin({
      action: 'command_delete',
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
