// MAX Bot API webhook endpoint
// POST /api/max/webhook
//
// CRITICAL: MAX expects 200 OK for every webhook call.
// If we return non-200, MAX will retry the request multiple times.
// Even on internal errors, we must return 200 — the error is logged internally.

import { NextResponse } from 'next/server'
import { processMaxUpdate, type MaxUpdate } from '@/lib/bot-logic'
import { verifyWebhookSecret, WEBHOOK_SECRET_HEADER } from '@/lib/webhook-secret'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // The URL is public: without this check anyone could forge an update with an
  // arbitrary user_id and make the bot act as that user.
  const auth = verifyWebhookSecret(req.headers.get(WEBHOOK_SECRET_HEADER))
  if (!auth.ok) {
    // Deliberately not 200: MAX retries on non-2xx, which is what we want for a
    // misconfiguration, and forged traffic should not look acknowledged.
    console.error(`Webhook: rejected (${auth.reason})`)
    const status = auth.reason === 'not_configured' ? 503 : 401
    return NextResponse.json(
      {
        ok: false,
        error: auth.reason,
        ...(auth.reason === 'not_configured'
          ? {
              detail:
                'Set MAX_WEBHOOK_SECRET in the environment and re-subscribe the webhook (see .env.example)',
            }
          : null),
      },
      { status },
    )
  }

  let body: MaxUpdate
  try {
    body = (await req.json()) as MaxUpdate
  } catch {
    // Invalid JSON — still return 200 to prevent MAX retries
    console.error('Webhook: invalid JSON received')
    return NextResponse.json({ ok: true, error: 'invalid_json' })
  }

  if (!body || !body.update_type) {
    console.error('Webhook: missing update_type')
    return NextResponse.json({ ok: true, error: 'invalid_update' })
  }

  try {
    const result = await processMaxUpdate(body)

    if (!result.ok) {
      // Log error but STILL return 200 to prevent MAX retries
      console.error('Webhook: processMaxUpdate failed:', result.error)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    // Catch any unhandled exception — return 200, log error
    console.error('Webhook: unhandled exception:', e)
    return NextResponse.json({ ok: true, error: 'internal_error' })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'max-bot-webhook',
    timestamp: new Date().toISOString(),
  })
}
