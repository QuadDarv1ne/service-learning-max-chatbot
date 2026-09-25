// Audit log view — admin actions history
'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RefreshCw, ChevronLeft, ChevronRight, ShieldCheck, ShieldX, Download } from 'lucide-react'
import { toast } from 'sonner'

type AuditRow = {
  id: string
  action: string
  resource: string | null
  detail: string | null
  ipHash: string | null
  userAgent: string | null
  ok: boolean
  error: string | null
  createdAt: string
}

type AuditResp = {
  logs: AuditRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const actionLabel: Record<string, string> = {
  login: 'Вход в админку',
  logout: 'Выход',
  login_failed: 'Ошибка входа',
  settings_update: 'Обновление настроек',
  bot_token_set: 'Установка токена',
  category_create: 'Создание категории',
  category_update: 'Обновление категории',
  category_delete: 'Удаление категории',
  faq_create: 'Создание ответа',
  faq_update: 'Обновление ответа',
  faq_delete: 'Удаление ответа',
  webhook_subscribe: 'Подписка webhook',
  test_send: 'Тестовая отправка',
  knowledge_import: 'Импорт базы',
  knowledge_export: 'Экспорт базы',
  commands_register: 'Регистрация команд',
  command_create: 'Создание команды',
  command_update: 'Обновление команды',
  command_delete: 'Удаление команды',
  audit_export: 'Экспорт журнала',
}

export function AuditView() {
  const [data, setData] = useState<AuditResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [action, setAction] = useState('all')
  const [okFilter, setOkFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (action !== 'all') params.set('action', action)
      if (okFilter !== 'all') params.set('ok', okFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo + 'T23:59:59')

      const res = await api.get<AuditResp>(`/api/admin-actions?${params.toString()}`)
      setData(res)
    } catch (e) {
      toast.error('Не удалось загрузить журнал', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, action, okFilter, dateFrom, dateTo])

  useEffect(() => {
    load()
  }, [load])

  function applyFilters() {
    setPage(1)
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Журнал админ-действий</h2>
        <p className="text-sm text-muted-foreground">
          Кто и что менял в админ-панели: входы, изменения настроек, создание и
          удаление категорий и ответов, подписка webhook, импорт/экспорт базы.
          IP-адреса хранятся в виде хеша — для приватности.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="w-56">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все действия</SelectItem>
              {Object.entries(actionLabel).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={okFilter} onValueChange={setOkFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Любой статус</SelectItem>
              <SelectItem value="true">Успешно</SelectItem>
              <SelectItem value="false">С ошибкой</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40"
          placeholder="С даты"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40"
          placeholder="По дату"
        />
        <Button onClick={applyFilters} variant="default">
          Применить
        </Button>
        <Button onClick={load} variant="outline" size="icon">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <a
          href={`/api/admin-actions/export?${new URLSearchParams({
            ...(action !== 'all' ? { action } : {}),
            ...(okFilter !== 'all' ? { ok: okFilter } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo: dateTo + 'T23:59:59' } : {}),
          }).toString()}`}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors"
          title="Экспорт в CSV"
        >
          <Download className="h-4 w-4" /> CSV
        </a>
        {data && (
          <div className="ml-auto px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md">
            Всего: <span className="font-medium text-foreground">{data.total}</span> · стр. {data.page} из {data.totalPages}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
          ) : !data || data.logs.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Журнал пуст. Действия появятся здесь после того, как кто-то начнёт
              пользоваться админ-панелью.
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-44">Время</TableHead>
                    <TableHead className="w-12 text-center">OK</TableHead>
                    <TableHead className="w-56">Действие</TableHead>
                    <TableHead>Детали</TableHead>
                    <TableHead className="w-40">IP-хеш</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-center">
                        {l.ok ? (
                          <ShieldCheck className="h-4 w-4 text-blue-600 mx-auto" />
                        ) : (
                          <ShieldX className="h-4 w-4 text-red-600 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={l.ok ? 'outline' : 'destructive'} className="text-xs">
                          {actionLabel[l.action] || l.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{l.detail || l.error || '(без описания)'}</div>
                        {l.resource && (
                          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                            resource: {l.resource}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {l.ipHash ? l.ipHash.slice(0, 12) + '…' : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
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
    </div>
  )
}
