// Global search command palette — Ctrl+K / Cmd+K to open
// Searches across categories, FAQs, users, log entries
'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { FolderTree, FileQuestion, Users, ScrollText, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

type SearchResult = {
  categories: Array<{ id: string; title: string; slug: string; itemCount: number }>
  faqs: Array<{ id: string; question: string; category?: { title: string } }>
  users: Array<{ id: string; maxUserId: number; firstName: string | null; lastName: string | null; username: string | null; lastSeenAt: string }>
}

type SearchProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onNavigate: (section: string) => void
  onOpenUserHistory: (maxUserId: number) => void
}

export function GlobalSearch({ open, onOpenChange, onNavigate, onOpenUserHistory }: SearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)

  const performSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    try {
      const [catsRes, faqsRes] = await Promise.all([
        api.get<{ categories: SearchResult['categories'] }>('/api/categories'),
        api.get<{ faqs: Array<{ id: string; question: string; category: { title: string } | null }> }>(
          `/api/faqs`,
        ),
      ])
      // Filter by query
      const lower = q.toLowerCase()
      const categories = catsRes.categories.filter(
        (c) => c.title.toLowerCase().includes(lower) || c.slug.toLowerCase().includes(lower),
      )
      const faqs = faqsRes.faqs
        .filter((f) => f.question.toLowerCase().includes(lower))
        .slice(0, 8)
        .map((f) => ({ id: f.id, question: f.question, category: f.category ?? undefined }))

      // For users — separate endpoint with q filter
      const usersRes = await api.get<{
        logs: Array<{ user: SearchResult['users'][0] }>;
      }>(`/api/logs?search=${encodeURIComponent(q)}&pageSize=5`)
      // Deduplicate users by id
      const seenUsers = new Set<string>()
      const users: SearchResult['users'] = []
      for (const log of usersRes.logs) {
        if (log.user && !seenUsers.has(log.user.id)) {
          seenUsers.add(log.user.id)
          users.push(log.user)
        }
      }

      setResults({ categories: categories.slice(0, 5), faqs, users: users.slice(0, 5) })
    } catch {
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults(null)
      return
    }
  }, [open])

  useEffect(() => {
    const debounce = setTimeout(() => {
      performSearch(query)
    }, 300)
    return () => clearTimeout(debounce)
  }, [query, performSearch])

  const hasResults =
    results &&
    ((results.categories.length > 0) ||
      (results.faqs.length > 0) ||
      (results.users.length > 0))

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Глобальный поиск: категории, FAQ, пользователи, логи..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">Поиск...</div>
        )}
        {!loading && query.length < 2 && (
          <CommandEmpty>Введите минимум 2 символа для поиска</CommandEmpty>
        )}
        {!loading && query.length >= 2 && !hasResults && (
          <CommandEmpty>Ничего не найдено по запросу "{query}"</CommandEmpty>
        )}

        {results && results.categories.length > 0 && (
          <CommandGroup heading="Категории">
            {results.categories.map((c) => (
              <CommandItem
                key={c.id}
                onSelect={() => {
                  onNavigate('categories')
                  onOpenChange(false)
                }}
                className="cursor-pointer"
              >
                <FolderTree className="mr-2 h-4 w-4 text-blue-600" />
                <span className="flex-1">{c.title}</span>
                <span className="text-xs text-muted-foreground">{c.itemCount} отв.</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results && results.faqs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ответы FAQ">
              {results.faqs.map((f) => (
                <CommandItem
                  key={f.id}
                  onSelect={() => {
                    onNavigate('faqs')
                    onOpenChange(false)
                  }}
                  className="cursor-pointer"
                >
                  <FileQuestion className="mr-2 h-4 w-4 text-indigo-600" />
                  <span className="flex-1 truncate">{f.question}</span>
                  {f.category && (
                    <span className="text-xs text-muted-foreground">{f.category.title}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results && results.users.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Пользователи (по истории сообщений)">
              {results.users.map((u) => {
                const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || `ID: ${u.maxUserId}`
                return (
                  <CommandItem
                    key={u.id}
                    onSelect={() => {
                      onOpenUserHistory(u.maxUserId)
                      onOpenChange(false)
                    }}
                    className="cursor-pointer"
                  >
                    <Users className="mr-2 h-4 w-4 text-cyan-600" />
                    <span className="flex-1">{name}</span>
                    <span className="text-xs text-muted-foreground">
                      {u.username ? `@${u.username} · ` : ''}ID: {u.maxUserId}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}

        {query.length >= 2 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Действия">
              <CommandItem
                onSelect={() => {
                  onNavigate('logs')
                  onOpenChange(false)
                }}
                className="cursor-pointer"
              >
                <ScrollText className="mr-2 h-4 w-4 text-sky-600" />
                <span className="flex-1">Открыть логи с фильтром "{query}"</span>
                <ArrowRight className="h-3 w-3" />
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  onNavigate('unanswered')
                  onOpenChange(false)
                }}
                className="cursor-pointer"
              >
                <ScrollText className="mr-2 h-4 w-4 text-amber-600" />
                <span className="flex-1">Запросы без ответа</span>
                <ArrowRight className="h-3 w-3" />
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  onNavigate('analytics')
                  onOpenChange(false)
                }}
                className="cursor-pointer"
              >
                <ScrollText className="mr-2 h-4 w-4 text-violet-600" />
                <span className="flex-1">Аналитика</span>
                <ArrowRight className="h-3 w-3" />
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
