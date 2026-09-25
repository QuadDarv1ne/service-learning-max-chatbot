// POST /api/knowledge/import — restore knowledge base from JSON backup
// Body: the JSON object previously exported

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

type BackupItem = {
  question: string
  answer: string
  keywords?: string | null
  order?: number
  published?: boolean
}

type BackupCategory = {
  title: string
  slug: string
  description?: string | null
  order?: number
  published?: boolean
  items: BackupItem[]
}

type BackupPayload = {
  version?: string
  categories: BackupCategory[]
  settings?: Record<string, string>
}

const ALLOWED_SETTING_KEYS = ['welcomeMessage', 'helpMessage', 'llmEnabled']

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: BackupPayload
  try {
    body = (await req.json()) as BackupPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.categories || !Array.isArray(body.categories)) {
    return NextResponse.json({ error: 'invalid_format' }, { status: 400 })
  }

  // Use a transaction so we don't end up in a half-imported state on failure
  try {
    await db.$transaction(async (tx) => {
      // Wipe existing categories (cascades to FaqItem)
      await tx.faqItem.deleteMany()
      await tx.category.deleteMany()

      // Re-import categories + items
      for (const [catIndex, cat] of body.categories.entries()) {
        if (!cat.title || !cat.slug) {
          throw new Error(`Category #${catIndex + 1} missing title or slug`)
        }
        const createdCat = await tx.category.create({
          data: {
            title: cat.title,
            slug: cat.slug,
            description: cat.description ?? '',
            order: cat.order ?? catIndex,
            published: cat.published ?? true,
          },
        })

        for (const [itemIndex, item] of (cat.items ?? []).entries()) {
          if (!item.question || !item.answer) {
            throw new Error(
              `Category "${cat.title}" item #${itemIndex + 1} missing question or answer`,
            )
          }
          await tx.faqItem.create({
            data: {
              categoryId: createdCat.id,
              question: item.question,
              answer: item.answer,
              keywords: item.keywords ?? '',
              order: item.order ?? itemIndex,
              published: item.published ?? true,
            },
          })
        }
      }

      // Optional settings override (no secrets)
      if (body.settings) {
        for (const key of ALLOWED_SETTING_KEYS) {
          const value = body.settings[key]
          if (typeof value === 'string') {
            await tx.botSetting.upsert({
              where: { key },
              update: { value },
              create: { key, value },
            })
          }
        }
      }
    })

    const categoriesCount = body.categories.length
    const itemsCount = body.categories.reduce((s, c) => s + (c.items?.length ?? 0), 0)
    await logAdmin({
      action: 'knowledge_import',
      detail: `Импорт базы знаний: ${categoriesCount} категорий, ${itemsCount} ответов`,
    })
    return NextResponse.json({
      ok: true,
      imported: { categories: categoriesCount, items: itemsCount },
    })
  } catch (e) {
    await logAdmin({
      action: 'knowledge_import',
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      {
        error: 'import_failed',
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    )
  }
}
