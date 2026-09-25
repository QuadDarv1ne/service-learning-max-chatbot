// Analytics view — comprehensive metrics, funnel, top queries, response time
'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp,
  Users,
  MessageSquare,
  Bot,
  Clock,
  AlertTriangle,
  Target,
  ListChecks,
  Activity,
  RefreshCw,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'

type AnalyticsData = {
  period: string
  groupBy: string
  startDate: string | null
  funnel: {
    incoming: number
    outgoing: number
    callbacks: number
    commands: number
    faqMatched: number
    llmHandled: number
    llmFailures: number
    fallbackShown: number
    offTopicBlocked: number
    maxApiErrors: number
  }
  metrics: {
    faqMatchRate: number
    llmRate: number
    fallbackRate: number
    offTopicRate: number
    llmSuccessRate: number
    uniqueUsers: number
    avgMessagesPerUser: number
  }
  activity: Array<{ date: string; in: number; out: number; llm: number }>
  topQueries: Array<{ query: string; count: number }>
  topCategories: Array<{ id: string; title: string; itemCount: number; totalViews: number }>
  topFaqs: Array<{ id: string; question: string; viewCount: number; category: { title: string } }>
  responseTime: { avgMs: number; minMs: number; maxMs: number; p95Ms: number; samples: number }
  sourceDistribution: Record<string, number>
  unansweredQueries: Array<{ query: string; count: number; lastAsked: string; sampleUser: number }>
  apiFailures: Array<{ maxApiStatus: number; maxApiError: string; createdAt: string }>
  cohortAnalysis: {
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
  } | null
  forecast: {
    next7Days: number
    avgPerDay: number
    trend: 'up' | 'down' | 'stable'
    trendPct: number
    confidence: 'low' | 'medium' | 'high'
  } | null
  hourlyDistribution: number[]
}

