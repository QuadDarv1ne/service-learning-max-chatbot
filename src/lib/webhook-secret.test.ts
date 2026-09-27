// Unit tests for the webhook shared-secret check. Run with: bun test
//
// These guard the only thing standing between the public webhook URL and
// anyone on the internet driving the bot, so the fail-closed behaviour in
// production must never regress.

import { describe, it, expect } from 'bun:test'
import { verifyWebhookSecret, WEBHOOK_SECRET_HEADER } from './webhook-secret'

describe('verifyWebhookSecret', () => {
  const secret = 'test-webhook-secret'

  it('passes when the header matches the configured secret', () => {
    const res = verifyWebhookSecret(secret, { MAX_WEBHOOK_SECRET: secret })
    expect(res.ok).toBe(true)
  })

  it('rejects a wrong secret', () => {
    const res = verifyWebhookSecret('wrong', { MAX_WEBHOOK_SECRET: secret })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('mismatch')
  })

  it('rejects a missing header when a secret is configured', () => {
    for (const header of [null, '']) {
      const res = verifyWebhookSecret(header, { MAX_WEBHOOK_SECRET: secret })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.reason).toBe('missing_header')
    }
  })

  it('ignores surrounding whitespace in the configured secret', () => {
    const res = verifyWebhookSecret(secret, { MAX_WEBHOOK_SECRET: `  ${secret}  ` })
    expect(res.ok).toBe(true)
  })

  it('fails closed in production when no secret is configured', () => {
    const res = verifyWebhookSecret(null, { NODE_ENV: 'production', MAX_WEBHOOK_SECRET: '' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('not_configured')
  })

  it('fails closed in production even if a header is supplied', () => {
    const res = verifyWebhookSecret('anything', {
      NODE_ENV: 'production',
      MAX_WEBHOOK_SECRET: '   ',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('not_configured')
  })

  it('allows unauthenticated calls outside production for local development', () => {
    expect(verifyWebhookSecret(null, { NODE_ENV: 'test' }).ok).toBe(true)
    expect(verifyWebhookSecret(null, { NODE_ENV: 'development' }).ok).toBe(true)
  })

  it('still validates the header outside production once a secret is set', () => {
    const res = verifyWebhookSecret('wrong', { NODE_ENV: 'development', MAX_WEBHOOK_SECRET: secret })
    expect(res.ok).toBe(false)
  })
})

describe('WEBHOOK_SECRET_HEADER', () => {
  it('matches the header MAX sends', () => {
    expect(WEBHOOK_SECRET_HEADER).toBe('x-max-webhook-secret')
  })
})
