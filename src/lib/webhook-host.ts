// Server-only: resolve the host of a webhook URL and classify the address.
//
// checkWebhookUrl() in webhook-url.ts validates the URL text, so
// https://internal.example.ru and https://169.254.169.254 pass it. MAX would
// then deliver the bot's updates — including every user message — to an address
// inside the operator's private network. Setting a webhook is an operator-only
// action, so this is hardening rather than a hole, but the check is cheap.
//
// A resolution failure is deliberately NOT a hard error: a transient DNS problem
// must not stop the operator from saving a correct URL. Only a positively
// identified private target is rejected.

import { promises as dns } from 'node:dns'
import { isIP, isIPv4 } from 'node:net'

export type HostRisk = 'public' | 'private' | 'unresolved'

export type HostCheck = { risk: HostRisk; detail?: string }

/**
 * Classify an IP literal. Public IPv4 includes the carrier-grade NAT range
 * 100.64.0.0/10 and Tailscale's 100.64.0.0/10 CGNAT block, which are routable
 * on the public internet from MAX's point of view.
 */
export function classifyAddress(ip: string): HostRisk {
  if (isIPv4(ip)) {
    const [a, b] = ip.split('.').map((p) => parseInt(p, 10))
    if (a === 10 || a === 127 || a === 0) return 'private'
    if (a === 169 && b === 254) return 'private' // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return 'private'
    if (a === 192 && b === 168) return 'private'
    if (a === 100 && b >= 64 && b <= 127) return 'public' // CGNAT / Tailscale
    return 'public'
  }

  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return 'private'
  if (lower.startsWith('fe80:')) return 'private' // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return 'private' // ULA fc00::/7
  if (/^f[0-9a-f]{3}:/.test(lower)) return 'private' // IPv6 private-use (rfc4193)
  if (lower.startsWith('2001:db8:')) return 'private' // documentation prefix
  if (lower.includes('::ffff:')) return classifyAddress(lower.split('::ffff:')[1] ?? '')
  return 'public'
}

/** Worst risk among resolved addresses — one private record is enough. */
export function classifyAddresses(ips: string[]): HostRisk {
  if (ips.length === 0) return 'unresolved'
  return ips.some((ip) => classifyAddress(ip) === 'private') ? 'private' : 'public'
}

/** Resolve a host to IP addresses (A/AAAA plus platform-independent literal). */
export async function resolveHost(host: string): Promise<string[]> {
  if (isIP(host) !== 0) return [host]

  const lookup = await dns.lookup(host, { all: true, verbatim: true })
  const fromLookup = lookup.map((entry) => entry.address)

  let resolved: string[] = []
  try {
    const [a, aaaa] = await Promise.all([
      dns.resolve4(host).catch(() => [] as string[]),
      dns.resolve6(host).catch(() => [] as string[]),
    ])
    resolved = [...a, ...aaaa]
  } catch {
    // SERVFAIL/ENOENT: dns.lookup above is authoritative enough
  }

  return Array.from(new Set([...fromLookup, ...resolved]))
}

const PRIVATE_TARGET =
  'Адрес вебхука указывает во внутреннюю сеть (приватный или служебный IP). ' +
  'MAX не сможет его достичь, а запросы бота уйдут внутрь вашей инфраструктуры — ' +
  'укажите публичный домен с HTTPS'

/**
 * Verify that a webhook URL resolves to a publicly routable target.
 * Returns risk 'unresolved' when DNS fails so callers can decide to warn
 * instead of blocking.
 */
export async function checkWebhookHost(rawUrl: string): Promise<HostCheck> {
  let host: string
  try {
    host = new URL(rawUrl).hostname
  } catch {
    return { risk: 'unresolved', detail: 'not_a_url' }
  }

  const candidate = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
  if (!candidate) return { risk: 'unresolved', detail: 'empty_host' }

  let ips: string[]
  try {
    ips = await resolveHost(candidate)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    return { risk: 'unresolved', detail: code ?? 'lookup_failed' }
  }

  const risk = classifyAddresses(ips)
  return risk === 'private' ? { risk, detail: PRIVATE_TARGET } : { risk }
}

export const PRIVATE_WEBHOOK_TARGET_MESSAGE = PRIVATE_TARGET
