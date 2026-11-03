/** Utilidades de fecha en hora local (nunca UTC: en España toISOString da el día anterior de madrugada). */

export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** "mar 3 nov" */
export function formatDayLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = parseDateKey(iso)
  return date
    .toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '')
}

/** "3 nov" */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return parseDateKey(iso)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    .replace(/\./g, '')
}

/** "03/11" */
export function formatDayMonth(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}`
}

/** Lunes de la semana de `date`. */
export function startOfWeek(date: Date = new Date()): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offset = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - offset)
  return result
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Días transcurridos desde una fecha ISO hasta hoy (0 = hoy). */
export function daysAgo(iso: string): number {
  const ms = parseDateKey(localDateKey()).getTime() - parseDateKey(iso).getTime()
  return Math.round(ms / 86_400_000)
}

export function relativeDayLabel(iso: string): string {
  const n = daysAgo(iso)
  if (n <= 0) return 'hoy'
  if (n === 1) return 'ayer'
  if (n < 7) return `hace ${n} días`
  if (n < 14) return 'hace 1 semana'
  if (n < 60) return `hace ${Math.floor(n / 7)} semanas`
  return formatShortDate(iso)
}
