// Logs view — show all incoming/outgoing messages
'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Inbox, Send, RefreshCw, ChevronLeft, ChevronRight, Radio } from 'lucide-react'
import { toast } from 'sonner'
import { UserHistoryDialog } from '@/components/admin/user-history-dialog'
import { timeAgo } from '@/lib/format'

type LogRow = {
  id: string
  maxUserId: number
  direction: 'in' | 'out'
  messageType: 'text' | 'callback' | 'command' | 'system'
  text: string | null
  payload: string | null
  matchedFaqId: string | null
  source: string | null
  durationMs: number | null
  llmOk: boolean | null
  maxApiStatus: number | null
  maxApiError: string | null
  searchText: string | null
  callbackPayload: string | null
  createdAt: string
  user: {
    id: string
    maxUserId: number
    firstName: string | null
    lastName: string | null
    username: string | null
  }
}

type LogsResp = {
  logs: LogRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
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

export function LogsView() {
  const [data, setData] = useState<LogsResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [direction, setDirection] = useState<string>('all')
  const [messageType, setMessageType] = useState<string>('all')
  const [source, setSource] = useState<string>('all')
  const [maxUserId, setMaxUserId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [historyUserId, setHistoryUserId] = useState<number | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [liveMode, setLiveMode] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (direction !== 'all') params.set('direction', direction)
      if (messageType !== 'all') params.set('messageType', messageType)
      if (source !== 'all') params.set('source', source)
      if (maxUserId.trim()) params.set('maxUserId', maxUserId.trim())
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo + 'T23:59:59')
      if (search.trim()) params.set('search', search.trim())

      const res = await api.get<LogsResp>(`/api/logs?${params.toString()}`)
      setData(res)
    } catch (e) {
      toast.error('Не удалось загрузить логи', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, direction, messageType, source, maxUserId, dateFrom, dateTo, search])

  useEffect(() => {
    load()
  }, [load])

  // Real-time SSE subscription for live mode
  useEffect(() => {
    if (!liveMode) return
    let active = true
    const es = new EventSource('/api/logs/stream')

    es.addEventListener('log', (e) => {
      if (!active) return
      try {
        const newLog = JSON.parse((e as MessageEvent).data)
        // Prepend to data.logs and increment total
        setData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            logs: [newLog, ...prev.logs].slice(0, prev.pageSize),
            total: prev.total + 1,
          }
        })
        // Show toast for incoming messages
        if (newLog.direction === 'in') {
          toast.success(`Новое сообщение от ${newLog.user?.firstName ?? 'ID:' + newLog.maxUserId}`, {
            description: newLog.text?.slice(0, 80) ?? '',
          })
        }
      } catch {
        // ignore parse errors
      }
    })

    es.onerror = () => {
      // Browser will auto-reconnect
    }

    return () => {
      active = false
      es.close()
    }
  }, [liveMode])

  function applyFilters() {
    setPage(1)
    load()
  }

  function userLabel(u: LogRow['user']) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ')
    return name || `ID: ${u.maxUserId}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Логи обращений</h2>
        <p className="text-sm text-muted-foreground">
          Журнал всех входящих и исходящих сообщений. Помогает отслеживать популярные темы
          и при необходимости переносить обращения к специалисту.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="w-36">
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger>
              <SelectValue placeholder="Направление" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все напр.</SelectItem>
              <SelectItem value="in">Входящие</SelectItem>
              <SelectItem value="out">Исходящие</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Select value={messageType} onValueChange={setMessageType}>
            <SelectTrigger>
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="text">Текст</SelectItem>
              <SelectItem value="callback">Кнопка</SelectItem>
              <SelectItem value="command">Команда</SelectItem>
              <SelectItem value="system">Системное</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
              <SelectValue placeholder="Источник" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все источники</SelectItem>
              <SelectItem value="system">Система</SelectItem>
              <SelectItem value="command">Команда</SelectItem>
              <SelectItem value="callback">Кнопка</SelectItem>
              <SelectItem value="search">Поиск FAQ</SelectItem>
              <SelectItem value="faq">Просмотр ответа</SelectItem>
              <SelectItem value="llm">ИИ-фолбэк</SelectItem>
              <SelectItem value="fallback">Не найдено</SelectItem>
              <SelectItem value="off_topic">Не по теме</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="MAX User ID"
          value={maxUserId}
          onChange={(e) => setMaxUserId(e.target.value)}
          className="w-40"
        />
        <Input
          type="date"
          placeholder="С даты"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-36"
        />
        <Input
          type="date"
          placeholder="По дату"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-36"
        />
        <Input
          placeholder="Поиск по тексту..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
        />
        <Button onClick={applyFilters} variant="default">
          Применить
        </Button>
        <Button
          variant={liveMode ? 'destructive' : 'outline'}
          onClick={() => setLiveMode((v) => !v)}
          className="flex items-center gap-1.5"
          title={liveMode ? 'Выключить live-режим' : 'Включить real-time обновление логов'}
        >
          <Radio className={`h-4 w-4 ${liveMode ? 'animate-pulse' : ''}`} />
          {liveMode ? 'Live: ON' : 'Live: OFF'}
        </Button>
        <Button onClick={load} variant="outline" className="flex items-center gap-1">
          <RefreshCw className="h-4 w-4" /> Обновить
        </Button>
        {data && (
          <div className="ml-auto px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md">
            Всего: <span className="font-medium text-foreground">{data.total}</span> · стр. {data.page} из {data.totalPages}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Загрузка логов...</div>
          ) : !data || data.logs.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Логи отсутствуют. Сообщения появятся здесь после того, как пользователи начнут
              взаимодействовать с ботом.
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-44">Время</TableHead>
                    <TableHead className="w-16 text-center">Напр.</TableHead>
                    <TableHead className="w-24 text-center">Тип</TableHead>
                    <TableHead className="w-28 text-center">Источник</TableHead>
                    <TableHead className="min-w-[200px]">Пользователь</TableHead>
                    <TableHead>Текст / Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => {
                    const hasError = log.maxApiError && log.maxApiStatus !== 200
                    const sourceColors: Record<string, string> = {
                      llm: 'bg-violet-50 border-violet-300 text-violet-800',
                      fallback: 'bg-amber-50 border-amber-300 text-amber-800',
                      off_topic: 'bg-rose-50 border-rose-300 text-rose-800',
                      faq: 'bg-indigo-50 border-indigo-300 text-indigo-800',
                      search: 'bg-sky-50 border-sky-300 text-sky-800',
                    }
                    return (
                    <TableRow key={log.id} className={hasError ? 'bg-red-50/50' : ''}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(log.createdAt).toLocaleString('ru-RU')}>
                        {timeAgo(log.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.direction === 'in' ? (
                          <Inbox className="h-4 w-4 text-blue-600 mx-auto" />
                        ) : (
                          <Send className="h-4 w-4 text-sky-600 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {messageTypeLabel[log.messageType] || log.messageType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {log.source && (
                          <Badge variant="outline" className={`text-[10px] ${sourceColors[log.source] || ''}`}>
                            {sourceLabel[log.source] || log.source}
                          </Badge>
                        )}
                        {log.durationMs != null && log.durationMs > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {log.durationMs < 1000 ? `${log.durationMs} мс` : `${(log.durationMs / 1000).toFixed(1)} с`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          className="text-left hover:bg-muted/50 rounded p-1 -m-1 transition-colors"
                          onClick={() => {
                            setHistoryUserId(log.user.maxUserId)
                            setHistoryOpen(true)
                          }}
                          title="Открыть историю диалога"
                        >
                          <div className="text-sm font-medium">{userLabel(log.user)}</div>
                          <div className="text-xs text-muted-foreground">
                            {log.user.username ? `@${log.user.username}` : ''} ID: {log.user.maxUserId}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm line-clamp-3">{log.text || '(пусто)'}</div>
                        {hasError && (
                          <div className="text-xs text-red-700 mt-1">
                            ⚠ MAX API HTTP {log.maxApiStatus}: {log.maxApiError}
                          </div>
                        )}
                        {log.matchedFaqId && (
                          <div className="text-xs text-blue-700 mt-1">
                            → matched FAQ: {log.matchedFaqId}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Назад
          </Button>
          <span className="text-sm">
            {page} / {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === data.totalPages}
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
          >
            Вперёд <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Export buttons row */}
      <div className="flex flex-wrap gap-2 items-center justify-between border-t pt-4">
        <div className="text-sm text-muted-foreground">
          Для отчёта можно выгрузить логи в CSV-формате с текущими фильтрами.
        </div>
        <a
          href={`/api/logs/export?${new URLSearchParams({
            ...(direction !== 'all' ? { direction } : {}),
            ...(messageType !== 'all' ? { messageType } : {}),
            ...(source !== 'all' ? { source } : {}),
            ...(maxUserId.trim() ? { maxUserId: maxUserId.trim() } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo: dateTo + 'T23:59:59' } : {}),
            ...(search.trim() ? { search: search.trim() } : {}),
          }).toString()}`}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors"
        >
          <Send className="h-4 w-4 rotate-180" /> Экспортировать в CSV
        </a>
      </div>

      <UserHistoryDialog
        maxUserId={historyUserId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  )
}
