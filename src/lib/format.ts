// Formatting helpers for UI display

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

// "5 минут назад", "2 часа назад", "вчера", etc.
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  if (diff < 0) return 'только что'
  if (diff < MINUTE) return 'только что'
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE)
    return `${m} ${plural(m, ['минуту', 'минуты', 'минут'])} назад`
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR)
    return `${h} ${plural(h, ['час', 'часа', 'часов'])} назад`
  }
  if (diff < 2 * DAY) return 'вчера'
  if (diff < WEEK) {
    const d2 = Math.floor(diff / DAY)
    return `${d2} ${plural(d2, ['день', 'дня', 'дней'])} назад`
  }
  if (diff < MONTH) {
    const w = Math.floor(diff / WEEK)
    return `${w} ${plural(w, ['неделю', 'недели', 'недель'])} назад`
  }
  if (diff < YEAR) {
    const m = Math.floor(diff / MONTH)
    return `${m} ${plural(m, ['месяц', 'месяца', 'месяцев'])} назад`
  }
  return d.toLocaleDateString('ru-RU')
}

// Russian plural form helper
function plural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return forms[0]
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1]
  return forms[2]
}

// Format duration in ms to human-readable: "1.2 с" or "45 мс"
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} мс`
  return `${(ms / 1000).toFixed(1)} с`
}

// Format absolute timestamp compactly: "24.09 14:30"
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
