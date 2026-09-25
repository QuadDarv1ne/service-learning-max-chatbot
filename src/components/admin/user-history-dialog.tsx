// User history dialog — shown when admin clicks on a user in logs/stats
'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Inbox, Send, Bot } from 'lucide-react'

type UserHistory = {
  user: {
    id: string
    maxUserId: number
    firstName: string | null
    lastName: string | null
    username: string | null
    state: string | null
    createdAt: string
    lastSeenAt: string
  }
  messages: Array<{
    id: string
    direction: 'in' | 'out'
    messageType: string
    text: string | null
    matchedFaqId: string | null
    payload: string | null
    createdAt: string
    source: string | null
    durationMs: number | null
    llmOk: boolean | null
    maxApiStatus: number | null
    maxApiError: string | null
    searchText: string | null
    callbackPayload: string | null
  }>
}

const messageTypeLabel: Record<string, string> = {
  text: 'Текст',
  callback: 'Кнопка',
  command: 'Команда',
  system: 'Системное',
}

const sourceLabel: Record<string, string> = {
  system: 'Система',
  command: 'Команда',
  callback: 'Кнопка',
  search: 'Поиск FAQ',
  faq: 'Просмотр ответа',
  llm: 'ИИ',
  fallback: 'Не найдено',
  off_topic: 'Не по теме',
}

function formatDuration(ms: number | null): string {
  if (ms == null) return ''
  if (ms < 1000) return `${ms} мс`
  return `${(ms / 1000).toFixed(1)} с`
}

function isLlmMessage(payload: string | null): boolean {
  if (!payload) return false
  try {
    const p = JSON.parse(payload)
    return Boolean(p?.llm)
  } catch {
    return false
  }
}

export function UserHistoryDialog({
  maxUserId,
  open,
  onOpenChange,
}: {
  maxUserId: number | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [data, setData] = useState<UserHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || maxUserId === null) {
      return
    }
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api
      .get<UserHistory>(`/api/users/${maxUserId}`)
      .then((d) => {
        if (active) setData(d)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, maxUserId])

  // Clear local state when dialog closes
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null)
      setError(null)
    }
  }, [open])

  const user = data?.user
  const fullName =
    user && (user.firstName || user.lastName)
      ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
      : user
        ? `ID: ${user.maxUserId}`
        : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>История диалога</DialogTitle>
          <DialogDescription>
            Все сообщения пользователя {fullName}
            {user?.username ? ` (@${user.username})` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-8 text-center text-muted-foreground">Загрузка...</div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {data.messages.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                У пользователя пока нет сообщений.
              </div>
            ) : (
              data.messages.map((m) => {
                const incoming = m.direction === 'in'
                const llm = isLlmMessage(m.payload) || m.source === 'llm'
                const hasMaxApiError = m.maxApiError && m.maxApiStatus !== 200
                const duration = formatDuration(m.durationMs)
                return (
                  <div
                    key={m.id}
                    className={`flex gap-2 ${incoming ? 'justify-start' : 'justify-end'}`}
                  >
                    {incoming && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#007aff] to-[#630eff] text-white flex items-center justify-center text-xs font-semibold">
                        {(user?.firstName?.[0] ?? 'U').toUpperCase()}
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                        incoming
                          ? 'bg-muted text-foreground'
                          : llm
                            ? 'bg-gradient-to-br from-violet-100 to-purple-100 border border-violet-200'
                            : hasMaxApiError
                              ? 'bg-red-50 border border-red-300'
                              : 'bg-blue-600 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-xs opacity-75 flex-wrap">
                        {incoming ? (
                          <Inbox className="h-3 w-3" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        <span>{new Date(m.createdAt).toLocaleString('ru-RU')}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {messageTypeLabel[m.messageType] || m.messageType}
                        </Badge>
                        {m.source && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 h-4 bg-sky-50 border-sky-300 text-sky-800"
                          >
                            {sourceLabel[m.source] || m.source}
                          </Badge>
                        )}
                        {llm && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 h-4 bg-violet-50 border-violet-300 text-violet-800"
                          >
                            <Bot className="h-2.5 w-2.5 mr-0.5" /> ИИ
                          </Badge>
                        )}
                        {duration && !incoming && (
                          <span className="text-[10px]">· {duration}</span>
                        )}
                        {hasMaxApiError && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                            HTTP {m.maxApiStatus}
                          </Badge>
                        )}
                      </div>
                      <div
                        className={`text-sm whitespace-pre-wrap break-words ${
                          incoming ? '' : llm ? 'text-violet-950' : hasMaxApiError ? 'text-red-900' : ''
                        }`}
                      >
                        {m.text || '(пусто)'}
                      </div>
                      {hasMaxApiError && m.maxApiError && (
                        <div className="mt-1 text-[10px] text-red-700 border-t border-red-200 pt-1">
                          Ошибка MAX API: {m.maxApiError}
                        </div>
                      )}
                    </div>
                    {!incoming && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
