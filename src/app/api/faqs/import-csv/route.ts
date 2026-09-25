// POST /api/faqs/import-csv — bulk import FAQs from CSV
// CSV columns required: category_slug, question, answer
// Optional: keywords, published (true/false, default true)
//
// Returns: { ok: true, imported: N, skipped: M, errors: [...] }

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

type ImportRow = {
  category_slug?: string
  question?: string
  answer?: string
  keywords?: string
  published?: string
}

type ParseResult = {
  rows: ImportRow[]
  errors: string[]
}

function parseCsv(text: string): ParseResult {
  const errors: string[] = []
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) {
    return { rows: [], errors: ['Файл пуст'] }
  }

  // Parse header — supports "category_slug,question,answer,keywords,published"
  // or "Категория (slug),Вопрос,Ответ,Ключевые слова,Опубликовано"
  const headerLine = lines[0]
  const headers = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase())

  // Map headers
  const colMap: Record<string, number> = {}
  headers.forEach((h, i) => {
    if (h === 'category_slug' || h === 'категория (slug)' || h === 'категория_slug' || h === 'slug' || h === 'категория') {
      colMap.category_slug = i
    } else if (h === 'question' || h === 'вопрос') {
      colMap.question = i
    } else if (h === 'answer' || h === 'ответ') {
      colMap.answer = i
    } else if (h === 'keywords' || h === 'ключевые слова') {
      colMap.keywords = i
    } else if (h === 'published' || h === 'опубликовано') {
      colMap.published = i
    }
  })

  if (colMap.category_slug === undefined || colMap.question === undefined || colMap.answer === undefined) {
    errors.push(
      'Заголовок должен содержать: category_slug (или "Категория (slug)"), question (или "Вопрос"), answer (или "Ответ"). ' +
        'Опционально: keywords, published.',
    )
    return { rows: [], errors }
  }

  const rows: ImportRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    rows.push({
      category_slug: cells[colMap.category_slug]?.trim(),
      question: cells[colMap.question]?.trim(),
      answer: cells[colMap.answer]?.trim(),
      keywords: colMap.keywords !== undefined ? cells[colMap.keywords]?.trim() : '',
      published: colMap.published !== undefined ? cells[colMap.published]?.trim() : 'true',
    })
  }

  return { rows, errors }
}

// Simple CSV line parser — handles quoted fields with commas and escaped quotes
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const contentType = req.headers.get('content-type') || ''
  let csvText: string

  if (contentType.includes('multipart/form-data') || contentType.startsWith('text/')) {
    csvText = await req.text()
  } else {
    try {
      const body = await req.json()
      csvText = body.csv as string
    } catch {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
    }
  }

  if (!csvText || csvText.trim().length === 0) {
    return NextResponse.json({ error: 'empty_csv' }, { status: 400 })
  }

  const { rows, errors: parseErrors } = parseCsv(csvText)
  if (parseErrors.length > 0) {
    return NextResponse.json({ error: 'parse_failed', detail: parseErrors[0] }, { status: 400 })
  }

  // Pre-fetch all categories by slug
  const allCategories = await db.category.findMany({ select: { id: true, slug: true } })
  const catMap = new Map(allCategories.map((c) => [c.slug, c.id]))

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row.question || !row.answer || !row.category_slug) {
      skipped++
      errors.push(`Строка ${i + 2}: пропущена — не хватает обязательных полей`)
      continue
    }

    const categoryId = catMap.get(row.category_slug)
    if (!categoryId) {
      skipped++
      errors.push(`Строка ${i + 2}: категория с slug «${row.category_slug}» не найдена`)
      continue
    }

    try {
      const maxOrder = await db.faqItem.aggregate({
        _max: { order: true },
        where: { categoryId },
      })
      const order = (maxOrder._max.order ?? -1) + 1

      await db.faqItem.create({
        data: {
          categoryId,
          question: row.question,
          answer: row.answer,
          keywords: row.keywords ?? '',
          published: row.published === 'false' ? false : true,
          order,
        },
      })
      imported++
    } catch (e) {
      skipped++
      errors.push(`Строка ${i + 2}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  await logAdmin({
    action: 'faq_create',
    detail: `Массовый импорт CSV: импортировано ${imported}, пропущено ${skipped}`,
  })

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    errors: errors.slice(0, 20), // limit errors in response
  })
}
