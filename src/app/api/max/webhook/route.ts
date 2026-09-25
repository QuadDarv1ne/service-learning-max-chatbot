// MAX Bot API webhook endpoint
// POST /api/max/webhook
//
// CRITICAL: MAX expects 200 OK for every webhook call.
// If we return non-200, MAX will retry the request multiple times.
// Even on internal errors, we must return 200 — the error is logged internally.

import { NextResponse } from 'next/server'
import { processMaxUpdate, type MaxUpdate } from '@/lib/bot-logic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
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
