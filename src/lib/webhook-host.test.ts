import { describe, expect, test } from 'bun:test'

import { classifyAddress, classifyAddresses } from './webhook-host'

describe('classifyAddress — IPv4', () => {
  test('rejects loopback, RFC1918 and link-local', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0']) {
      expect(classifyAddress(ip)).toBe('private')
    }
  })

  test('accepts public addresses', () => {
    for (const ip of ['8.8.8.8', '95.111.111.111', '203.0.113.9']) {
      expect(classifyAddress(ip)).toBe('public')
    }
  })

  test('treats CGNAT range as public', () => {
    expect(classifyAddress('100.64.0.1')).toBe('public')
    expect(classifyAddress('100.127.255.255')).toBe('public')
  })
})

describe('classifyAddress — IPv6', () => {
  test('rejects loopback, link-local and ULA', () => {
    expect(classifyAddress('::1')).toBe('private')
    expect(classifyAddress('fe80::1')).toBe('private')
    expect(classifyAddress('fd12:3456::1')).toBe('private')
    expect(classifyAddress('fc00::1')).toBe('private')
  })

  test('accepts global unicast', () => {
    expect(classifyAddress('2a02:26f8::1')).toBe('public')
  })
})

describe('classifyAddresses', () => {
  test('one private record poisons the whole answer', () => {
    expect(classifyAddresses(['95.111.111.111', '10.0.0.5'])).toBe('private')
  })

  test('all public resolves to public', () => {
    expect(classifyAddresses(['95.111.111.111', '2a02:26f8::1'])).toBe('public')
  })

  test('empty answer is unresolved rather than safe', () => {
    expect(classifyAddresses([])).toBe('unresolved')
  })
})
