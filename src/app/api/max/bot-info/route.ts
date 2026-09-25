// GET /api/max/bot-info — info about bot from MAX API

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { maxApi } from '@/lib/max-api'
import { isAuthenticated } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const tokenRow = await db.botSetting.findUnique({ where: { key: 'botToken' } })
  if (!tokenRow?.value) {
    return NextResponse.json({ error: 'botToken_not_set' }, { status: 400 })
  }

  const info = await maxApi.getMe()
  if (!info) {
    return NextResponse.json(
      { error: 'api_error', detail: 'Failed to fetch bot info — check token validity' },
      { status: 502 },
    )
  }

  return NextResponse.json({ bot: info })
}
