// Unanswered queries view — incoming queries that bot couldn't match in FAQ
// Useful for staff to identify gaps in the knowledge base
'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RefreshCw, Search, AlertCircle, Lightbulb, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { FaqCreateDialog } from '@/components/admin/faq-create-dialog'

type UnansweredItem = {
  query: string
  count: number
  lastAsked: string
  sampleUser: number
}

type AnalyticsData = {
  unansweredQueries: UnansweredItem[]
  funnel: { incoming: number; llmHandled: number; fallbackShown: number }
}

export function UnansweredView() {
  const [data, setData] = useState<UnansweredItem[]>([])
  const [funnel, setFunnel] = useState<{
    incoming: number
    llmHandled: number
    fallbackShown: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('30d')
  const [search, setSearch] = useState('')
  const [minCount, setMinCount] = useState('1')
  const [createFaqOpen, setCreateFaqOpen] = useState(false)
  const [prefillQuestion, setPrefillQuestion] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await api.get<AnalyticsData>(`/api/analytics?period=${period}`)
      setData(d.unansweredQueries)
      setFunnel(d.funnel)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    load()
  }, [load])

  const filtered = data.filter((q) => {
    if (search && !q.query.toLowerCase().includes(search.toLowerCase())) return false
    if (minCount && q.count < parseInt(minCount, 10)) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Запросы без ответа</h2>
        <p className="text-sm text-muted-foreground">
          Эти вопросы пользователи задавали боту, но в базе знаний не нашлось
          подходящего ответа (бот ответил через ИИ или показал fallback).
          Анализируйте этот список и добавляйте недостающие ответы в базу.
        </p>
      </div>

      {/* Summary cards */}
      {funnel && (
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Всего входящих за период</div>
              <div className="text-2xl font-semibold">{funnel.incoming}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Обработано ИИ (LLM)</div>
              <div className="text-2xl font-semibold text-violet-700">{funnel.llmHandled}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Не отвечено (fallback)</div>
              <div className="text-2xl font-semibold text-amber-700">{funnel.fallbackShown}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tip */}
      <div className="rounded-md bg-blue-50 border border-blue-200 p-4 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-blue-900 font-medium">
          <Lightbulb className="h-4 w-4" /> Как использовать эту страницу
        </div>
        <ul className="list-disc list-inside space-y-1 text-blue-800">
          <li>Запросы отсортированы по частоте — самые частые сверху</li>
          <li>Если один и тот же вопрос задают несколько раз — это сигнал, что ответ нужно добавить в базу</li>
          <li>Перейдите в раздел "База знаний" и создайте новый FAQ с этим вопросом</li>
          <li>После добавления похожие запросы будут находить ответ в FAQ, а не уходить в fallback</li>
        </ul>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="w-40">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Последние 7 дней</SelectItem>
              <SelectItem value="30d">Последние 30 дней</SelectItem>
              <SelectItem value="90d">Последние 90 дней</SelectItem>
              <SelectItem value="all">Всё время</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по тексту запроса..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="w-32">
          <Select value={minCount} onValueChange={setMinCount}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Все запросы</SelectItem>
              <SelectItem value="2">≥ 2 раз</SelectItem>
              <SelectItem value="3">≥ 3 раз</SelectItem>
              <SelectItem value="5">≥ 5 раз</SelectItem>
              <SelectItem value="10">≥ 10 раз</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="icon" onClick={load} title="Обновить">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          Найдено: <span className="font-medium text-foreground">{filtered.length}</span> из {data.length}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700">
          Не удалось загрузить: {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <div className="text-sm text-muted-foreground">
                {data.length === 0
                  ? 'Отлично! Все запросы бота находили ответ в базе знаний.'
                  : 'Ничего не найдено по фильтрам.'}
              </div>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12">№</TableHead>
                    <TableHead>Запрос</TableHead>
                    <TableHead className="text-center">Раз</TableHead>
                    <TableHead className="text-right">Последний раз</TableHead>
                    <TableHead className="text-right">Пользователь</TableHead>
                    <TableHead className="w-32 text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((q, i) => (
                    <TableRow key={q.query + i}>
                      <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="text-sm">{q.query}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={q.count > 5 ? 'destructive' : q.count > 1 ? 'secondary' : 'outline'}>
                          ×{q.count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(q.lastAsked).toLocaleString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground font-mono">
                        ID: {q.sampleUser}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex items-center gap-1 ml-auto"
                          onClick={() => {
                            setPrefillQuestion(q.query)
                            setCreateFaqOpen(true)
                          }}
                          title="Создать FAQ с этим вопросом"
                        >
                          <Plus className="h-3 w-3" /> В базу
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FaqCreateDialog
        open={createFaqOpen}
        onOpenChange={setCreateFaqOpen}
        prefillQuestion={prefillQuestion}
        onSuccess={() => {
          toast.success('Запрос добавлен в базу. Перезагрузите список.')
          load()
        }}
      />
    </div>
  )
}
