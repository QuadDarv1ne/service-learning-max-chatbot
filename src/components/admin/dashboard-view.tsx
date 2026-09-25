// Dashboard view — statistics, recent activity
'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, MessageSquare, FileQuestion, FolderTree, Activity, TrendingUp } from 'lucide-react'
import { UserHistoryDialog } from '@/components/admin/user-history-dialog'
import { timeAgo } from '@/lib/format'

type Stats = {
  totals: {
    categories: number
    publishedCategories: number
    faqs: number
    publishedFaqs: number
    users: number
    messages: number
    inboundMessages: number
    outboundMessages: number
  }
  topFaqs: Array<{ id: string; question: string; viewCount: number; category: { title: string } }>
  recentUsers: Array<{
    id: string
    maxUserId: number
    firstName: string | null
    lastName: string | null
    username: string | null
    lastSeenAt: string
    createdAt: string
  }>
  activity: Array<{ date: string; in: number; out: number }>
}

const maxBarValue = (a: Stats['activity']) => Math.max(1, ...a.map((d) => Math.max(d.in, d.out)))

export function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [historyUserId, setHistoryUserId] = useState<number | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    api
      .get<{ error?: string } & Stats>('/api/stats')
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setStats(d as Stats)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Загрузка статистики...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700">
        Не удалось загрузить статистику: {error}
      </div>
    )
  }

  if (!stats) return null

  const maxBar = maxBarValue(stats.activity)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Дашборд</h2>
        <p className="text-sm text-muted-foreground">
          Сводная статистика по работе чат-бота программы «Обучение служением. Первые».
        </p>
      </div>

      {/* Totals grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FolderTree className="h-5 w-5" />}
          label="Категорий"
          value={stats.totals.categories}
          sub={`${stats.totals.publishedCategories} опубликовано`}
          color="bg-blue-500"
        />
        <StatCard
          icon={<FileQuestion className="h-5 w-5" />}
          label="FAQ-ответов"
          value={stats.totals.faqs}
          sub={`${stats.totals.publishedFaqs} опубликовано`}
          color="bg-indigo-500"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Пользователей"
          value={stats.totals.users}
          sub="обратились к боту"
          color="bg-cyan-500"
        />
        <StatCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="Сообщений"
          value={stats.totals.messages}
          sub={`${stats.totals.inboundMessages} входящих / ${stats.totals.outboundMessages} исходящих`}
          color="bg-sky-500"
        />
      </div>

      {/* Activity chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Активность за последние 7 дней
          </CardTitle>
          <CardDescription>Количество входящих и исходящих сообщений по дням</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.activity.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              За последние 7 дней активности не зафиксировано.
            </div>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {stats.activity.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end h-32 gap-0.5">
                    <div
                      className="w-full bg-blue-500 rounded-t-sm transition-all"
                      style={{ height: `${(d.in / maxBar) * 100}%` }}
                      title={`Входящие: ${d.in}`}
                    />
                    <div
                      className="w-full bg-sky-400 rounded-t-sm transition-all"
                      style={{ height: `${(d.out / maxBar) * 100}%` }}
                      title={`Исходящие: ${d.out}`}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(d.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
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
          </div>
        </CardContent>
      </Card>

      {/* Top FAQs + Recent users */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Популярные ответы
            </CardTitle>
            <CardDescription>Самые просматриваемые вопросы</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.topFaqs.length === 0 ? (
              <div className="text-sm text-muted-foreground">Пока нет просмотренных ответов.</div>
            ) : (
              stats.topFaqs.map((f, idx) => (
                <div
                  key={f.id}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-2">{f.question}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{f.category.title}</div>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">
                    {f.viewCount} просм.
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Недавние пользователи
            </CardTitle>
            <CardDescription>Последние обратившиеся к боту</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {stats.recentUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground">Пока ни один пользователь не обратился к боту.</div>
            ) : (
              stats.recentUsers.map((u) => (
                <button
                  key={u.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors w-full text-left"
                  onClick={() => {
                    setHistoryUserId(u.maxUserId)
                    setHistoryOpen(true)
                  }}
                  title="Открыть историю диалога"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#007aff] to-[#630eff] text-white text-sm font-semibold flex items-center justify-center">
                    {(u.firstName?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {[u.firstName, u.lastName].filter(Boolean).join(' ') || `ID: ${u.maxUserId}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.username ? `@${u.username} · ` : ''}ID: {u.maxUserId}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0" title={new Date(u.lastSeenAt).toLocaleString('ru-RU')}>
                    {timeAgo(u.lastSeenAt)}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <UserHistoryDialog
        maxUserId={historyUserId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  )
}

function StatCard({
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
