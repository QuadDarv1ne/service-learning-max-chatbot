// Categories view — manage FAQ categories
'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
import { Plus, Pencil, Trash2, FolderTree, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'

type Category = {
  id: string
  title: string
  slug: string
  description: string | null
  order: number
  published: boolean
  itemCount: number
  createdAt: string
  updatedAt: string
}

function slugify(s: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  }
  return s
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function CategoriesView() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ title: '', slug: '', description: '', published: true })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<{ categories: Category[] }>('/api/categories')
      setCategories(d.categories)
    } catch (e) {
      toast.error('Не удалось загрузить категории', {
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
    setForm({ title: '', slug: '', description: '', published: true })
    setDialogOpen(true)
  }

  function openEdit(c: Category) {
    setEditing(c)
    setForm({ title: c.title, slug: c.slug, description: c.description ?? '', published: c.published })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Укажите название категории')
      return
    }
    const slug = form.slug.trim() || slugify(form.title)
    if (!slug) {
      toast.error('Не удалось сгенерировать slug из названия — укажите его вручную')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await api.put(`/api/categories/${editing.id}`, { ...form, slug })
        toast.success('Категория обновлена')
      } else {
        await api.post('/api/categories', { ...form, slug })
        toast.success('Категория создана')
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      toast.error('Ошибка сохранения', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Category) {
    if (!confirm(`Удалить категорию "${c.title}"? Все ${c.itemCount} ответов в ней будут удалены безвозвратно.`)) {
      return
    }
    try {
      await api.del(`/api/categories/${c.id}`)
      toast.success('Категория удалена')
      await load()
    } catch (e) {
      toast.error('Ошибка удаления', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function togglePublished(c: Category) {
    try {
      await api.put(`/api/categories/${c.id}`, { published: !c.published })
      await load()
    } catch (e) {
      toast.error('Ошибка изменения статуса', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function moveCategory(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === categories.length - 1) return

    const swapWith = direction === 'up' ? index - 1 : index + 1
    const current = categories[index]
    const target = categories[swapWith]

    // Optimistic: swap orders locally
    const newOrder = categories.map((c, i) => ({
      id: c.id,
      order: i === index ? target.order : i === swapWith ? current.order : c.order,
    }))

    // Send full reorder
    try {
      await api.post('/api/categories/reorder', { order: newOrder })
      await load()
    } catch (e) {
      toast.error('Ошибка изменения порядка', { description: e instanceof Error ? e.message : String(e) })
      await load() // rollback
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Категории</h2>
          <p className="text-sm text-muted-foreground">
            Тематические разделы базы знаний. Сотрудники программы могут свободно добавлять,
            редактировать и удалять категории — программист не нужен.
          </p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Создать категорию
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Загрузка категорий...</div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center">
              <FolderTree className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <div className="text-sm text-muted-foreground">
                Пока нет ни одной категории. Создайте первую!
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">№</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-center">Ответов</TableHead>
                  <TableHead className="text-center">Статус</TableHead>
                  <TableHead className="w-24 text-center">Порядок</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c.title}</div>
                      {c.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {c.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{c.slug}</code>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{c.itemCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={c.published}
                          onCheckedChange={() => togglePublished(c)}
                          aria-label="Опубликовано"
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
                          onClick={() => moveCategory(i, 'up')}
                          title="Поднять выше"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={i === categories.length - 1}
                          onClick={() => moveCategory(i, 'down')}
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
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать категорию' : 'Новая категория'}</DialogTitle>
            <DialogDescription>
              Категория — это раздел базы знаний. Содержит один или несколько вопросов с ответами.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cat-title">Название *</Label>
              <Input
                id="cat-title"
                value={form.title}
                onChange={(e) => {
                  const v = e.target.value
                  setForm((s) => ({ ...s, title: v, slug: s.slug && s.slug !== slugify(s.title) ? s.slug : slugify(v) }))
                }}
                placeholder="Например: Регистрация и участие"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-slug">Slug (латиницей)</Label>
              <Input
                id="cat-slug"
                value={form.slug}
                onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                placeholder="auto-generated"
                disabled={saving}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Используется как идентификатор. Можно оставить пустым — сгенерируется автоматически.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-desc">Краткое описание</Label>
              <Textarea
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                placeholder="Короткое описание раздела (необязательно)"
                rows={3}
                disabled={saving}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="cat-pub"
                checked={form.published}
                onCheckedChange={(v) => setForm((s) => ({ ...s, published: v }))}
                disabled={saving}
              />
              <Label htmlFor="cat-pub">Опубликовано (видно в боте)</Label>
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
