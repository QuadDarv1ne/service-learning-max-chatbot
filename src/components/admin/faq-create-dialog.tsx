// Reusable FAQ create/edit dialog — used by FaqsView and UnansweredView
'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type Category = {
  id: string
  title: string
  slug: string
}

const EMPTY = { categoryId: '', question: '', answer: '', keywords: '', published: true }

export function FaqCreateDialog({
  open,
  onOpenChange,
  prefillQuestion,
  prefillCategoryId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  prefillQuestion?: string
  prefillCategoryId?: string
  onSuccess?: () => void
}) {
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  // Load categories when dialog opens
  useEffect(() => {
    if (!open) return
    let active = true
    setCategoriesLoading(true)
    api
      .get<{ categories: Category[] }>('/api/categories')
      .then((d) => {
        if (active) {
          setCategories(d.categories)
          // Prefill category if provided, else first
          if (d.categories.length > 0) {
            setForm((s) => ({
              ...s,
              categoryId: prefillCategoryId ?? d.categories[0].id,
            }))
          }
        }
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (active) setCategoriesLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, prefillCategoryId])

  // Apply pre-filled question when dialog opens (only once per open)
  useEffect(() => {
    if (open && prefillQuestion) {
      setForm((s) => ({ ...s, question: prefillQuestion }))
    }
    if (!open) {
      // Reset form on close
      setForm({ ...EMPTY })
    }
  }, [open, prefillQuestion])

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
      await api.post('/api/faqs', form)
      toast.success('Ответ добавлен в базу знаний')
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      toast.error('Ошибка сохранения', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавить ответ в базу знаний</DialogTitle>
          <DialogDescription>
            Создайте новый FAQ с готовым вопросом — пользовательский запрос
            будет автоматически находиться через поиск.
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
                <SelectValue placeholder={categoriesLoading ? 'Загрузка...' : 'Выберите категорию'} />
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
              autoFocus
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

          <div className="flex items-center gap-2">
            <Switch
              id="faq-pub"
              checked={form.published}
              onCheckedChange={(v) => setForm((s) => ({ ...s, published: v }))}
              disabled={saving}
            />
            <Label htmlFor="faq-pub">Опубликовано (видно в боте)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
            {saving ? 'Сохранение...' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
