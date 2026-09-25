// GET /api/stats — dashboard statistics

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [
    totalCategories,
    publishedCategories,
    totalFaqs,
    publishedFaqs,
    totalUsers,
    totalMessages,
    inboundMessages,
    outboundMessages,
  ] = await Promise.all([
    db.category.count(),
    db.category.count({ where: { published: true } }),
    db.faqItem.count(),
    db.faqItem.count({ where: { published: true } }),
    db.maxUser.count(),
    db.messageLog.count(),
    db.messageLog.count({ where: { direction: 'in' } }),
    db.messageLog.count({ where: { direction: 'out' } }),
  ])

  // Top 5 most viewed FAQs
  const topFaqs = await db.faqItem.findMany({
    orderBy: { viewCount: 'desc' },
    take: 5,
    select: { id: true, question: true, viewCount: true, category: { select: { title: true } } },
  })

  // Recent users (last 10)
  const recentUsers = await db.maxUser.findMany({
    orderBy: { lastSeenAt: 'desc' },
    take: 10,
    select: {
      id: true,
      maxUserId: true,
      firstName: true,
      lastName: true,
      username: true,
      lastSeenAt: true,
      createdAt: true,
    },
  })

  // Activity last 7 days — count messages per day
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentLogs = await db.messageLog.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true, direction: true },
  })

  // Group by date
  const activityByDay: Record<string, { in: number; out: number }> = {}
  for (const log of recentLogs) {
    const day = log.createdAt.toISOString().slice(0, 10)
    if (!activityByDay[day]) activityByDay[day] = { in: 0, out: 0 }
    activityByDay[day][log.direction] += 1
  }

  return NextResponse.json({
    totals: {
      categories: totalCategories,
      publishedCategories,
      faqs: totalFaqs,
      publishedFaqs,
      users: totalUsers,
      messages: totalMessages,
      inboundMessages,
      outboundMessages,
    },
    topFaqs,
    recentUsers,
    activity: Object.entries(activityByDay)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  })
}
