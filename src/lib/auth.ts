// Cookie-based session for the admin panel.
//
// A session cookie is a signed token (see session.ts). Checking only that the
// cookie exists is not authentication: any visitor could set
// max_bot_admin_session=1 by hand and reach every admin endpoint.

import { cookies } from 'next/headers'
import { safeCompare } from './secret-compare'
import { issueToken, verifyToken, SESSION_TTL_SECONDS } from './session'

const SESSION_COOKIE = 'max_bot_admin_session'

// In a real deployment, set ADMIN_PASSWORD env var. Default for demo.
const DEFAULT_PASSWORD = 'admin123'
let warnedAboutDefault = false

function adminPassword(): string {
  const configured = process.env.ADMIN_PASSWORD
  if (!configured && process.env.NODE_ENV === 'production' && !warnedAboutDefault) {
    warnedAboutDefault = true
    console.warn(
      '[auth] ADMIN_PASSWORD is not set — falling back to the built-in demo password. Set it in production.',
    )
  }
  return configured || DEFAULT_PASSWORD
}

export function verifyPassword(input: string): boolean {
  if (!input) return false
  return safeCompare(input, adminPassword())
}

export async function createSession(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, issueToken(adminPassword()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function isAuthenticated(): Promise<boolean> {
  // No password configured means no one could have logged in — and the key
  // derivation is public, so a token signed with the empty password is
  // forgeable by anyone. Refuse such sessions rather than accepting them.
  const password = adminPassword()
  if (!password) return false
  const store = await cookies()
  return verifyToken(store.get(SESSION_COOKIE)?.value ?? '', password).ok
}
