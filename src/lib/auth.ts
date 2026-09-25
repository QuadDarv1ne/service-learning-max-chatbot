// Simple auth helpers — cookie-based session

import { cookies } from 'next/headers'

const SESSION_COOKIE = 'max_bot_admin_session'

// In a real deployment, set ADMIN_PASSWORD env var. Default for demo.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

// Simple "token" — base64 of password + timestamp+random suffix.
// For demo only; upgrade to NextAuth for production if needed.
function makeSessionToken(): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const ts = Date.now().toString(36)
  return Buffer.from(`${ts}:${rand}`).toString('base64')
}

export function verifyPassword(input: string): boolean {
  return input === ADMIN_PASSWORD
}

export async function createSession(): Promise<void> {
  const token = makeSessionToken()
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  return Boolean(token)
}
