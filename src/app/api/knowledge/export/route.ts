// GET /api/knowledge/export — full knowledge base backup as JSON
// Includes all categories + all FAQ items + bot settings (without secrets)

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const categories = await db.category.findMany({
    orderBy: { order: 'asc' },
    include: {
      items: { orderBy: { order: 'asc' } },
    },
  })

  const settings = await db.botSetting.findMany({
    where: { key: { notIn: ['botToken', 'webhookUrl'] } },
  })

  const backup = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    programme: 'Обучение служением. Первые',
    categories: categories.map((c) => ({
      title: c.title,
      slug: c.slug,
      description: c.description,
      order: c.order,
      published: c.published,
      items: c.items.map((i) => ({
        question: i.question,
        answer: i.answer,
        keywords: i.keywords,
        order: i.order,
        published: i.published,
      })),
    })),
    settings: settings.reduce<Record<string, string>>((acc, s) => {
      acc[s.key] = s.value ?? ''
      return acc
    }, {}),
  }

  const json = JSON.stringify(backup, null, 2)
  const filename = `max-bot-knowledge-${new Date().toISOString().slice(0, 10)}.json`

  await logAdmin({
    action: 'knowledge_export',
    detail: `Экспорт базы знаний: ${categories.length} категорий`,
  })

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
