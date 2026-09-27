// Client-side API helpers — thin wrappers around fetch with JSON
'use client'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Routes return { error: <code>, detail: <human-readable> }. Prefer detail so
    // the UI shows an actionable message instead of a bare code like "create_failed".
    const d = data as Record<string, unknown>
    const message = (d.detail as string) || (d.error as string) || `HTTP ${res.status}`
    throw new Error(message)
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}
