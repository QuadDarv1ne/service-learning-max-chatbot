// GET /api/health — system health check (no auth required, used for monitoring)
//
// Returns:
//   - Database connection status (ok/failed)
//   - Whether bot token is configured
//   - Whether webhook is subscribed
//   - Counts of categories / FAQs (quick sanity check)
//   - Last 24h: incoming messages, MAX API errors
//   - Average response time over last 24h
//   - Whether LLM fallback is enabled
//   - Server timestamp and version

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const checks: Record<string, unknown> = {}
  let overallOk = true

  // 1. Database check
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { ok: true }
  } catch (e) {
    checks.database = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
    overallOk = false
  }

  // 2. Settings check
  try {
    const settings = await db.botSetting.findMany({
      where: { key: { in: ['botToken', 'webhookUrl', 'webhookSubscribed', 'llmEnabled'] } },
    })
    const settingsMap: Record<string, string> = {}
    for (const s of settings) settingsMap[s.key] = s.value ?? ''

    checks.botTokenConfigured = Boolean(settingsMap.botToken)
    checks.webhookUrl = settingsMap.webhookUrl ?? ''
    checks.webhookSubscribed = settingsMap.webhookSubscribed === 'true'
    checks.llmEnabled = settingsMap.llmEnabled !== 'false'

    if (!checks.botTokenConfigured) overallOk = false
  } catch (e) {
    checks.settings = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
    overallOk = false
  }

  // 3. Knowledge base check
  try {
    const [categories, publishedCategories, faqs, publishedFaqs] = await Promise.all([
      db.category.count(),
      db.category.count({ where: { published: true } }),
      db.faqItem.count(),
      db.faqItem.count({ where: { published: true } }),
    ])
    checks.knowledgeBase = {
      categories,
      publishedCategories,
      faqs,
      publishedFaqs,
      empty: faqs === 0,
    }
    if (faqs === 0) overallOk = false
  } catch (e) {
    checks.knowledgeBase = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
    overallOk = false
  }

  // 4. Recent activity (last 24h) — quick query
  try {
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const [incoming, outgoing, maxApiErrors, llmHandled] = await Promise.all([
      db.messageLog.count({
        where: { createdAt: { gte: oneDayAgo }, direction: 'in', messageType: 'text' },
      }),
      db.messageLog.count({
        where: { createdAt: { gte: oneDayAgo }, direction: 'out' },
      }),
      db.messageLog.count({
        where: {
          createdAt: { gte: oneDayAgo },
          direction: 'out',
          NOT: { maxApiStatus: 200 },
          maxApiStatus: { not: null },
        },
      }),
      db.messageLog.count({
        where: { createdAt: { gte: oneDayAgo }, source: 'llm' },
      }),
    ])

    // Average response time over last 24h
    const recentLogs = await db.messageLog.findMany({
      where: {
        createdAt: { gte: oneDayAgo },
        direction: 'out',
        durationMs: { not: null },
      },
      select: { durationMs: true },
      take: 500,
    })
    const durations = recentLogs.map((l) => l.durationMs ?? 0).filter((d) => d > 0)
    const avgResponseMs =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0

    checks.last24h = {
      incomingMessages: incoming,
      outgoingMessages: outgoing,
      maxApiErrors,
      llmHandled,
      avgResponseMs,
    }
  } catch (e) {
    checks.last24h = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }

  // 5. Latest bot activity timestamp
  try {
    const latest = await db.messageLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    checks.lastActivityAt = latest?.createdAt?.toISOString() ?? null
  } catch {
    checks.lastActivityAt = null
  }

  return NextResponse.json({
    ok: overallOk,
    version: '2.1',
    service: 'max-bot-admin-panel',
    programme: 'Обучение служением. Первые',
    timestamp: new Date().toISOString(),
    uptime: process.uptime ? Math.round(process.uptime()) : null,
    checks,
  })
}
