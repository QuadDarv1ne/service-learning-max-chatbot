import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function POST() {
  await logAdmin({ action: 'logout', detail: 'Выход из админ-панели' })
  await destroySession()
  return NextResponse.json({ ok: true })
}
