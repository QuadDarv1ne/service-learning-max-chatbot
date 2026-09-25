// GET /api/categories — list all categories with item counts
// POST /api/categories — create new category

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function GET() {
  const categories = await db.category.findMany({
    orderBy: { order: 'asc' },
    include: {
      _count: { select: { items: true } },
    },
  })

  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      order: c.order,
      published: c.published,
      itemCount: c._count.items,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  })
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { title?: string; slug?: string; description?: string; published?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.title || !body.slug) {
    return NextResponse.json({ error: 'title_and_slug_required' }, { status: 400 })
  }

  const maxOrder = await db.category.aggregate({ _max: { order: true } })
  const order = (maxOrder._max.order ?? -1) + 1

  try {
    const cat = await db.category.create({
      data: {
        title: body.title,
        slug: body.slug,
        description: body.description ?? '',
        published: body.published ?? true,
        order,
      },
    })
    await logAdmin({
      action: 'category_create',
      resource: cat.id,
      detail: `Создана категория "${cat.title}"`,
    })
    return NextResponse.json({ category: cat })
  } catch (e) {
    await logAdmin({
      action: 'category_create',
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: 'create_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
