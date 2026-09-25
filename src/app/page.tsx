'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { LoginScreen } from '@/components/admin/login-screen'
import { DashboardView } from '@/components/admin/dashboard-view'
import { AnalyticsView } from '@/components/admin/analytics-view'
import { UnansweredView } from '@/components/admin/unanswered-view'
import { AuditView } from '@/components/admin/audit-view'
import { CategoriesView } from '@/components/admin/categories-view'
import { FaqsView } from '@/components/admin/faqs-view'
import { LogsView } from '@/components/admin/logs-view'
import { SettingsView } from '@/components/admin/settings-view'
import { ThemeToggle } from '@/components/admin/theme-toggle'
import { GlobalSearch } from '@/components/admin/global-search'
import { UserHistoryDialog } from '@/components/admin/user-history-dialog'
import { Search } from 'lucide-react'
import {
  MessageCircle,
  LogOut,
  LayoutDashboard,
  BarChart3,
  AlertCircle,
  FolderTree,
  FileQuestion,
  ScrollText,
  ShieldCheck,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Section =
  | 'dashboard'
  | 'analytics'
  | 'unanswered'
  | 'categories'
  | 'faqs'
  | 'logs'
  | 'audit'
  | 'settings'

type NavItem = {
  id: Section
  label: string
  icon: React.ReactNode
  group: string
  badgeKey?: 'unansweredCount' | 'maxApiErrors' | 'auditFailures'
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Дашборд', icon: <LayoutDashboard className="h-4 w-4" />, group: 'Обзор' },
  { id: 'analytics', label: 'Аналитика', icon: <BarChart3 className="h-4 w-4" />, group: 'Обзор' },
  {
    id: 'unanswered',
    label: 'Запросы без ответа',
    icon: <AlertCircle className="h-4 w-4" />,
    group: 'Обзор',
    badgeKey: 'unansweredCount',
  },
  { id: 'categories', label: 'Категории', icon: <FolderTree className="h-4 w-4" />, group: 'База знаний' },
  { id: 'faqs', label: 'База знаний (FAQ)', icon: <FileQuestion className="h-4 w-4" />, group: 'База знаний' },
  {
    id: 'logs',
    label: 'Логи обращений',
    icon: <ScrollText className="h-4 w-4" />,
    group: 'Мониторинг',
    badgeKey: 'maxApiErrors',
  },
  {
    id: 'audit',
    label: 'Журнал действий',
    icon: <ShieldCheck className="h-4 w-4" />,
    group: 'Мониторинг',
    badgeKey: 'auditFailures',
  },
  { id: 'settings', label: 'Настройки', icon: <Settings className="h-4 w-4" />, group: 'Настройки' },
]

const NAV_GROUPS = ['Обзор', 'База знаний', 'Мониторинг', 'Настройки']

// Quick badge counts fetched on dashboard load
type BadgeCounts = {
  unansweredCount: number
  maxApiErrors: number
  auditFailures: number
}

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [section, setSection] = useState<Section>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [badges, setBadges] = useState<BadgeCounts | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [historyUserId, setHistoryUserId] = useState<number | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Global keyboard shortcut: Ctrl+K / Cmd+K to open global search
  // Alt+1..8 to switch between sections
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger inside input/textarea (except for Ctrl+K)
      const target = e.target as HTMLElement
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (authed) {
          setSearchOpen((v) => !v)
        }
        return
      }

      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        return
      }

      // Alt+1..8 for section navigation
      if (e.altKey && !isInput) {
        const sections: Section[] = [
          'dashboard', 'analytics', 'unanswered',
          'categories', 'faqs',
          'logs', 'audit', 'settings',
        ]
        const num = parseInt(e.key, 10)
        if (num >= 1 && num <= 8) {
          e.preventDefault()
          setSection(sections[num - 1])
          setSidebarOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [authed, searchOpen])

  useEffect(() => {
    let active = true
    api
      .get<{ authenticated: boolean }>('/api/auth/me')
      .then((d) => {
        if (active) setAuthed(d.authenticated)
      })
      .catch(() => {
        if (active) setAuthed(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Load badge counts once authenticated — refreshes every 60s
  useEffect(() => {
    if (!authed) return
    let active = true
    const loadBadges = async () => {
      try {
        const [analyticsRes, auditRes] = await Promise.all([
          api.get<{ unansweredQueries: unknown[]; funnel: { maxApiErrors: number } }>(
            '/api/analytics?period=7d',
          ),
          api.get<{ logs: Array<{ ok: boolean }> }>('/api/admin-actions?ok=false&pageSize=10'),
        ])
        if (active) {
          setBadges({
            unansweredCount: (analyticsRes.unansweredQueries as unknown[]).length,
            maxApiErrors: analyticsRes.funnel.maxApiErrors,
            auditFailures: auditRes.logs.length,
          })
        }
      } catch {
        // ignore — badges are optional
      }
    }
    loadBadges()
    const interval = setInterval(loadBadges, 60000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [authed])

  // Loading state
  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    )
  }

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />
  }

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout')
      setAuthed(false)
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50/30 via-background to-indigo-50/30">
      {/* Top bar */}
      <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 gap-3">
          <button
            className="md:hidden p-2 hover:bg-muted rounded-md"
            onClick={() => setSidebarOpen((s) => !s)}
            aria-label="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#007aff] to-[#630eff] flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Чат-бот MAX</div>
              <div className="text-xs text-muted-foreground leading-tight">
                "Обучение служением. Первые"
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded-md bg-muted">
              v2.1
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2"
              title="Открыть глобальный поиск (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
              <span className="hidden md:inline">Поиск</span>
              <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘K</span>
              </kbd>
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="flex items-center gap-1.5">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed md:sticky md:top-14 top-14 left-0 z-20 w-60 h-[calc(100vh-3.5rem)] border-r bg-background transition-transform overflow-y-auto',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          )}
        >
          <nav className="p-3 space-y-3 pb-20">
            {NAV_GROUPS.map((group) => (
              <div key={group} className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60 font-semibold px-3 py-1">
                  {group}
                </div>
                {NAV.filter((n) => n.group === group).map((item, idx) => {
                  // Compute global index across all NAV (for Alt+1..8 shortcut)
                  const globalIdx = NAV.findIndex((n2) => n2.id === item.id) + 1
                  const badgeCount = item.badgeKey && badges ? badges[item.badgeKey] : 0
                  const showBadge = badgeCount > 0
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSection(item.id)
                        setSidebarOpen(false)
                      }}
                      className={cn(
                        'flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors',
                        section === item.id
                          ? 'bg-blue-100 text-blue-900 font-medium'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      {item.icon}
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      <kbd
                        className="hidden md:inline-flex h-4 select-none items-center rounded border bg-muted px-1 text-[9px] font-mono font-medium text-muted-foreground/70"
                        title={`Alt+${globalIdx}`}
                      >
                        {globalIdx}
                      </kbd>
                      {showBadge && (
                        <span
                          className={cn(
                            'flex-shrink-0 min-w-5 h-5 px-1.5 text-[10px] font-semibold rounded-full flex items-center justify-center',
                            badgeCount > 5 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white',
                          )}
                          title={badgeCount > 5 ? 'Требует внимания' : 'Есть элементы'}
                        >
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>
          <div className="absolute bottom-3 left-3 right-3 px-3 py-2 text-xs text-muted-foreground bg-muted/50 rounded-md">
            <div className="font-medium text-foreground mb-0.5">Соц. партнёр</div>
            Ассоциация Добро.рф
            <div className="mt-1 text-[10px]">Задача №4262</div>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-14 bg-black/40 z-10 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {section === 'dashboard' && <DashboardView />}
            {section === 'analytics' && <AnalyticsView />}
            {section === 'unanswered' && <UnansweredView />}
            {section === 'categories' && <CategoriesView />}
            {section === 'faqs' && <FaqsView />}
            {section === 'logs' && <LogsView />}
            {section === 'audit' && <AuditView />}
            {section === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>

      {/* Global search dialog (Ctrl+K) */}
      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigate={(s) => setSection(s as Section)}
        onOpenUserHistory={(uid) => {
          setHistoryUserId(uid)
          setHistoryOpen(true)
        }}
      />

      {/* User history dialog — opened from global search */}
      <UserHistoryDialog
        maxUserId={historyUserId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  )
}
