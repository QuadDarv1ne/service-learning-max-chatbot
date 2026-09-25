// GET /api/logs/stream — Server-Sent Events endpoint for real-time log updates
// Sends a new SSE event every time a webhook processes a message
//
// Flow:
// 1. Client subscribes: GET /api/logs/stream (with auth cookie)
// 2. Server responds with Content-Type: text/event-stream
// 3. Server polls the DB for new MessageLog entries every 2 seconds
// 4. For each new entry since the last seen createdAt, sends an SSE event
// 5. Client receives events with JSON payload
//
// Heartbeat: every 30 seconds sends a comment to keep connection alive

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// We need to disable Next.js response buffering for streaming
export const maxDuration = 60 * 5 // 5 minutes max per connection

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let lastSeen = new Date()
      let closed = false

      // Initial comment to confirm connection
      controller.enqueue(encoder.encode(`: connected at ${new Date().toISOString()}\n\n`))

      // Heartbeat interval — keep connection alive
      const heartbeat = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`))
        } catch {
          // Stream closed by client
        }
      }, 30000)

      // Polling interval — check for new logs
      const poll = setInterval(async () => {
        if (closed) return
        try {
          const newLogs = await db.messageLog.findMany({
            where: { createdAt: { gt: lastSeen } },
            orderBy: { createdAt: 'asc' },
            take: 50, // limit per poll
            include: {
              user: {
                select: {
                  id: true,
                  maxUserId: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                },
              },
            },
          })

          if (newLogs.length > 0) {
            lastSeen = newLogs[newLogs.length - 1].createdAt
            for (const log of newLogs) {
              const event = {
                id: log.id,
                timestamp: log.createdAt,
                direction: log.direction,
                source: log.source,
                messageType: log.messageType,
                text: log.text,
                maxUserId: log.maxUserId,
                user: log.user,
                durationMs: log.durationMs,
                maxApiStatus: log.maxApiStatus,
                maxApiError: log.maxApiError,
                matchedFaqId: log.matchedFaqId,
              }
              const data = JSON.stringify(event)
              controller.enqueue(encoder.encode(`event: log\ndata: ${data}\n\n`))
            }
          }
        } catch (e) {
          // ignore polling errors — keep stream alive
          console.error('SSE poll error:', e)
        }
      }, 2000) // 2 seconds

      // Listen for client disconnect
      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(heartbeat)
        clearInterval(poll)
        try {
          controller.close()
        } catch {
          // already closed
        }
      })

      // Auto-close after max duration (5 min) — client should reconnect
      setTimeout(() => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        clearInterval(poll)
        try {
          controller.enqueue(encoder.encode(`event: end\ndata: {"reason":"max_duration"}\n\n`))
          controller.close()
        } catch {
          // already closed
        }
      }, 5 * 60 * 1000)
    },
    cancel() {
      // Called when consumer cancels the stream
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  })
}
