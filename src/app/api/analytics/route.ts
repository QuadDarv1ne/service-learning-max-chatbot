// GET /api/analytics — comprehensive analytics for the dashboard
//
// Query params:
//   period — '7d' (default) | '30d' | '90d' | 'all'
//   groupBy — 'day' (default) | 'hour' | 'week'
//
// Returns: funnel, activity by time, top queries, top categories,
//          response time stats, source distribution, LLM usage,
//          unanswered queries (for the "add to knowledge" page)

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'

export const runtime = 'nodejs'

function startOfPeriod(period: string): Date | null {
  if (period === 'all') return null
  const now = new Date()
  const d = new Date(now)
  if (period === '7d') d.setDate(d.getDate() - 7)
  else if (period === '30d') d.setDate(d.getDate() - 30)
  else if (period === '90d') d.setDate(d.getDate() - 90)
  else d.setDate(d.getDate() - 7) // default
  return d
}

// Truncate date to day/hour/week
function truncate(date: Date, groupBy: string): string {
  const d = new Date(date)
  if (groupBy === 'hour') {
    d.setMinutes(0, 0, 0)
    return d.toISOString()
  }
  if (groupBy === 'week') {
    const day = d.getDay() || 7 // make Monday = 1
    d.setDate(d.getDate() - day + 1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }
  // default: day
  return d.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || '7d'
  const groupBy =
    searchParams.get('groupBy') === 'hour'
      ? 'hour'
      : searchParams.get('groupBy') === 'week'
        ? 'week'
        : 'day'

  const startDate = startOfPeriod(period)
  const where = startDate ? { createdAt: { gte: startDate } } : {}

  // Funnel counts
  const [
    incomingCount,
    outgoingCount,
    callbackCount,
    searchResponses,
    faqViewed,
    llmResponses,
    llmFailures,
    fallbackResponses,
    offTopicResponses,
    commandCount,
    maxApiErrors,
  ] = await Promise.all([
    db.messageLog.count({ where: { ...where, direction: 'in', messageType: 'text' } }),
    db.messageLog.count({ where: { ...where, direction: 'out' } }),
    db.messageLog.count({ where: { ...where, direction: 'in', messageType: 'callback' } }),
    db.messageLog.count({ where: { ...where, source: 'search' } }),
    db.messageLog.count({ where: { ...where, source: 'faq' } }),
    db.messageLog.count({ where: { ...where, source: 'llm' } }),
    db.messageLog.count({ where: { ...where, source: 'llm', llmOk: false } }),
    db.messageLog.count({ where: { ...where, source: 'fallback' } }),
    db.messageLog.count({ where: { ...where, source: 'off_topic' } }),
    db.messageLog.count({ where: { ...where, source: 'command' } }),
    db.messageLog.count({
      where: { ...where, direction: 'out', NOT: { maxApiStatus: 200 }, maxApiStatus: { not: null } },
    }),
  ])

  // Activity by time bucket
  const allLogs = await db.messageLog.findMany({
    where,
    select: { createdAt: true, direction: true, source: true },
  })

  const activityMap: Record<string, { in: number; out: number; llm: number }> = {}
  for (const log of allLogs) {
    const bucket = truncate(log.createdAt, groupBy)
    if (!activityMap[bucket]) activityMap[bucket] = { in: 0, out: 0, llm: 0 }
    if (log.direction === 'in') activityMap[bucket].in += 1
    else activityMap[bucket].out += 1
    if (log.source === 'llm') activityMap[bucket].llm += 1
  }

  const activity = Object.entries(activityMap)
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Top queries — incoming text messages grouped by content (top 20)
  const incomingTexts = await db.messageLog.findMany({
    where: { ...where, direction: 'in', messageType: 'text', searchText: { not: null } },
    select: { searchText: true },
  })
  const queryCounts: Record<string, number> = {}
  for (const log of incomingTexts) {
    const q = (log.searchText ?? '').trim().toLowerCase().slice(0, 200)
    if (!q) continue
    queryCounts[q] = (queryCounts[q] || 0) + 1
  }
  const topQueries = Object.entries(queryCounts)
    .map(([q, count]) => ({ query: q, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // Top categories — by views
  const categories = await db.category.findMany({
    where: { published: true },
    include: {
      items: { select: { id: true, question: true, viewCount: true, keywords: true } },
    },
    orderBy: { order: 'asc' },
  })
  const topCategories = categories
    .map((c) => {
      const totalViews = c.items.reduce((s, i) => s + i.viewCount, 0)
      return { id: c.id, title: c.title, itemCount: c.items.length, totalViews }
    })
    .sort((a, b) => b.totalViews - a.totalViews)

  // Top FAQ items by views (top 10)
  const topFaqs = await db.faqItem.findMany({
    orderBy: { viewCount: 'desc' },
    take: 10,
    select: { id: true, question: true, viewCount: true, category: { select: { title: true } } },
  })

  // Response time stats — average duration for outgoing messages
  const outgoingWithDuration = await db.messageLog.findMany({
    where: { ...where, direction: 'out', durationMs: { not: null } },
    select: { durationMs: true, source: true },
  })
  const durations = outgoingWithDuration.map((l) => l.durationMs ?? 0).filter((d) => d > 0)
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0
  const p95Duration =
    durations.length > 0
      ? Math.round(durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)])
      : 0

  // Source distribution for outgoing
  const sourceDistribution: Record<string, number> = {}
  for (const log of outgoingWithDuration) {
    const s = log.source ?? 'unknown'
    sourceDistribution[s] = (sourceDistribution[s] || 0) + 1
  }

  // Unique users in period
  const uniqueUsers = await db.messageLog.groupBy({
    by: ['maxUserId'],
    where,
    _count: true,
  })

  // Unanswered queries — incoming texts that did NOT trigger FAQ search
  const unansweredRes = await db.messageLog.findMany({
    where: { ...where, direction: 'in', messageType: 'text', searchText: { not: null } },
    select: { searchText: true, createdAt: true, maxUserId: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const userIds = [...new Set(unansweredRes.map((u) => u.maxUserId))]
  const userOutSources = await db.messageLog.groupBy({
    by: ['maxUserId', 'source'],
    where: { ...where, maxUserId: { in: userIds }, direction: 'out' },
    _count: true,
  })

  const userGotSearch: Record<number, boolean> = {}
  for (const row of userOutSources) {
    if (row.source === 'search' && row._count > 0) {
      userGotSearch[row.maxUserId] = true
    }
  }

  const unansweredQueries: Record<string, { count: number; lastAsked: Date; sampleUser: number }> = {}
  for (const log of unansweredRes) {
    const userId = log.maxUserId
    if (userGotSearch[userId]) continue
    const q = (log.searchText ?? '').trim().toLowerCase().slice(0, 200)
    if (!q) continue
    if (!unansweredQueries[q]) {
      unansweredQueries[q] = { count: 0, lastAsked: log.createdAt, sampleUser: userId }
    }
    unansweredQueries[q].count += 1
    if (log.createdAt > unansweredQueries[q].lastAsked) {
      unansweredQueries[q].lastAsked = log.createdAt
    }
  }

  const unanswered = Object.entries(unansweredQueries)
    .map(([query, info]) => ({
      query,
      count: info.count,
      lastAsked: info.lastAsked,
      sampleUser: info.sampleUser,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)

  // Stats for max API failures — for monitoring integration health
  const apiFailures = await db.messageLog.findMany({
    where: { ...where, direction: 'out', maxApiError: { not: null } },
    select: { maxApiStatus: true, maxApiError: true, createdAt: true },
    take: 100,
    orderBy: { createdAt: 'desc' },
  })

  // Cohort analysis — returning users by day (1/3/7/14) for users who first appeared in this period
  //   - First-seen users (cohort): those whose FIRST message was in the period
  //   - D1 retention: returned within 1 day after first message
  //   - D3 retention: returned within 3 days
  //   - D7 retention: returned within 7 days
  //   - D14 retention: returned within 14 days
  let cohortAnalysis: {
    cohortSize: number
    d1Retained: number
    d3Retained: number
    d7Retained: number
    d14Retained: number
    d1Rate: number
    d3Rate: number
    d7Rate: number
    d14Rate: number
    periodStart: string
  } | null = null

  const periodStart = startDate
  if (periodStart) {
    const firstSeenUsers = await db.messageLog.findMany({
      where: { createdAt: { gte: periodStart } },
      select: { maxUserId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    })

    const firstSeenMap: Record<number, Date> = {}
    for (const log of firstSeenUsers) {
      if (!firstSeenMap[log.maxUserId] || log.createdAt < firstSeenMap[log.maxUserId]) {
        firstSeenMap[log.maxUserId] = log.createdAt
      }
    }
    const cohortUserIds = Object.keys(firstSeenMap).map(Number)
    const cohortSize = cohortUserIds.length

    if (cohortSize > 0) {
      const cohortEnd = new Date()
      const cohortMessages = await db.messageLog.findMany({
        where: {
          maxUserId: { in: cohortUserIds },
          createdAt: { gte: periodStart, lte: cohortEnd },
        },
        select: { maxUserId: true, createdAt: true },
        take: 20000,
      })

      const day = 24 * 60 * 60 * 1000
      const retainedD1 = new Set<number>()
      const retainedD3 = new Set<number>()
      const retainedD7 = new Set<number>()
      const retainedD14 = new Set<number>()

      for (const log of cohortMessages) {
        const firstSeen = firstSeenMap[log.maxUserId]
        const diff = log.createdAt.getTime() - firstSeen.getTime()
        if (diff <= 0) continue
        if (diff <= 1 * day) retainedD1.add(log.maxUserId)
        if (diff <= 3 * day) retainedD3.add(log.maxUserId)
        if (diff <= 7 * day) retainedD7.add(log.maxUserId)
        if (diff <= 14 * day) retainedD14.add(log.maxUserId)
      }

      cohortAnalysis = {
        cohortSize,
        d1Retained: retainedD1.size,
        d3Retained: retainedD3.size,
        d7Retained: retainedD7.size,
        d14Retained: retainedD14.size,
        d1Rate: cohortSize > 0 ? Math.round((retainedD1.size / cohortSize) * 100) : 0,
        d3Rate: cohortSize > 0 ? Math.round((retainedD3.size / cohortSize) * 100) : 0,
        d7Rate: cohortSize > 0 ? Math.round((retainedD7.size / cohortSize) * 100) : 0,
        d14Rate: cohortSize > 0 ? Math.round((retainedD14.size / cohortSize) * 100) : 0,
        periodStart: periodStart.toISOString(),
      }
    }
  }

  // Hourly distribution — shows peak hours of incoming messages (0-23)
  const hourlyDist: number[] = new Array(24).fill(0)
  for (const log of allLogs) {
    if (log.direction === 'in') {
      const hour = new Date(log.createdAt).getUTCHours()
      // Convert to user's local timezone (UTC+3 for Moscow) — but keep UTC for simplicity
      // Admins can interpret the offset
      hourlyDist[hour]++
    }
  }

  // Forecast — simple linear regression on daily incoming counts to predict next 7 days
  // Uses last 14 days of activity data (already computed above)
  let forecast: {
    next7Days: number // predicted total incoming for next 7 days
    avgPerDay: number // current average per day
    trend: 'up' | 'down' | 'stable' // direction
    trendPct: number // % change vs previous 7 days
    confidence: 'low' | 'medium' | 'high' // based on sample size
  } | null = null

  if (allLogs.length > 0) {
    // Build daily incoming counts for last 14 days
    const dayMs = 24 * 60 * 60 * 1000
    const now = new Date()
    const dailyIncoming: { day: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now.getTime() - i * dayMs)
      const day = date.toISOString().slice(0, 10)
      const count = allLogs.filter((l) => {
        if (l.direction !== 'in') return false
        return l.createdAt.toISOString().slice(0, 10) === day
      }).length
      dailyIncoming.push({ day, count })
    }

    const last7 = dailyIncoming.slice(-7).reduce((s, d) => s + d.count, 0)
    const prev7 = dailyIncoming.slice(0, 7).reduce((s, d) => s + d.count, 0)

    // Linear regression: y = a + b*x where x = day index, y = count
    const n = dailyIncoming.length
    const sumX = (n * (n - 1)) / 2
    const sumY = dailyIncoming.reduce((s, d) => s + d.count, 0)
    const sumXY = dailyIncoming.reduce((s, d, i) => s + i * d.count, 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
    const slope = n * sumXY - sumX * sumY !== 0 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0
    const intercept = (sumY - slope * sumX) / n

    // Predict next 7 days: sum of (intercept + slope * (n+i)) for i=1..7
    let predictedTotal = 0
    for (let i = 1; i <= 7; i++) {
      const predicted = Math.max(0, Math.round(intercept + slope * (n + i - 1)))
      predictedTotal += predicted
    }

    const trendPct = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : 0
    const trend: 'up' | 'down' | 'stable' =
      trendPct > 5 ? 'up' : trendPct < -5 ? 'down' : 'stable'
    const confidence: 'low' | 'medium' | 'high' =
      n >= 14 ? 'high' : n >= 7 ? 'medium' : 'low'

    forecast = {
      next7Days: predictedTotal,
      avgPerDay: Math.round((sumY / n) * 10) / 10,
      trend,
      trendPct,
      confidence,
    }
  }

  return NextResponse.json({
    period,
    groupBy,
    startDate: startDate?.toISOString() ?? null,
    funnel: {
      incoming: incomingCount,
      outgoing: outgoingCount,
      callbacks: callbackCount,
      commands: commandCount,
      faqMatched: searchResponses + faqViewed,
      llmHandled: llmResponses,
      llmFailures,
      fallbackShown: fallbackResponses,
      offTopicBlocked: offTopicResponses,
      maxApiErrors,
    },
    metrics: {
      faqMatchRate: incomingCount > 0 ? Math.round(((searchResponses + faqViewed) / incomingCount) * 100) : 0,
      llmRate: incomingCount > 0 ? Math.round((llmResponses / incomingCount) * 100) : 0,
      fallbackRate: incomingCount > 0 ? Math.round((fallbackResponses / incomingCount) * 100) : 0,
      offTopicRate: incomingCount > 0 ? Math.round((offTopicResponses / incomingCount) * 100) : 0,
      llmSuccessRate: llmResponses > 0 ? Math.round(((llmResponses - llmFailures) / llmResponses) * 100) : 0,
      uniqueUsers: uniqueUsers.length,
      avgMessagesPerUser: uniqueUsers.length > 0 ? Math.round(((incomingCount + outgoingCount) / uniqueUsers.length) * 10) / 10 : 0,
    },
    activity,
    topQueries,
    topCategories,
    topFaqs,
    responseTime: {
      avgMs: avgDuration,
      minMs: minDuration,
      maxMs: maxDuration,
      p95Ms: p95Duration,
      samples: durations.length,
    },
    sourceDistribution,
    unansweredQueries: unanswered,
    apiFailures: apiFailures.slice(0, 10),
    cohortAnalysis,
    forecast,
    hourlyDistribution: hourlyDist,
  })
}
