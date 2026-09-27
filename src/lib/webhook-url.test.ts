// Unit tests for checkWebhookUrl. Run with: bun test
//
// These guard the rules MAX Bot API enforces on webhook subscription —
// a wrong URL silently breaks the bot, so the checks must not regress.

import { describe, expect, test } from 'bun:test'
import { checkWebhookUrl } from './webhook-url'

describe('checkWebhookUrl', () => {
  test('accepts a plain https URL', () => {
    const res = checkWebhookUrl('https://bot.example.ru/api/max/webhook')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.normalized).toBe('https://bot.example.ru/api/max/webhook')
  })

  test('trims surrounding whitespace', () => {
    const res = checkWebhookUrl('  https://bot.example.ru/api/max/webhook  ')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.normalized).toBe('https://bot.example.ru/api/max/webhook')
  })

  test('drops a trailing slash', () => {
    const res = checkWebhookUrl('https://bot.example.ru/api/max/webhook/')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.normalized).toBe('https://bot.example.ru/api/max/webhook')
  })

  test('rejects empty and null', () => {
    expect(checkWebhookUrl('').ok).toBe(false)
    expect(checkWebhookUrl('   ').ok).toBe(false)
    expect(checkWebhookUrl(null).ok).toBe(false)
    expect(checkWebhookUrl(undefined).ok).toBe(false)
  })

  test('rejects http with a hint about TLS', () => {
    const res = checkWebhookUrl('http://bot.example.ru/api/max/webhook')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('HTTPS')
  })

  test('rejects a query string', () => {
    const res = checkWebhookUrl('https://bot.example.ru/api/max/webhook?token=abc')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('query')
  })

  test('rejects a fragment', () => {
    const res = checkWebhookUrl('https://bot.example.ru/api/max/webhook#x')
    expect(res.ok).toBe(false)
  })

  test('rejects loopback and .local hosts', () => {
    for (const url of [
      'https://localhost:3000/api/max/webhook',
      'https://127.0.0.1/api/max/webhook',
      'https://my-tunnel.local/api/max/webhook',
    ]) {
      expect(checkWebhookUrl(url).ok).toBe(false)
    }
  })

  test('rejects garbage', () => {
    expect(checkWebhookUrl('not a url').ok).toBe(false)
    expect(checkWebhookUrl('bot.example.ru/api/max/webhook').ok).toBe(false)
  })

  test('accepts an ngrok-style tunnel URL', () => {
    expect(checkWebhookUrl('https://free-random-abc.ngrok-free.app/api/max/webhook').ok).toBe(true)
  })
})
