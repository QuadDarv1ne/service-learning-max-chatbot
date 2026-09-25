// GET /api/admin-actions/export — export admin action audit log as CSV
// Query: action, ok, dateFrom, dateTo

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

function csvEscape(s: string | null | undefined): string {
  if (s == null) return ''
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
  const action = searchParams.get('action') || undefined
  const okStr = searchParams.get('ok')
  const ok = okStr === 'true' ? true : okStr === 'false' ? false : undefined
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const where = {
    ...(action ? { action } : {}),
    ...(ok !== undefined ? { ok } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  }

  const logs = await db.adminActionLog.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 10000,
  })

  const headers = [
    'timestamp',
    'action',
    'ok',
    'resource',
    'detail',
    'error',
    'ip_hash',
    'user_agent',
  ]

  const rows = logs.map((l) =>
    [
      l.createdAt.toISOString(),
      l.action,
      l.ok ? 'true' : 'false',
      l.resource ?? '',
      l.detail ?? '',
      l.error ?? '',
      l.ipHash ?? '',
      l.userAgent ?? '',
    ]
      .map(csvEscape)
      .join(','),
  )

  const csv = [headers.join(','), ...rows].join('\r\n')

  await logAdmin({
    action: 'audit_export',
    detail: `Экспорт журнала: ${logs.length} записей`,
  })

  const filename = `max-bot-audit-${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