const sourceLabel: Record<string, string> = {
  system: 'Система',
  command: 'Команды',
  callback: 'Кнопки',
  search: 'Поиск FAQ',
  faq: 'Просмотр ответа',
  llm: 'ИИ-фолбэк',
  fallback: 'Не найдено',
  off_topic: 'Не по теме',
}

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('7d')
  const [groupBy, setGroupBy] = useState('day')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await api.get<AnalyticsData>(
        `/api/analytics?period=${period}&groupBy=${groupBy}`,
      )
      setData(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [period, groupBy])

  useEffect(() => {
    load()
  }, [load])

  const maxActivity = data
    ? Math.max(1, ...data.activity.map((d) => Math.max(d.in, d.out)))
    : 1

  if (loading && !data) {
    return (
      <div className="py-12 text-center text-muted-foreground">Загрузка аналитики...</div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700">
        Не удалось загрузить аналитику: {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Аналитика</h2>
          <p className="text-sm text-muted-foreground">
            Воронка обращений, источники ответов, время отклика, популярные запросы,
            запросы без ответа для добавления в базу.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <div className="w-36">
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">По часам</SelectItem>
                <SelectItem value="day">По дням</SelectItem>
                <SelectItem value="week">По неделям</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={load} title="Обновить">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {data.startDate && (
        <div className="text-xs text-muted-foreground">
          Период: с {new Date(data.startDate).toLocaleDateString('ru-RU')} по{' '}
          {new Date().toLocaleDateString('ru-RU')}
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="Входящих запросов"
          value={data.funnel.incoming}
          sub={`${data.metrics.uniqueUsers} уникальных пользователей`}
          color="bg-blue-500"
        />
        <MetricCard
          icon={<Target className="h-5 w-5" />}
          label="Найдено в FAQ"
          value={data.funnel.faqMatched}
          sub={`${data.metrics.faqMatchRate}% от всех запросов`}
          color="bg-indigo-500"
        />
        <MetricCard
          icon={<Bot className="h-5 w-5" />}
          label="Обработано ИИ"
          value={data.funnel.llmHandled}
          sub={`${data.metrics.llmRate}% запросов · успешность ${data.metrics.llmSuccessRate}%`}
          color="bg-violet-500"
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Без ответа"
          value={data.funnel.fallbackShown + data.funnel.offTopicBlocked}
          sub={`${data.metrics.fallbackRate}% fallback · ${data.metrics.offTopicRate}% off-topic`}
          color="bg-amber-500"
        />
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Воронка обработки запросов
          </CardTitle>
          <CardDescription>
            Как распределяются входящие запросы по типам ответов бота
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <FunnelRow
              label="Входящие сообщения"
              value={data.funnel.incoming}
              total={data.funnel.incoming}
              color="bg-blue-500"
            />
            <FunnelRow
              label="Нажатия кнопок (callbacks)"
              value={data.funnel.callbacks}
              total={Math.max(data.funnel.incoming, 1)}
              color="bg-cyan-500"
            />
            <FunnelRow
              label="Команды (/start, /help)"
              value={data.funnel.commands}
              total={Math.max(data.funnel.incoming, 1)}
              color="bg-sky-500"
            />
            <FunnelRow
              label="Найдено в FAQ (search)"
              value={data.funnel.faqMatched}
              total={Math.max(data.funnel.incoming, 1)}
              color="bg-indigo-500"
            />
            <FunnelRow
              label="Обработано ИИ-ассистентом"
              value={data.funnel.llmHandled}
              total={Math.max(data.funnel.incoming, 1)}
              color="bg-violet-500"
            />
            <FunnelRow
              label="Fallback (нет точного ответа)"
              value={data.funnel.fallbackShown}
              total={Math.max(data.funnel.incoming, 1)}
              color="bg-amber-500"
            />
            <FunnelRow
              label="Off-topic (не по программе)"
              value={data.funnel.offTopicBlocked}
              total={Math.max(data.funnel.incoming, 1)}
              color="bg-rose-500"
            />
            <FunnelRow
              label="Ошибки отправки в MAX API"
              value={data.funnel.maxApiErrors}
              total={Math.max(data.funnel.outgoing, 1)}
              color="bg-red-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Activity chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Активность за период
          </CardTitle>
          <CardDescription>
            Входящие, исходящие и ИИ-ответы по {groupBy === 'hour' ? 'часам' : groupBy === 'week' ? 'неделям' : 'дням'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.activity.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              За выбранный период активности не зафиксировано.
            </div>
          ) : (
            <div className="flex items-end gap-1 h-40 overflow-x-auto">
              {data.activity.map((d) => (
                <div
                  key={d.date}
                  className="flex-1 min-w-[24px] flex flex-col items-center gap-1"
                  title={`${d.date}\nВх: ${d.in}\nИсх: ${d.out}\nИИ: ${d.llm}`}
                >
                  <div className="w-full flex flex-col justify-end h-32 gap-0.5">
                    <div
                      className="w-full bg-blue-500 rounded-t-sm transition-all"
                      style={{ height: `${(d.in / maxActivity) * 100}%` }}
                    />
                    <div
                      className="w-full bg-sky-400 rounded-t-sm transition-all"
                      style={{ height: `${(d.out / maxActivity) * 100}%` }}
                    />
                    {d.llm > 0 && (
                      <div
                        className="w-full bg-violet-400 rounded-t-sm transition-all"
                        style={{ height: `${(d.llm / maxActivity) * 100}%` }}
                      />
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {groupBy === 'hour'
                      ? new Date(d.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                      : new Date(d.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-500 rounded-sm" />
              Входящие
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-sky-400 rounded-sm" />
              Исходящие
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-violet-400 rounded-sm" />
              ИИ-ответы
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Response time + source distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> Время ответа бота
            </CardTitle>
            <CardDescription>От входящего сообщения до исходящего</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <TimeStat label="Среднее" value={data.responseTime.avgMs} />
              <TimeStat label="Медиана (p95)" value={data.responseTime.p95Ms} />
              <TimeStat label="Минимум" value={data.responseTime.minMs} />
              <TimeStat label="Максимум" value={data.responseTime.maxMs} />
            </div>
            <div className="text-xs text-muted-foreground pt-2 border-t mt-2">
              Замеров: {data.responseTime.samples}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" /> Распределение по источникам
            </CardTitle>
            <CardDescription>Чем бот отвечал на запросы</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-48 overflow-y-auto">
            {Object.entries(data.sourceDistribution).length === 0 ? (
              <div className="text-sm text-muted-foreground">Пока нет данных.</div>
            ) : (
              Object.entries(data.sourceDistribution)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => {
                  const total = Object.values(data.sourceDistribution).reduce((a, b) => a + b, 0)
                  const pct = Math.round((count / total) * 100)
                  return (
                    <div key={source} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{sourceLabel[source] || source}</span>
                        <span className="text-muted-foreground">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top queries + Top categories */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> Топ запросов пользователей
            </CardTitle>
            <CardDescription>Что чаще всего спрашивали</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {data.topQueries.length === 0 ? (
              <div className="text-sm text-muted-foreground">Пока нет запросов.</div>
            ) : (
              data.topQueries.map((q, i) => (
                <div key={q.query} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm line-clamp-2">{q.query}</div>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">
                    ×{q.count}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" /> Популярные разделы
            </CardTitle>
            <CardDescription>По сумме просмотров ответов</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {data.topCategories.length === 0 ? (
              <div className="text-sm text-muted-foreground">Пока нет просмотров.</div>
            ) : (
              data.topCategories.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-1">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.itemCount} ответов</div>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">
                    {c.totalViews} просм.
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top FAQs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" /> Самые просматриваемые ответы
          </CardTitle>
          <CardDescription>
            Если какой-то ответ не пользуется спросом — возможно, его стоит
            переформулировать или удалить
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.topFaqs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Просмотры появятся, когда пользователи начнут открывать ответы.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {data.topFaqs.map((f, i) => (
                <div key={f.id} className="flex items-start gap-2 p-2 rounded border">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-2">{f.question}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{f.category.title}</div>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">
                    {f.viewCount} просм.
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hourly distribution — peak hours */}
      {data.hourlyDistribution && data.hourlyDistribution.some((c) => c > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Распределение по часам суток
            </CardTitle>
            <CardDescription>
              Когда пользователи обращаются чаще всего (UTC). Пиковые часы помогут планировать обновления базы.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const max = Math.max(1, ...data.hourlyDistribution)
              const peakHour = data.hourlyDistribution.indexOf(Math.max(...data.hourlyDistribution))
              return (
                <>
                  <div className="flex items-end gap-0.5 h-32 overflow-x-auto">
                    {data.hourlyDistribution.map((count, hour) => (
                      <div
                        key={hour}
                        className="flex-1 min-w-[12px] flex flex-col items-center gap-1"
                        title={`${hour}:00 — ${count} сообщений`}
                      >
                        <div className="w-full flex flex-col justify-end h-24">
                          <div
                            className={`w-full rounded-t-sm transition-all ${
                              hour === peakHour ? 'bg-blue-600' : 'bg-blue-300 dark:bg-blue-800'
                            }`}
                            style={{ height: `${(count / max) * 100}%` }}
                          />
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {hour % 3 === 0 ? `${hour}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Пиковый час: <strong className="text-blue-600">{peakHour}:00</strong> (UTC) — {data.hourlyDistribution[peakHour]} сообщений.
                    {' '}
                    Для московского времени (UTC+3) прибавьте 3 часа.
                  </div>
                </>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* Forecast — predicted load for next 7 days */}
      {data.forecast && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> Прогноз нагрузки на следующую неделю
            </CardTitle>
            <CardDescription>
              Простой линейный прогноз на основе данных за последние 14 дней.
              Точность: {data.forecast.confidence === 'high' ? 'высокая (14 дней)' : data.forecast.confidence === 'medium' ? 'средняя (7+ дней)' : 'низкая (< 7 дней)'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Прогноз на 7 дней</div>
                <div className="text-2xl font-bold">{data.forecast.next7Days}</div>
                <div className="text-xs text-muted-foreground">входящих сообщений</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Среднее в день</div>
                <div className="text-2xl font-bold">{data.forecast.avgPerDay}</div>
                <div className="text-xs text-muted-foreground">сообщений</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Тренд</div>
                <div className="text-2xl font-bold flex items-center gap-1">
                  {data.forecast.trend === 'up' && <span className="text-green-600">↑</span>}
                  {data.forecast.trend === 'down' && <span className="text-red-600">↓</span>}
                  {data.forecast.trend === 'stable' && <span className="text-muted-foreground">→</span>}
                  <span>
                    {data.forecast.trend === 'up' ? 'Рост' : data.forecast.trend === 'down' ? 'Спад' : 'Стабильно'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{data.forecast.trendPct > 0 ? '+' : ''}{data.forecast.trendPct}% к предыдущей неделе</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Уверенность</div>
                <div className="text-lg font-semibold">
                  {data.forecast.confidence === 'high' ? '🟢 Высокая' : data.forecast.confidence === 'medium' ? '🟡 Средняя' : '🔴 Низкая'}
                </div>
                <div className="text-xs text-muted-foreground">основан на выборке</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              💡 Прогноз поможет заранее пополнить базу знаний и подготовиться к наплыву обращений.
              При росте тренда — добавьте новые ответы в раздел "Запросы без ответа".
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cohort retention analysis */}
      {data.cohortAnalysis && data.cohortAnalysis.cohortSize > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Возвращаемость пользователей (когортный анализ)
            </CardTitle>
            <CardDescription>
              Процент пользователей, вернувшихся к боту через 1/3/7/14 дней после первого обращения.
              Когорт: {data.cohortAnalysis.cohortSize} новых пользователей с{' '}
              {new Date(data.cohortAnalysis.periodStart).toLocaleDateString('ru-RU')}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <CohortCard label="День 1" count={data.cohortAnalysis.d1Retained} total={data.cohortAnalysis.cohortSize} rate={data.cohortAnalysis.d1Rate} color="bg-blue-500" />
              <CohortCard label="День 3" count={data.cohortAnalysis.d3Retained} total={data.cohortAnalysis.cohortSize} rate={data.cohortAnalysis.d3Rate} color="bg-indigo-500" />
              <CohortCard label="День 7" count={data.cohortAnalysis.d7Retained} total={data.cohortAnalysis.cohortSize} rate={data.cohortAnalysis.d7Rate} color="bg-cyan-500" />
              <CohortCard label="День 14" count={data.cohortAnalysis.d14Retained} total={data.cohortAnalysis.cohortSize} rate={data.cohortAnalysis.d14Rate} color="bg-sky-500" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              💡 Норма возвращаемости для информационных ботов: D1 — 15-30%, D7 — 5-15%, D14 — 2-8%.
              Если ниже — возможно, бот недостаточно полезен, нужно расширять базу знаний.
            </div>
          </CardContent>
        </Card>
      )}

      {/* API failures */}
      {data.apiFailures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Последние ошибки MAX API
            </CardTitle>
            <CardDescription>
              Проблемы с отправкой сообщений в MAX — проверьте токен и webhook
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-60 overflow-y-auto">
            {data.apiFailures.map((f, i) => (
              <div key={i} className="text-sm border-l-2 border-red-400 pl-3 py-1">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">HTTP {f.maxApiStatus}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(f.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
                <div className="text-xs mt-1 text-red-700">{f.maxApiError}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub: string
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${color} text-white flex items-center justify-center`}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold leading-none mt-0.5">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FunnelRow({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          <span className="font-medium">{value}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-xs text-muted-foreground w-12 text-right">{pct}%</div>
    </div>
  )
}

function TimeStat({ label, value }: { label: string; value: number }) {
  const fmt = (ms: number) => {
    if (ms < 1000) return `${ms} мс`
    return `${(ms / 1000).toFixed(1)} с`
  }
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{fmt(value)}</div>
    </div>
  )
}

function CohortCard({
  label,
  count,
  total,
  rate,
  color,
}: {
  label: string
  count: number
  total: number
  rate: number
  color: string
}) {
  return (
    <div className="rounded-md border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`flex-shrink-0 w-2 h-2 rounded-full ${color}`} />
      </div>
      <div className="text-2xl font-bold">{rate}%</div>
      <div className="text-xs text-muted-foreground">
        {count} из {total} пользователей
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  )
}
