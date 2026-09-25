// Broadcasts panel — embedded into Settings view
'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, Megaphone, RefreshCw, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

type Broadcast = {
  id: string
  text: string
  format: string
  status: string
  scheduledAt: string
  sentAt: string | null
  sentCount: number
  failedCount: number
  createdAt: string
}

const statusLabel: Record<string, string> = {
  scheduled: 'Запланирована',
  sending: 'Отправляется...',
  sent: 'Отправлена',
  cancelled: 'Отменена',
  failed: 'Ошибка',
}

const statusColor: Record<string, string> = {
  scheduled: 'bg-amber-100 text-amber-800 border-amber-300',
  sending: 'bg-blue-100 text-blue-800 border-blue-300',
  sent: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-muted text-muted-foreground',
  failed: 'bg-red-100 text-red-800 border-red-300',
}

export function BroadcastsPanel() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    text: '',
    scheduledAt: '',
    format: 'plain' as 'plain' | 'html',
  })
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<{ broadcasts: Broadcast[] }>('/api/broadcasts')
      setBroadcasts(d.broadcasts)
    } catch (e) {
      toast.error('Не удалось загрузить рассылки', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate() {
    if (!form.text.trim()) {
      toast.error('Введите текст рассылки')
      return
    }
    if (!form.scheduledAt) {
      toast.error('Выберите дату и время отправки')
      return
    }

    setSaving(true)
    try {
      // Convert local datetime to ISO
      const dt = new Date(form.scheduledAt)
      if (dt <= new Date()) {
        toast.error('Дата отправки должна быть в будущем')
        setSaving(false)
        return
      }
      await api.post('/api/broadcasts', {
        text: form.text,
        scheduledAt: dt.toISOString(),
        format: form.format,
      })
      toast.success('Рассылка запланирована')
      setDialogOpen(false)
      setForm({ text: '', scheduledAt: '', format: 'plain' })
      await load()
    } catch (e) {
      toast.error('Ошибка создания', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(b: Broadcast) {
    try {
      await api.put(`/api/broadcasts/${b.id}`, { status: 'cancelled' })
      toast.success('Рассылка отменена')
      await load()
    } catch (e) {
      toast.error('Ошибка', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function handleDelete(b: Broadcast) {
    if (!confirm('Удалить рассылку?')) return
    try {
      await api.del(`/api/broadcasts/${b.id}`)
      toast.success('Рассылка удалена')
      await load()
    } catch (e) {
      toast.error('Ошибка удаления', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function processNow() {
    setProcessing(true)
    try {
      const res = await api.post<{ ok: boolean; sentCount?: number; failedCount?: number; processed?: number; message?: string }>('/api/broadcasts/process')
      if (res.processed && res.processed > 0) {
        toast.success(`Рассылка отправлена: ${res.sentCount} успешно, ${res.failedCount} с ошибкой`)
      } else {
        toast.info('Нет запланированных рассылок для отправки')
      }
      await load()
    } catch (e) {
      toast.error('Ошибка обработки', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-5 w-5" /> Рассылки
          <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={load} disabled={loading} title="Обновить">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Запланированные сообщения всем пользователям бота. Можно использовать HTML-теги
          (b, i, a) при выборе формата HTML. Время отправки — по расписанию.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Создать рассылку
          </Button>
          <Button
            onClick={processNow}
            disabled={processing}
            variant="secondary"
            className="flex items-center gap-2"
            title="Проверить и отправить запланированные рассылки немедленно"
          >
            {processing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
            Отправить сейчас
          </Button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Загрузка...</div>
        ) : broadcasts.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Запланированных рассылок нет. Создайте первую!
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="min-w-[200px]">Текст</TableHead>
                  <TableHead className="w-32">Статус</TableHead>
                  <TableHead className="w-40">Дата отправки</TableHead>
                  <TableHead className="w-32">Результат</TableHead>
                  <TableHead className="w-20 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="text-sm line-clamp-2 whitespace-pre-wrap">{b.text}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Формат: {b.format}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusColor[b.status] || ''}`}>
                        {statusLabel[b.status] || b.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(b.scheduledAt).toLocaleString('ru-RU')}
                      </div>
                      {b.sentAt && (
                        <div className="flex items-center gap-1 mt-0.5 text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          {new Date(b.sentAt).toLocaleString('ru-RU')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {b.status === 'sent' ? (
                        <div className="text-xs">
                          <span className="text-green-600">✓ {b.sentCount}</span>
                          {b.failedCount > 0 && (
                            <span className="text-red-600"> / ✗ {b.failedCount}</span>
                          )}
                        </div>
                      ) : b.status === 'failed' ? (
                        <div className="text-xs text-red-600">
                          <XCircle className="h-3 w-3 inline" /> {b.failedCount} ошибок
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {b.status === 'scheduled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(b)}
                            className="text-amber-600 hover:text-amber-700 text-xs"
                          >
                            Отменить
                          </Button>
                        )}
                        {(b.status === 'scheduled' || b.status === 'cancelled') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(b)}
                            className="text-red-600 hover:text-red-700"
                            title="Удалить"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Новая рассылка</DialogTitle>
              <DialogDescription>
                Сообщение будет отправлено всем известным пользователям бота в указанное время.
                Используйте HTML-теги (при выборе формата HTML) для форматирования: &lt;b&gt;жирный&lt;/b&gt;,
                &lt;i&gt;курсив&lt;/i&gt;, &lt;a href="..."&gt;ссылка&lt;/a&gt;.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="bc-text">Текст сообщения *</Label>
                <Textarea
                  id="bc-text"
                  value={form.text}
                  onChange={(e) => setForm((s) => ({ ...s, text: e.target.value }))}
                  placeholder="Уважаемые участники программы «Обучение служением. Первые»!..."
                  rows={8}
                  disabled={saving}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bc-date">Дата и время отправки *</Label>
                <Input
                  id="bc-date"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((s) => ({ ...s, scheduledAt: e.target.value }))}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Время по вашему часовому поясу. Минимум — через 1 минуту от текущего момента.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Формат сообщения</Label>
                <Select
                  value={form.format}
                  onValueChange={(v) => setForm((s) => ({ ...s, format: v as 'plain' | 'html' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plain">Простой текст</SelectItem>
                    <SelectItem value="html">HTML (поддержка тегов b, i, a)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Отмена
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Создание...' : 'Запланировать рассылку'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
