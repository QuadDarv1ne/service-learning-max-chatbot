// FAQ view — manage individual Q&A items
'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
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
import { Plus, Pencil, Trash2, FileQuestion, Eye, Upload, Download } from 'lucide-react'
import { toast } from 'sonner'
import { getTagColorClasses } from '@/lib/tag-colors'

type Category = {
  id: string
  title: string
  slug: string
}

type Tag = {
  id: string
  name: string
  color: string
}

type Faq = {
  id: string
  categoryId: string
  question: string
  answer: string
  keywords: string | null
  order: number
  published: boolean
  pinned: boolean
  viewCount: number
  category: { id: string; title: string }
  tags?: Tag[]
}

const empty = { categoryId: '', question: '', answer: '', keywords: '', published: true, pinned: false }

export function FaqsView() {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [filterTag, setFilterTag] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Faq | null>(null)
  const [form, setForm] = useState({ ...empty })
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [faqsRes, catsRes, tagsRes] = await Promise.all([
        api.get<{ faqs: Faq[] }>('/api/faqs'),
        api.get<{ categories: Category[] }>('/api/categories'),
        api.get<{ tags: Tag[] }>('/api/tags'),
      ])
      setFaqs(faqsRes.faqs)
      setCategories(catsRes.categories)
      setTags(tagsRes.tags)
    } catch (e) {
      toast.error('Не удалось загрузить FAQ', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredFaqs = faqs.filter((f) => {
    if (filterCat !== 'all' && f.categoryId !== filterCat) return false
    if (filterTag !== 'all' && !(f.tags ?? []).some((t) => t.id === filterTag)) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        (f.keywords ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  function openCreate() {
    setEditing(null)
    setForm({
      ...empty,
      categoryId: categories[0]?.id ?? '',
    })
    setSelectedTagIds([])
    setDialogOpen(true)
  }

  function openEdit(f: Faq) {
    setEditing(f)
    setForm({
      categoryId: f.categoryId,
      question: f.question,
      answer: f.answer,
      keywords: f.keywords ?? '',
      published: f.published,
      pinned: f.pinned,
    })
    setSelectedTagIds((f.tags ?? []).map((t) => t.id))
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.categoryId) {
      toast.error('Выберите категорию')
      return
    }
    if (!form.question.trim()) {
      toast.error('Укажите вопрос')
      return
    }
    if (!form.answer.trim()) {
      toast.error('Укажите ответ')
      return
    }

    setSaving(true)
    try {
      let faqId = editing?.id
      if (editing) {
        await api.put(`/api/faqs/${editing.id}`, form)
        toast.success('Ответ обновлён')
      } else {
        const res = await api.post<{ faq: { id: string } }>('/api/faqs', form)
        faqId = res.faq.id
        toast.success('Ответ создан')
      }
      // Update tags for this FAQ
      if (faqId) {
        await api.post(`/api/faqs/${faqId}/tags`, { tagIds: selectedTagIds })
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      toast.error('Ошибка сохранения', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(f: Faq) {
    if (!confirm(`Удалить вопрос «${f.question}»?`)) return
    try {
      await api.del(`/api/faqs/${f.id}`)
      toast.success('Ответ удалён')
      await load()
    } catch (e) {
      toast.error('Ошибка удаления', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function togglePublished(f: Faq) {
    try {
      await api.put(`/api/faqs/${f.id}`, { published: !f.published })
      await load()
    } catch (e) {
      toast.error('Ошибка', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function togglePinned(f: Faq) {
    try {
      await api.put(`/api/faqs/${f.id}`, { pinned: !f.pinned })
      await load()
    } catch (e) {
      toast.error('Ошибка', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">База знаний (FAQ)</h2>
          <p className="text-sm text-muted-foreground">
            Вопросы и утверждённые ответы. Сотрудники программы могут свободно редактировать и
            добавлять ответы — без технических навыков.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={openCreate} className="flex items-center gap-2" disabled={categories.length === 0}>
            <Plus className="h-4 w-4" /> Добавить ответ
          </Button>
          <label
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium cursor-pointer transition-colors"
            title="Импорт FAQ из CSV"
          >
            <Upload className="h-4 w-4" /> Импорт CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const text = await file.text()
                try {
                  const res = await fetch('/api/faqs/import-csv', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/csv' },
                    body: text,
                  })
                  const data = await res.json()
                  if (data.ok) {
                    toast.success(`Импортировано ${data.imported} ответов`, {
                      description: data.skipped > 0 ? `Пропущено ${data.skipped} строк` : undefined,
                    })
                    await load()
                  } else {
                    toast.error('Ошибка импорта', { description: data.detail || data.error })
                  }
                } catch (err) {
                  toast.error('Ошибка импорта', {
                    description: err instanceof Error ? err.message : String(err),
                  })
                }
                e.target.value = ''
              }}
            />
          </label>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent('category_slug,question,answer,keywords,published\nabout-programme,Что такое программа?,Это просветительская программа...,ключевые,слова,true\nregistration,Как зарегистрироваться?,Зарегистрируйтесь на dobro.ru...,регистрация,заявка,true')}`}
            download="faq-template.csv"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors"
            title="Скачать шаблон CSV"
          >
            <Download className="h-4 w-4" /> Шаблон CSV
          </a>
        </div>
      </div>

      {categories.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Сначала создайте хотя бы одну категорию в разделе «Категории».
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="w-56">
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger>
              <SelectValue placeholder="Все категории" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tags.length > 0 && (
          <div className="w-48">
            <Select value={filterTag} onValueChange={setFilterTag}>
              <SelectTrigger>
                <SelectValue placeholder="Все теги" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все теги</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Input
          placeholder="Поиск по вопросу/ответу/ключевым словам..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
        <div className="px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md">
          Найдено: <span className="font-medium text-foreground">{filteredFaqs.length}</span> из {faqs.length}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Загрузка ответов...</div>
          ) : filteredFaqs.length === 0 ? (
            <div className="p-12 text-center">
              <FileQuestion className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <div className="text-sm text-muted-foreground">
                {faqs.length === 0 ? 'Пока нет ни одного ответа. Создайте первый!' : 'Ничего не найдено по фильтру.'}
              </div>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="min-w-[300px]">Вопрос</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead className="text-center">Просм.</TableHead>
                    <TableHead className="text-center">📌</TableHead>
                    <TableHead className="text-center">Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFaqs.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="flex items-start gap-1">
                          {f.pinned && <span className="text-blue-600" title="Закреплён">📌</span>}
                          <div className="font-medium line-clamp-2 flex-1">{f.question}</div>
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{f.answer}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{f.category.title}</Badge>
                        {(f.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {f.tags!.map((t) => {
                              const colors = getTagColorClasses(t.color)
                              return (
                                <span
                                  key={t.id}
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full border ${colors.badge}`}
                                >
                                  {t.name}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Eye className="h-3 w-3" /> {f.viewCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => togglePinned(f)}
                            className={`text-xs px-2 py-1 rounded-md transition-colors ${
                              f.pinned
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                            title={f.pinned ? 'Снять закрепление' : 'Закрепить в начале списка'}
                          >
                            📌
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={f.published}
                            onCheckedChange={() => togglePublished(f)}
                            aria-label="Опубликовано"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(f)}
                            title="Редактировать"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(f)}
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
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать ответ' : 'Новый ответ'}</DialogTitle>
            <DialogDescription>
              Вопрос и ответ сохраняются в базу знаний. Ответ поддерживает многострочный текст
              и будет показан в чат-боте как есть.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="faq-cat">Категория *</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm((s) => ({ ...s, categoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="faq-q">Вопрос *</Label>
              <Input
                id="faq-q"
                value={form.question}
                onChange={(e) => setForm((s) => ({ ...s, question: e.target.value }))}
                placeholder="Например: Как зарегистрироваться на программе?"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="faq-a">Ответ *</Label>
              <Textarea
                id="faq-a"
                value={form.answer}
                onChange={(e) => setForm((s) => ({ ...s, answer: e.target.value }))}
                placeholder="Утверждённый ответ..."
                rows={8}
                disabled={saving}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Текст можно разбивать на абзацы через пустую строку. Поддерживаются простые символы:
                «•», «-», «1.» для списков.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="faq-kw">Ключевые слова</Label>
              <Input
                id="faq-kw"
                value={form.keywords}
                onChange={(e) => setForm((s) => ({ ...s, keywords: e.target.value }))}
                placeholder="через запятую: регистрация, заявка, как вступить"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Используются для поиска. Чем больше релевантных синонимов — тем точнее поиск.
              </p>
            </div>

            {/* Tags selector */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <Label>Теги</Label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => {
                    const isSelected = selectedTagIds.includes(t.id)
                    const colors = getTagColorClasses(t.color)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTagIds((prev) =>
                            isSelected ? prev.filter((id) => id !== t.id) : [...prev, t.id],
                          )
                        }}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                          isSelected ? colors.buttonSelected : colors.buttonUnselected
                        }`}
                      >
                        {t.name}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Теги — это многомерная категоризация (например: «срочно», «для педагогов», «для студентов»).
                  Нажмите, чтобы назначить/снять.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="faq-pub"
                checked={form.published}
                onCheckedChange={(v) => setForm((s) => ({ ...s, published: v }))}
                disabled={saving}
              />
              <Label htmlFor="faq-pub">Опубликовано (видно в боте)</Label>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 p-3">
              <Switch
                id="faq-pinned"
                checked={form.pinned}
                onCheckedChange={(v) => setForm((s) => ({ ...s, pinned: v }))}
                disabled={saving}
              />
              <div className="space-y-0.5">
                <Label htmlFor="faq-pinned" className="text-sm font-medium">
                  📌 Закрепить в начале списка
                </Label>
                <p className="text-xs text-blue-800">
                  Закреплённые ответы показываются первыми в категориях и результатах поиска.
                  Полезно для самых важных вопросов.
                </p>
              </div>
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
    </div>
  )
}
