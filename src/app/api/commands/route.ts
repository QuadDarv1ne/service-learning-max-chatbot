// GET /api/commands — list all bot commands
// POST /api/commands — create new command

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const commands = await db.botCommand.findMany({
    orderBy: { order: 'asc' },
  })

  // For type='faq' commands — fetch linked FAQ questions
  const faqIds = commands.map((c) => c.faqId).filter(Boolean) as string[]
  const faqs =
    faqIds.length > 0
      ? await db.faqItem.findMany({
          where: { id: { in: faqIds } },
          select: { id: true, question: true },
        })
      : []
  const faqMap = new Map(faqs.map((f) => [f.id, f.question]))

  return NextResponse.json({
    commands: commands.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      type: c.type,
      response: c.response,
      faqId: c.faqId,
      faqQuestion: c.faqId ? faqMap.get(c.faqId) ?? null : null,
      enabled: c.enabled,
      order: c.order,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  })
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: {
    name?: string
    description?: string
    type?: string
    response?: string
    faqId?: string
    enabled?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.name || !body.description || !body.type) {
    return NextResponse.json(
      { error: 'name_description_and_type_required' },
      { status: 400 },
    )
  }

  // Normalize name — strip leading / if provided
  const normalizedName = body.name.replace(/^\//, '').trim().toLowerCase()
  if (!/^[a-z0-9_-]+$/.test(normalizedName)) {
    return NextResponse.json(
      { error: 'name_invalid', detail: 'Только латиница, цифры, _ и -' },
      { status: 400 },
    )
  }

  if (!['text', 'faq', 'function'].includes(body.type)) {
    return NextResponse.json(
      { error: 'type_invalid', detail: 'Допустимо: text, faq, function' },
      { status: 400 },
    )
  }

  const maxOrder = await db.botCommand.aggregate({ _max: { order: true } })
  const order = (maxOrder._max.order ?? -1) + 1

  try {
    const cmd = await db.botCommand.create({
      data: {
        name: normalizedName,
        description: body.description,
        type: body.type,
        response: body.response ?? null,
        faqId: body.faqId ?? null,
        enabled: body.enabled ?? true,
        order,
      },
    })
    await logAdmin({
      action: 'command_create',
      resource: cmd.id,
      detail: `Создана команда /${cmd.name}`,
    })
    return NextResponse.json({ command: cmd })
  } catch (e) {
    await logAdmin({
      action: 'command_create',
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: 'create_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
