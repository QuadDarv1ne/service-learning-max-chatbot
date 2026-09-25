// Settings view — bot config, webhook, test message, instructions
'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CommandsPanel } from '@/components/admin/commands-panel'
import { BroadcastsPanel } from '@/components/admin/broadcasts-panel'
import {
  Bot,
  Webhook,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
  BookOpen,
  Lightbulb,
  Download,
  Upload,
  Terminal,
  Copy,
  Activity,
} from 'lucide-react'

type Settings = {
  botToken: string
  webhookUrl: string
  webhookSubscribed: string
  llmEnabled: string
  welcomeMessage: string
  helpMessage: string
}

type BotInfo = {
  user_id: number
  first_name?: string
  username?: string
  is_bot?: boolean
  last_activity_time?: number
}

export function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkingBot, setCheckingBot] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  // Test-send form
  const [testUserId, setTestUserId] = useState('')
  const [testText, setTestText] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [registeringCommands, setRegisteringCommands] = useState(false)
  const [importing, setImporting] = useState(false)
  const [health, setHealth] = useState<{
    ok: boolean
    version: string
    checks: {
      database?: { ok: boolean }
      botTokenConfigured?: boolean
      webhookSubscribed?: boolean
      llmEnabled?: boolean
      knowledgeBase?: { faqs: number; publishedFaqs: number; empty: boolean }
      last24h?: {
        incomingMessages: number
        outgoingMessages: number
        maxApiErrors: number
        llmHandled: number
        avgResponseMs: number
      }
      lastActivityAt?: string | null
    }
  } | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<{ settings: Settings }>('/api/settings')
      setSettings(d.settings)
    } catch (e) {
      toast.error('Не удалось загрузить настройки', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    loadHealth()
  }, [load])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      // Skip masked token
      const payload: Record<string, string> = {
        webhookUrl: settings.webhookUrl,
        welcomeMessage: settings.welcomeMessage,
        helpMessage: settings.helpMessage,
        llmEnabled: settings.llmEnabled,
      }
      if (!settings.botToken.includes('•')) {
        payload.botToken = settings.botToken
      }
      const d = await api.put<{ settings: Settings }>('/api/settings', payload)
      setSettings(d.settings)
      toast.success('Настройки сохранены')
    } catch (e) {
      toast.error('Ошибка сохранения', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function checkBot() {
    setCheckingBot(true)
    setBotInfo(null)
    try {
      const d = await api.get<{ bot: BotInfo }>('/api/max/bot-info')
      setBotInfo(d.bot)
      toast.success('Бот доступен, токен валиден')
    } catch (e) {
      toast.error('Не удалось получить информацию о боте', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setCheckingBot(false)
    }
  }

  async function subscribeWebhook() {
    setSubscribing(true)
    try {
      await api.post('/api/max/subscribe')
      toast.success('Webhook подписан. Бот готов к работе!')
      await load()
    } catch (e) {
      toast.error('Ошибка подписки webhook', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSubscribing(false)
    }
  }

  async function sendTest() {
    if (!testUserId || !testText) {
      toast.error('Укажите ID пользователя и текст')
      return
    }
    setSendingTest(true)
    try {
      await api.post('/api/max/test-send', {
        maxUserId: parseInt(testUserId, 10),
        text: testText,
      })
      toast.success('Сообщение отправлено')
      setTestText('')
    } catch (e) {
      toast.error('Ошибка отправки', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSendingTest(false)
    }
  }

  async function registerCommands() {
    setRegisteringCommands(true)
    try {
      await api.post('/api/max/register-commands')
      toast.success('Команды /start и /help зарегистрированы в MAX')
    } catch (e) {
      toast.error('Ошибка регистрации команд', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setRegisteringCommands(false)
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const result = await api.post<{ ok: boolean; imported?: { categories: number; items: number } }>(
        '/api/knowledge/import',
        data,
      )
      if (result.ok && result.imported) {
        toast.success('База знаний импортирована', {
          description: `${result.imported.categories} категорий, ${result.imported.items} ответов`,
        })
      }
    } catch (e) {
      toast.error('Ошибка импорта', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setImporting(false)
      // Reset file input
      e.target.value = ''
    }
  }

  async function loadHealth() {
    setHealthLoading(true)
    try {
      const res = await fetch('/api/health')
      const d = await res.json()
      setHealth(d)
    } catch (e) {
      toast.error('Ошибка проверки здоровья', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setHealthLoading(false)
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Скопировано: ${label}`)
    } catch {
      toast.error('Не удалось скопировать — браузер не поддерживает clipboard')
    }
  }

  if (loading || !settings) {
    return (
      <div className="py-12 text-center text-muted-foreground">Загрузка настроек...</div>
    )
  }

  const subscribed = settings.webhookSubscribed === 'true'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Настройки</h2>
        <p className="text-sm text-muted-foreground">
          Подключение бота к MAX, тексты приветствия и справки, тестовая отправка сообщений.
        </p>
      </div>

      {/* System health */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" /> Здоровье системы
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-auto"
                onClick={loadHealth}
                disabled={healthLoading}
                title="Обновить"
              >
                <RefreshCw className={`h-3 w-3 ${healthLoading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
            <CardDescription>
              Текущий статус интеграции и быстрые метрики за последние 24 часа.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <HealthItem
                label="База данных"
                ok={health.checks.database?.ok ?? false}
                text={health.checks.database?.ok ? 'Работает' : 'Ошибка'}
              />
              <HealthItem
                label="Токен бота"
                ok={Boolean(health.checks.botTokenConfigured)}
                text={health.checks.botTokenConfigured ? 'Настроен' : 'Не указан'}
              />
              <HealthItem
                label="Webhook подписка"
                ok={Boolean(health.checks.webhookSubscribed)}
                text={health.checks.webhookSubscribed ? 'Активна' : 'Не подписан'}
              />
              <HealthItem
                label="ИИ-фолбэк"
                ok={Boolean(health.checks.llmEnabled)}
                text={health.checks.llmEnabled ? 'Включён' : 'Выключен'}
              />
            </div>
            {health.checks.knowledgeBase && (
              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm">
                <div className="rounded-md border p-2">
                  <div className="text-xs text-muted-foreground">Ответов в базе</div>
                  <div className="font-semibold">
                    {health.checks.knowledgeBase.faqs}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({health.checks.knowledgeBase.publishedFaqs} опубл.)
                    </span>
                  </div>
                </div>
                {health.checks.last24h && (
                  <>
                    <div className="rounded-md border p-2">
                      <div className="text-xs text-muted-foreground">Сообщений 24ч</div>
                      <div className="font-semibold">
                        {health.checks.last24h.incomingMessages} вх / {health.checks.last24h.outgoingMessages} исх
                      </div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-xs text-muted-foreground">Ошибок MAX 24ч</div>
                      <div
                        className={`font-semibold ${
                          health.checks.last24h.maxApiErrors > 0 ? 'text-red-600' : ''
                        }`}
                      >
                        {health.checks.last24h.maxApiErrors}
                      </div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-xs text-muted-foreground">Avg отклик 24ч</div>
                      <div className="font-semibold">
                        {health.checks.last24h.avgResponseMs < 1000
                          ? `${health.checks.last24h.avgResponseMs} мс`
                          : `${(health.checks.last24h.avgResponseMs / 1000).toFixed(1)} с`}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {health.checks.lastActivityAt && (
              <div className="mt-3 text-xs text-muted-foreground">
                Последняя активность: {new Date(health.checks.lastActivityAt).toLocaleString('ru-RU')}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bot connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5" /> Подключение бота
          </CardTitle>
          <CardDescription>
            Токен доступа к MAX Bot API. Получите его в карточке бота на платформе MAX для партнёров
            (раздел "Чат-боты" → ⋮ → "Настройки").
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bot-token">Токен бота</Label>
            <Input
              id="bot-token"
              type="password"
              value={settings.botToken}
              onChange={(e) => setSettings({ ...settings, botToken: e.target.value })}
              placeholder="Вставьте сюда токен из платформы MAX"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Хранится в базе данных приложения. Не передаётся третьим лицам.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={checkBot} disabled={checkingBot || !settings.botToken || settings.botToken.includes('•')} variant="outline">
              <RefreshCw className={`h-4 w-4 ${checkingBot ? 'animate-spin' : ''}`} />
              Проверить бота
            </Button>
            {botInfo && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span className="font-medium">{botInfo.first_name ?? 'Bot'}</span>
                {botInfo.username && <span className="text-muted-foreground">@{botInfo.username}</span>}
                <Badge variant="secondary">ID: {botInfo.user_id}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-5 w-5" /> Webhook
          </CardTitle>
          <CardDescription>
            URL, на который MAX будет присылать события (входящие сообщения, нажатия кнопок).
            Должен быть общедоступным HTTPS-адресом.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL вебхука</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                type="url"
                value={settings.webhookUrl}
                onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                placeholder="https://your-domain.ru/api/max/webhook"
                disabled={saving}
                className="font-mono"
              />
              {settings.webhookUrl && (
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  onClick={() => copyToClipboard(settings.webhookUrl, 'URL вебхука')}
                  title="Скопировать"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Сначала сохраните настройки, затем нажмите "Подписать webhook".
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={subscribeWebhook}
              disabled={subscribing || !settings.webhookUrl || !settings.botToken || settings.botToken.includes('•')}
            >
              {subscribing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
              Подписать webhook
            </Button>
            {subscribed ? (
              <div className="flex items-center gap-1.5 text-sm text-blue-700">
                <CheckCircle2 className="h-4 w-4" /> Подписка активна
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-amber-700">
                <XCircle className="h-4 w-4" /> Webhook не подписан
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Welcome/help messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-5 w-5" /> Тексты бота
          </CardTitle>
          <CardDescription>
            Сообщения, которые видят пользователи при первом запуске бота и при команде /help.
            Многострочный текст поддерживается.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="welcome">Приветствие (/start)</Label>
            <Textarea
              id="welcome"
              value={settings.welcomeMessage}
              onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
              rows={6}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="help">Справка (/help)</Label>
            <Textarea
              id="help"
              value={settings.helpMessage}
              onChange={(e) => setSettings({ ...settings, helpMessage: e.target.value })}
              rows={6}
              className="text-sm"
            />
          </div>

          <div className="flex items-start gap-3 rounded-md bg-blue-50 border border-blue-200 p-3">
            <Switch
              id="llm-enabled"
              checked={settings.llmEnabled !== 'false'}
              onCheckedChange={(v) =>
                setSettings({ ...settings, llmEnabled: v ? 'true' : 'false' })
              }
              disabled={saving}
            />
            <div className="space-y-0.5">
              <Label htmlFor="llm-enabled" className="text-sm font-medium">
                ИИ-ассистент для незнакомых вопросов
              </Label>
              <p className="text-xs text-blue-800">
                Когда поиск по базе FAQ не находит ответа, бот попытается сформулировать
                осмысленный ответ на основе всей базы знаний с помощью языковой модели.
                ИИ не выдумывает факты — отвечает только в рамках базы. Если в базе нет
                релевантной информации, бот мягко предложит связаться с командой.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить настройки'}
          </Button>
        </CardFooter>
      </Card>

      {/* Backup / Restore / Commands */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-5 w-5" /> Бэкап и расширенные действия
          </CardTitle>
          <CardDescription>
            Резервное копирование базы знаний, восстановление из файла, регистрация
            команд бота в MAX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <a
              href="/api/knowledge/export"
              className="flex flex-col items-start gap-1 p-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
            >
              <Download className="h-5 w-5 text-blue-600" />
              <div className="font-medium">Экспорт базы знаний</div>
              <div className="text-xs text-muted-foreground">
                Скачать JSON со всеми категориями и ответами для бэкапа.
              </div>
            </a>

            <label className="flex flex-col items-start gap-1 p-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-sm cursor-pointer">
              <Upload className="h-5 w-5 text-sky-600" />
              <div className="font-medium">Импорт базы знаний</div>
              <div className="text-xs text-muted-foreground">
                Восстановить из JSON-файла. Текущая база будет заменена.
              </div>
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportFile}
                disabled={importing}
              />
              {importing && <span className="text-xs text-blue-700">Импорт...</span>}
            </label>

            <button
              onClick={registerCommands}
              disabled={registeringCommands}
              className="flex flex-col items-start gap-1 p-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-sm text-left disabled:opacity-50"
            >
              <Terminal className="h-5 w-5 text-violet-600" />
              <div className="font-medium">Регистрация команд</div>
              <div className="text-xs text-muted-foreground">
                Зарегистрировать /start и /help в MAX — появятся в автодополнении команд.
              </div>
            </button>
          </div>

          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <strong>Внимание:</strong> Импорт полностью заменяет все категории и ответы
            текущей базы. Сделайте резервную копию (экспорт) перед импортом.
          </div>
        </CardContent>
      </Card>

      {/* Commands management */}
      <CommandsPanel />

      {/* Broadcasts */}
      <BroadcastsPanel />

      {/* Test send */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-5 w-5" /> Тестовая отправка
          </CardTitle>
          <CardDescription>
            Отправить произвольное сообщение конкретному пользователю по его MAX ID. Полезно
            для проверки работы бота и срочных уведомлений.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[200px_1fr]">
            <Input
              placeholder="MAX User ID"
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
              className="font-mono"
            />
            <Input
              placeholder="Текст сообщения"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
            />
          </div>
          <Button onClick={sendTest} disabled={sendingTest} variant="secondary">
            {sendingTest ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Отправить сообщение
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5" /> Инструкция для сотрудников
          </CardTitle>
          <CardDescription>
            Краткое руководство по наполнению и обновлению базы ответов без участия разработчика.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-md bg-blue-50 border border-blue-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-900 font-medium">
              <Lightbulb className="h-4 w-4" /> Как обновить базу ответов
            </div>
            <ol className="list-decimal list-inside space-y-1 text-blue-800">
              <li>Откройте раздел <strong>"Категории"</strong> — создайте новый раздел или отредактируйте существующий.</li>
              <li>Перейдите в раздел <strong>"База знаний"</strong> — добавьте или измените вопрос и ответ.</li>
              <li>Заполните поле <strong>"Ключевые слова"</strong> — это поможет боту искать ответ на свободные запросы пользователей.</li>
              <li>Включите переключатель <strong>"Опубликовано"</strong>, чтобы ответ стал виден в боте.</li>
              <li>Изменения применяются <strong>мгновенно</strong> — перезапуск бота не требуется.</li>
            </ol>
          </div>

          <div className="rounded-md bg-amber-50 border border-amber-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-medium">
              <Info className="h-4 w-4" /> Если что-то не работает
            </div>
            <ul className="list-disc list-inside space-y-1 text-amber-800">
              <li>Проверьте, что токен бота указан в разделе <strong>"Подключение бота"</strong> и валиден (кнопка "Проверить бота").</li>
              <li>Убедитесь, что webhook подписан (статус "Подписка активна" в разделе <strong>"Webhook"</strong>).</li>
              <li>Откройте раздел <strong>"Логи"</strong> — посмотрите, доходят ли входящие сообщения.</li>
              <li>При необходимости свяжитесь с администратором системы.</li>
            </ul>
          </div>

          <div className="rounded-md bg-sky-50 border border-sky-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sky-900 font-medium">
              <Bot className="h-4 w-4" /> Что умеет бот
            </div>
            <ul className="list-disc list-inside space-y-1 text-sky-800">
              <li>Показывать категории и ответы через inline-кнопки.</li>
              <li>Принимать команды <code>/start</code> и <code>/help</code>.</li>
              <li>Искать ответы по ключевым словам в свободной форме.</li>
              <li>Подключать ИИ-ассистента для запросов без точного совпадения в базе (можно отключить).</li>
              <li>Считать просмотры каждого ответа для статистики.</li>
              <li>Логировать все обращения для аналитики.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function HealthItem({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      <div
        className={`flex-shrink-0 w-3 h-3 rounded-full ${ok ? 'bg-blue-500' : 'bg-red-500'}`}
      />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{text}</div>
      </div>
    </div>
  )
}
