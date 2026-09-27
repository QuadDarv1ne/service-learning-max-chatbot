// Verification of the shared secret that MAX attaches to every webhook call.
//
// The webhook endpoint is public by nature, so without this check anyone who
// learns the URL can POST a forged update — arbitrary user_id, fake chats,
// poisoned message logs and replies sent to real users. MAX lets us register a
// `secret` when subscribing (see maxApi.subscribeWebhook); it then echoes that
// value back in the `x-max-webhook-secret` header of every delivery.

import { safeCompare } from './secret-compare'

/** Header MAX uses to carry the subscription secret. */
export const WEBHOOK_SECRET_HEADER = 'x-max-webhook-secret'

export type WebhookAuthResult =
  | { ok: true }
  | {
      ok: false
      reason: 'not_configured' | 'missing_header' | 'mismatch'
    }

/**
 * Validate the incoming secret against MAX_WEBHOOK_SECRET.
 *
 * Production fails closed: an unauthenticated webhook would let anyone drive
 * the bot, so a missing secret is treated as a fatal misconfiguration rather
 * than an open door. Outside production the check is skipped so local
 * development and tests can post updates without registering a subscription.
 */
export function verifyWebhookSecret(
  headerValue: string | null,
  env: Record<string, string | undefined> = process.env,
): WebhookAuthResult {
  const configured = (env.MAX_WEBHOOK_SECRET ?? '').trim()

  if (!configured) {
    return env.NODE_ENV === 'production'
      ? { ok: false, reason: 'not_configured' }
      : { ok: true }
  }

  const provided = headerValue ?? ''
  if (!provided) return { ok: false, reason: 'missing_header' }

  return safeCompare(provided, configured) ? { ok: true } : { ok: false, reason: 'mismatch' }
}
