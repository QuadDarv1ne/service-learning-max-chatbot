// GET /api/users/[id] — fetch a single MAX user with their message history
// `id` here is the MaxUser.maxUserId (numeric)

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const maxUserId = parseInt(id, 10)
  if (Number.isNaN(maxUserId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const user = await db.maxUser.findUnique({
    where: { maxUserId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 500,
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({
    user: {
      id: user.id,
      maxUserId: user.maxUserId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      state: user.state,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
    },
    messages: user.messages,
  })
}
