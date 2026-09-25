// POST /api/auth/login
// Body: { password: string }

import { NextResponse } from 'next/server'
import { verifyPassword, createSession } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const password = body.password ?? ''
  if (!password) {
    await logAdmin({
      action: 'login_failed',
      ok: false,
      error: 'no_password_provided',
    })
    return NextResponse.json({ error: 'password_required' }, { status: 400 })
  }

  if (!verifyPassword(password)) {
    await logAdmin({
      action: 'login_failed',
      ok: false,
      error: 'invalid_credentials',
    })
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  await createSession()
  await logAdmin({
    action: 'login',
    detail: 'Успешный вход в админ-панель',
  })
  return NextResponse.json({ ok: true })
}
