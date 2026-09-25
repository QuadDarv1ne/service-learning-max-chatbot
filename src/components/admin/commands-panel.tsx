// Commands management panel — embedded into Settings view
'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, Terminal, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type Command = {
  id: string
  name: string
  description: string
  type: 'text' | 'faq' | 'function'
  response: string | null
  faqId: string | null
  faqQuestion: string | null
  enabled: boolean
  order: number
}

type Faq = { id: string; question: string; category?: { title: string } | null }

const typeLabel: Record<string, string> = {
  text: 'Текст',
  faq: 'Ссылка на FAQ',
  function: 'Встроенная',
}

const empty = {
  name: '',
  description: '',
  type: 'text' as 'text' | 'faq' | 'function',
  response: '',
  faqId: '',
  enabled: true,
}

export function CommandsPanel() {
  const [commands, setCommands] = useState<Command[]>([])
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Command | null>(null)
  const [form, setForm] = useState({ ...empty })
  const [saving, setSaving] = useState(false)
  const [registering, setRegistering] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cmdsRes, faqsRes] = await Promise.all([
        api.get<{ commands: Command[] }>('/api/commands'),
        api.get<{ faqs: Faq[] }>('/api/faqs'),
      ])
      setCommands(cmdsRes.commands)
      setFaqs(faqsRes.faqs)
    } catch (e) {
      toast.error('Не удалось загрузить команды', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ ...empty })
    setDialogOpen(true)
  }

  function openEdit(c: Command) {
    setEditing(c)
    setForm({
      name: c.name,
      description: c.description,
      type: c.type,
      response: c.response ?? '',
      faqId: c.faqId ?? '',
      enabled: c.enabled,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.description.trim()) {
      toast.error('Заполните имя и описание команды')
      return
    }
    if (form.type === 'text' && !form.response.trim()) {
      toast.error('Заполните текст ответа для типа "Текст"')
      return
    }
    if (form.type === 'faq' && !form.faqId) {
      toast.error('Выберите FAQ для типа "Ссылка на FAQ"')
      return
    }
    if (form.type === 'function' && !['start', 'help', 'menu', 'search', 'show', 'faq'].includes(form.name)) {
      toast.error('Встроенные функции: start, help, menu, search, show, faq. Имя должно совпадать с одним из них.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        type: form.type,
        response: form.type === 'text' ? form.response : null,
        faqId: form.type === 'faq' ? form.faqId : null,
        enabled: form.enabled,
      }
      if (editing) {
        await api.put(`/api/commands/${editing.id}`, payload)
        toast.success('Команда обновлена')
      } else {
        await api.post('/api/commands', payload)
        toast.success('Команда создана')
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      toast.error('Ошибка сохранения', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Command) {
    if (!confirm(`Удалить команду /${c.name}?`)) return
    try {
      await api.del(`/api/commands/${c.id}`)
      toast.success(`Команда /${c.name} удалена`)
      await load()
    } catch (e) {
      toast.error('Ошибка удаления', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function toggleEnabled(c: Command) {
    try {
      await api.put(`/api/commands/${c.id}`, { enabled: !c.enabled })
      await load()
    } catch (e) {
      toast.error('Ошибка', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function moveCommand(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === commands.length - 1) return
    const swapWith = direction === 'up' ? index - 1 : index + 1
    const current = commands[index]
    const target = commands[swapWith]
    const newOrder = commands.map((c, i) => ({
      id: c.id,
      order: i === index ? target.order : i === swapWith ? current.order : c.order,
    }))
    try {
      await api.post('/api/commands/reorder', { order: newOrder })
      await load()
    } catch (e) {
      toast.error('Ошибка изменения порядка', { description: e instanceof Error ? e.message : String(e) })
      await load()
    }
  }

  async function registerAll() {
    setRegistering(true)
    try {
      const res = await api.post<{ ok: boolean; registered?: number; error?: string }>(
        '/api/commands/register-all',
      )
      if (res.ok && res.registered) {
        toast.success(`Зарегистрировано ${res.registered} команд в MAX`)
      }
    } catch (e) {
      toast.error('Ошибка регистрации', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setRegistering(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Terminal className="h-5 w-5" /> Команды бота
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto"
            onClick={load}
            disabled={loading}
            title="Обновить"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Пользовательские команды бота. Когда пользователь пишет /name в MAX — бот ищет команду
          в этой таблице и отвечает. Зарегистрируйте команды в MAX, чтобы они появились в автодополнении.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Создать команду
          </Button>
          <Button
            onClick={registerAll}
            disabled={registering}
            variant="secondary"
            className="flex items-center gap-2"
            title="Отправить все включённые команды в MAX через PATCH /me"
          >
            {registering ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
            Зарегистрировать все в MAX
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            Всего: {commands.length}, активно: {commands.filter((c) => c.enabled).length}
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Загрузка команд...</div>
        ) : commands.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Команд нет. Создайте первую!
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-12 text-center">№</TableHead>
                  <TableHead>Команда</TableHead>
                  <TableHead className="min-w-[200px]">Описание</TableHead>
                  <TableHead className="text-center">Тип</TableHead>
                  <TableHead className="text-center">Активна</TableHead>
                  <TableHead className="w-20 text-center">Порядок</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commands.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">/{c.name}</code>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm line-clamp-2">{c.description}</div>
                      {c.type === 'faq' && c.faqQuestion && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          → {c.faqQuestion.slice(0, 60)}
                        </div>
                      )}
                      {c.type === 'text' && c.response && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {c.response.slice(0, 60)}…
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {typeLabel[c.type] || c.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={c.enabled}
                          onCheckedChange={() => toggleEnabled(c)}
                          aria-label="Активна"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={i === 0}
                          onClick={() => moveCommand(i, 'up')}
                          title="Поднять выше"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={i === commands.length - 1}
                          onClick={() => moveCommand(i, 'down')}
                          title="Опустить ниже"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(c)}
                          title="Редактировать"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(c)}
                          title="Удалить"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? `Редактировать /${editing.name}` : 'Новая команда'}</DialogTitle>
              <DialogDescription>
                Команда вызывается пользователем как /name в MAX. Если команда
                имеет аргументы (например /search текст), они парсятся отдельно.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="cmd-name">Имя команды (без /)</Label>
                <Input
                  id="cmd-name"
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="about"
                  disabled={saving}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Только латиница, цифры, _ и -. Например: about, contacts, faq.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cmd-desc">Описание (для автодополнения MAX)</Label>
                <Input
                  id="cmd-desc"
                  value={form.description}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="О программе «Обучение служением. Первые»"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cmd-type">Тип команды</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((s) => ({ ...s, type: v as typeof s.type }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Текст — статичный ответ</SelectItem>
                    <SelectItem value="faq">Ссылка на FAQ — показать конкретный ответ</SelectItem>
                    <SelectItem value="function">Встроенная функция (start/help/menu/search/show/faq)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.type === 'text' && (
                <div className="space-y-2">
                  <Label htmlFor="cmd-response">Текст ответа</Label>
                  <Textarea
                    id="cmd-response"
                    value={form.response}
                    onChange={(e) => setForm((s) => ({ ...s, response: e.target.value }))}
                    placeholder="Текст, который получит пользователь при вызове /about"
                    rows={6}
                    disabled={saving}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {form.type === 'faq' && (
                <div className="space-y-2">
                  <Label htmlFor="cmd-faq">Какой ответ показать</Label>
                  <Select
                    value={form.faqId}
                    onValueChange={(v) => setForm((s) => ({ ...s, faqId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите FAQ..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {faqs.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.question.slice(0, 80)}
                          {f.question.length > 80 ? '...' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.type === 'function' && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                  <strong>Встроенные функции:</strong>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><code>start</code> / <code>menu</code> — показать главное меню категорий</li>
                    <li><code>help</code> — показать справку</li>
                    <li><code>search</code> — поиск: /search &lt;текст&gt;</li>
                    <li><code>show</code> — показать ответ: /show &lt;id&gt;</li>
                    <li><code>faq</code> — список всех вопросов с /show ссылками</li>
                  </ul>
                  <p className="mt-2">Имя команды должно совпадать с одним из этих значений.</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  id="cmd-enabled"
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, enabled: v }))}
                  disabled={saving}
                />
                <Label htmlFor="cmd-enabled">Активна (видна в автодополнении и работает)</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Сохранение...' : editing ? 'Сохранить' : 'Создать'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
