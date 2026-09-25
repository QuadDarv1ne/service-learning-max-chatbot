// GET /api/logs/export — export message logs as CSV
// Query params: from, to (ISO date), direction, messageType, maxUserId

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'

export const runtime = 'nodejs'

function csvEscape(s: string | null | undefined): string {
  if (s == null) return ''
  // Escape quotes by doubling, wrap in quotes if contains comma/quote/newline
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const direction = searchParams.get('direction') || undefined
  const messageType = searchParams.get('messageType') || undefined
  const source = searchParams.get('source') || undefined
  const maxUserIdStr = searchParams.get('maxUserId')
  const maxUserId = maxUserIdStr ? parseInt(maxUserIdStr, 10) : undefined
  const from = searchParams.get('from') || searchParams.get('dateFrom')
  const to = searchParams.get('to') || searchParams.get('dateTo')
  const search = searchParams.get('search')

  const where = {
    ...(direction ? { direction } : {}),
    ...(messageType ? { messageType } : {}),
    ...(source ? { source } : {}),
    ...(maxUserId ? { maxUserId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(search ? { text: { contains: search } } : {}),
  }

  const logs = await db.messageLog.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 10000, // safety cap
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, username: true, maxUserId: true },
      },
    },
  })

  const headers = [
    'timestamp',
    'direction',
    'message_type',
    'source',
    'duration_ms',
    'llm_ok',
    'max_api_status',
    'max_user_id',
    'user_first_name',
    'user_last_name',
    'user_username',
    'text',
    'search_text',
    'callback_payload',
    'matched_faq_id',
  ]

  const rows = logs.map((l) =>
    [
      l.createdAt.toISOString(),
      l.direction,
      l.messageType,
      l.source ?? '',
      l.durationMs != null ? String(l.durationMs) : '',
      l.llmOk == null ? '' : l.llmOk ? 'true' : 'false',
      l.maxApiStatus == null ? '' : String(l.maxApiStatus),
      String(l.maxUserId),
      l.user?.firstName ?? '',
      l.user?.lastName ?? '',
      l.user?.username ?? '',
      l.text ?? '',
      l.searchText ?? '',
      l.callbackPayload ?? '',
      l.matchedFaqId ?? '',
    ]
      .map(csvEscape)
      .join(','),
  )

  const csv = [headers.join(','), ...rows].join('\r\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="max-bot-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
