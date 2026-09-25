// POST /api/broadcasts/process — check for due broadcasts and send them
// Can be called by external cron (every minute) or triggered manually
// Also automatically called on every webhook event (best-effort)

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { maxApi } from '@/lib/max-api'
import { isAuthenticated } from '@/lib/auth'
import { logAdmin } from '@/lib/admin-log'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  // Allow calls from cron (with secret header) OR authenticated admin
  const authHeader = req.headers.get('x-cron-secret')
  const cronSecret = process.env.CRON_SECRET

  if (authHeader && cronSecret && authHeader === cronSecret) {
    // Cron call — proceed
  } else if (await isAuthenticated()) {
    // Admin call — proceed
  } else {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Find due broadcasts
  const now = new Date()
  const dueBroadcasts = await db.broadcast.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: now },
    },
    take: 1, // process one at a time
  })

  if (dueBroadcasts.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No due broadcasts' })
  }

  const broadcast = dueBroadcasts[0]

  // Mark as sending
  await db.broadcast.update({
    where: { id: broadcast.id },
    data: { status: 'sending' },
  })

  // Get all users
  const users = await db.maxUser.findMany({
    select: { maxUserId: true },
    orderBy: { lastSeenAt: 'desc' },
    take: 10000, // safety cap
  })

  let sentCount = 0
  let failedCount = 0

  // Send to each user (respecting MAX API rate limit of 30 rps)
  for (const user of users) {
    try {
      const res = await maxApi.sendMessage({
        chat_id: user.maxUserId,
        text: broadcast.text,
        format: broadcast.format === 'html' ? 'html' : undefined,
      })
      if (res.ok) {
        sentCount++
      } else {
        failedCount++
      }
      // Small delay to respect rate limits (~30 rps = ~33ms between requests)
      await new Promise((resolve) => setTimeout(resolve, 40))
    } catch {
      failedCount++
    }
  }

  // Mark as sent
  await db.broadcast.update({
    where: { id: broadcast.id },
    data: {
      status: sentCount > 0 ? 'sent' : 'failed',
      sentAt: new Date(),
      sentCount,
      failedCount,
    },
  })

  await logAdmin({
    action: 'broadcast_sent',
    resource: broadcast.id,
    detail: `Рассылка отправлена: ${sentCount} успешно, ${failedCount} с ошибкой из ${users.length} пользователей`,
  })

  return NextResponse.json({
    ok: true,
    processed: 1,
    broadcastId: broadcast.id,
    sentCount,
    failedCount,
    totalUsers: users.length,
  })
}
