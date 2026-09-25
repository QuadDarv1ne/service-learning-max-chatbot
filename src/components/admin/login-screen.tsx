// Login screen — shown when user is not authenticated
'use client'

import { useState } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { MessageCircle } from 'lucide-react'

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/login', { password })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#007aff] to-[#630eff] flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl">Чат-бот MAX</CardTitle>
            <CardDescription className="text-base">
              Программа "Обучение служением. Первые"
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Пароль администратора
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                disabled={loading}
                autoFocus
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="rounded-md bg-accent border border-border px-3 py-2 text-xs text-accent-foreground">
              <strong>Демо-доступ:</strong> пароль по умолчанию — <code className="font-mono bg-background px-1 rounded">admin123</code>.
              В продакшене задайте переменную окружения <code className="font-mono bg-background px-1 rounded">ADMIN_PASSWORD</code>.
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading || !password}>
              {loading ? 'Вход...' : 'Войти в админ-панель'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
