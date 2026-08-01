/** Locale-aware formatters. Hebrew (he-IL) with ILS currency throughout. */

const currencyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
})

const preciseCurrencyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('he-IL')

const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const longDateFormatter = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const timeFormatter = new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatCurrency(amount, { precise = false } = {}) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—'
  return precise ? preciseCurrencyFormatter.format(amount) : currencyFormatter.format(amount)
}

export function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return numberFormatter.format(value)
}

export function formatDate(value) {
  const date = toDate(value)
  return date ? dateFormatter.format(date) : '—'
}

export function formatLongDate(value) {
  const date = toDate(value)
  return date ? longDateFormatter.format(date) : '—'
}

export function formatTime(value) {
  const date = toDate(value)
  return date ? timeFormatter.format(date) : '—'
}

export function formatDateTime(value) {
  const date = toDate(value)
  return date ? `${dateFormatter.format(date)} · ${timeFormatter.format(date)}` : '—'
}

/** "לפני 5 דקות" style stamps for the admin activity feed. */
export function formatRelativeTime(value, now = Date.now()) {
  const date = toDate(value)
  if (!date) return '—'

  const diffMs = date.getTime() - now
  const diffMinutes = Math.round(diffMs / 60000)
  const rtf = new Intl.RelativeTimeFormat('he-IL', { numeric: 'auto' })

  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute')
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour')

  const diffDays = Math.round(diffHours / 24)
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day')
  if (Math.abs(diffDays) < 30) return rtf.format(Math.round(diffDays / 7), 'week')
  if (Math.abs(diffDays) < 365) return rtf.format(Math.round(diffDays / 30), 'month')
  return rtf.format(Math.round(diffDays / 365), 'year')
}

/** ISO date key (YYYY-MM-DD) in local time, used as the calendar/slot key. */
export function toDateKey(value) {
  const date = toDate(value)
  if (!date) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 12345678 -> 123-45-678, the Israeli plate grouping. */
export function formatLicensePlate(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 7) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
  if (digits.length === 8) return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
  return digits
}

export function formatPhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  return digits
}

export function initialsOf(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}
