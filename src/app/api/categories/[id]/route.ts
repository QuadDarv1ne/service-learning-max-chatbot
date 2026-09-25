// /api/categories/[id]
// GET — fetch single category
// PUT — update
// DELETE — delete (cascade to FaqItem)

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const cat = await db.category.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!cat) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ category: cat })
}

export async function PUT(req: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  let body: {
    title?: string
    slug?: string
    description?: string
    published?: boolean
    order?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  try {
    const updated = await db.category.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.published !== undefined ? { published: body.published } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
      },
    })
    await logAdmin({
      action: 'category_update',
      resource: id,
      detail: `Обновлена категория «${updated.title}»`,
    })
    return NextResponse.json({ category: updated })
  } catch (e) {
    await logAdmin({
      action: 'category_update',
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
    // Capture name before deletion for the audit log
    const existing = await db.category.findUnique({ where: { id }, select: { title: true } })
    await db.category.delete({ where: { id } })
    await logAdmin({
      action: 'category_delete',
      resource: id,
      detail: `Удалена категория «${existing?.title ?? id}»`,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    await logAdmin({
      action: 'category_delete',
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
