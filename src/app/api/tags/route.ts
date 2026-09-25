// GET /api/tags — list all tags
// POST /api/tags — create new tag

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

const VALID_COLORS = ['blue', 'red', 'green', 'amber', 'violet', 'cyan', 'indigo', 'sky', 'teal', 'rose']

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const tags = await db.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { faqs: true } } },
  })

  return NextResponse.json({
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      color: t.color,
      faqCount: t._count.faqs,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  })
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { name?: string; color?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 })
  }

  const name = body.name.trim()
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/giu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || `tag-${Date.now()}`

  const color = VALID_COLORS.includes(body.color || '') ? body.color! : 'blue'

  try {
    const tag = await db.tag.create({
      data: { name, slug, color },
    })
    await logAdmin({
      action: 'tag_create',
      resource: tag.id,
      detail: `Создан тег "${tag.name}"`,
    })
    return NextResponse.json({ tag })
  } catch (e) {
    await logAdmin({
      action: 'tag_create',
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: 'create_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
