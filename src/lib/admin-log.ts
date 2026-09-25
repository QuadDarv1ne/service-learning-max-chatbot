// Admin action logger — records audit trail of admin panel actions
// Privacy-friendly: stores IP hash (not raw IP)

import { db } from '@/lib/db'
import { headers } from 'next/headers'
import crypto from 'crypto'

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

// Async variant that reads the headers from the current request scope
export async function getClientIpAsync(): Promise<string | null> {
  try {
    const h = await headers()
    return (
      h.get('x-forwarded-for')?.split(',')[0].trim() ||
      h.get('x-real-ip') ||
      h.get('cf-connecting-ip') ||
      null
    )
  } catch {
    return null
  }
}

export async function getClientUserAgentAsync(): Promise<string | null> {
  try {
    const h = await headers()
    return h.get('user-agent') ?? null
  } catch {
    return null
  }
}

type LogAdminParams = {
  action: string
  resource?: string
  detail?: string
  ok?: boolean
  error?: string
}

// Must be awaited (reads headers async)
export async function logAdmin(params: LogAdminParams): Promise<void> {
  try {
    const ip = await getClientIpAsync()
    const ua = await getClientUserAgentAsync()

    await db.adminActionLog.create({
      data: {
        action: params.action,
        resource: params.resource ?? null,
        detail: params.detail ?? null,
        ok: params.ok ?? true,
        error: params.error ?? null,
        ipHash: ip ? hashIp(ip) : null,
        userAgent: ua ? ua.slice(0, 500) : null,
      },
    })
  } catch (e) {
    // Don't break the main flow if audit log fails
    console.error('Failed to log admin action:', e)
  }
}

// Helper: get list of admin actions with filters + pagination
export type AdminActionFilter = {
  action?: string
  ok?: boolean
  dateFrom?: Date
  dateTo?: Date
  page: number
  pageSize: number
}

export async function listAdminActions(filter: AdminActionFilter) {
  const where = {
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.ok !== undefined ? { ok: filter.ok } : {}),
    ...(filter.dateFrom || filter.dateTo
      ? {
          createdAt: {
            ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
            ...(filter.dateTo ? { lte: filter.dateTo } : {}),
          },
        }
      : {}),
  }

  const [logs, total] = await Promise.all([
    db.adminActionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    db.adminActionLog.count({ where }),
  ])

  return { logs, total, page: filter.page, pageSize: filter.pageSize, totalPages: Math.ceil(total / filter.pageSize) }
}
