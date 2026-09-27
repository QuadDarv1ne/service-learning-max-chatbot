// Signed session tokens for the admin panel.
//
// The token is `<base64url(json payload)>.<base64url(hmac-sha256)>`. Without the
// signature a cookie is just a string the browser happens to hold: anyone can
// set it by hand and reach the admin API, which is exactly what the previous
// unsigned implementation allowed.
//
// Pure crypto on purpose — auth.ts wires it to next/headers, and the rules here
// are unit-tested in session.test.ts.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days, as before

export type SessionPayload = {
  /** issued-at, seconds since epoch */
  iat: number
  /** expiry, seconds since epoch */
  exp: number
  /** random per-login value, so two logins in the same second differ */
  nonce: string
}

export type SessionCheck = { ok: true } | { ok: false; reason: 'empty' | 'malformed' | 'signature' | 'expired' }

/**
 * Derive the signing key from the admin password.
 *
 * Deriving (rather than storing a separate secret) means changing the password
 * invalidates every outstanding session — desirable after a password rotation
 * or a suspected leak.
 */
export function deriveKey(password: string): Buffer {
  return createHash('sha256').update(`max-bot-session:${password}`, 'utf8').digest()
}

function sign(body: string, key: Buffer): string {
  return createHmac('sha256', key).update(body, 'utf8').digest('base64url')
}

/** Create a fresh, signed session token valid for `ttlSeconds`. */
export function issueToken(password: string, ttlSeconds = SESSION_TTL_SECONDS, now = Date.now()): string {
  const iat = Math.floor(now / 1000)
  const payload: SessionPayload = {
    iat,
    exp: iat + ttlSeconds,
    nonce: randomBytes(16).toString('base64url'),
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${body}.${sign(body, deriveKey(password))}`
}

/**
 * Validate signature and expiry.
 *
 * `now` is injectable so the expiry boundary is testable without waiting.
 */
export function verifyToken(token: string, password: string, now = Date.now()): SessionCheck {
  if (!token) return { ok: false, reason: 'empty' }

  // base64url never contains '.', so the last dot separates the signature
  const dot = token.lastIndexOf('.')
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: 'malformed' }

  const body = token.slice(0, dot)
  const provided = Buffer.from(token.slice(dot + 1), 'utf8')
  const expected = Buffer.from(sign(body, deriveKey(password)), 'utf8')

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'signature' }
  }

  let payload: Partial<SessionPayload>
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') {
    return { ok: false, reason: 'malformed' }
  }
  if (payload.exp * 1000 <= now) return { ok: false, reason: 'expired' }

  return { ok: true }
}
