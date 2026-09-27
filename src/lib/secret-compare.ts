// Constant-time comparison for shared secrets.
//
// Used wherever a secret arrives over HTTP (MAX webhook deliveries, cron
// triggers). A plain `===` short-circuits on the first differing byte, and the
// resulting timing difference leaks the secret to an attacker able to measure
// many responses.

import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Compare two secrets without leaking either value through timing.
 *
 * Both sides are hashed first so the comparison always runs over equal-length
 * buffers: `timingSafeEqual` throws on length mismatch, and comparing raw
 * lengths would reveal how long the configured secret is.
 */
export function safeCompare(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}
