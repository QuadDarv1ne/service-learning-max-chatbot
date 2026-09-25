// GET /api/logs — message log (paginated)

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 200)
  const direction = searchParams.get('direction') || undefined
  const messageType = searchParams.get('messageType') || undefined
  const source = searchParams.get('source') || undefined
  const maxUserIdStr = searchParams.get('maxUserId')
  const maxUserId = maxUserIdStr ? parseInt(maxUserIdStr, 10) : undefined
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const search = searchParams.get('search') // text search in 'text' field

  const where = {
    ...(direction ? { direction } : {}),
    ...(messageType ? { messageType } : {}),
    ...(source ? { source } : {}),
    ...(maxUserId ? { maxUserId } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(search ? { text: { contains: search } } : {}),
  }

  const [logs, total] = await Promise.all([
    db.messageLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, maxUserId: true },
        },
      },
    }),
    db.messageLog.count({ where }),
  ])

  return NextResponse.json({
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}
