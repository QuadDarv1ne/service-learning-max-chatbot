// GET /api/admin-actions — audit log of admin panel actions
// Query: action, ok, page, pageSize, dateFrom, dateTo

import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { listAdminActions } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || undefined
  const okStr = searchParams.get('ok')
  const ok = okStr === 'true' ? true : okStr === 'false' ? false : undefined
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 200)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const result = await listAdminActions({
    action: action || undefined,
    ok,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    page,
    pageSize,
  })

  return NextResponse.json(result)
}
