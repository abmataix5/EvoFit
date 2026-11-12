import { queryOptions } from '@tanstack/react-query'
import { api } from './api'

export type LeagueMetric = 'days' | 'volume' | 'records'

export type LeagueEntry = {
  user: { id: number; name: string; username: string | null; avatar_url: string | null }
  me: boolean
  days: number
  sets: number
  volume_kg: number
  records: number
}

export type League = {
  week: { from: string; to: string; weeks_ago: number; current: boolean; days_left: number }
  entries: LeagueEntry[]
}

export type RankedEntry = LeagueEntry & { position: number | null; score: number }

export const leagueQuery = (weeksAgo = 0) =>
  queryOptions({
    queryKey: ['league', weeksAgo],
    queryFn: async () => (await api.get<League>('/league', { params: weeksAgo ? { weeks_ago: weeksAgo } : {} })).data,
    staleTime: 60_000,
  })

export type LeagueWeek = {
  week_start: string
  week_end: string
  participants: number
  positions: Record<LeagueMetric, number | null>
  days: number
  sets: number
  volume_kg: number
  records: number
}

/** Semanas ya cerradas (las últimas 12) y cuántas has ganado. */
export const leagueHistoryQuery = queryOptions({
  queryKey: ['league', 'history'],
  queryFn: async () => (await api.get<{ weeks: LeagueWeek[]; wins: number }>('/league/history')).data,
  staleTime: 5 * 60_000,
})

export const METRICS: ReadonlyArray<{ id: LeagueMetric; label: string }> = [
  { id: 'days', label: 'Días' },
  { id: 'volume', label: 'Kilos' },
  { id: 'records', label: 'Récords' },
]

/** Puntuación principal y desempates de cada modalidad, de más a menos importante. */
function scores(entry: LeagueEntry, metric: LeagueMetric): number[] {
  if (metric === 'volume') return [entry.volume_kg, entry.days, entry.sets]
  if (metric === 'records') return [entry.records, entry.days, entry.sets]
  return [entry.days, entry.sets, entry.volume_kg]
}

/**
 * Ordena la clasificación. Quien empata en todo comparte puesto; quien aún no ha puntuado
 * va al final sin puesto (no tiene sentido ser "3.º" con cero).
 */
export function rank(entries: LeagueEntry[], metric: LeagueMetric): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const [x, y] = [scores(a, metric), scores(b, metric)]
    for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return y[i]! - x[i]!
    return a.user.name.localeCompare(b.user.name, 'es')
  })

  let position = 0
  let previous: number[] | null = null
  return sorted.map((entry, index) => {
    const current = scores(entry, metric)
    if (!previous || current.some((value, i) => value !== previous![i])) position = index + 1
    previous = current
    return { ...entry, score: current[0]!, position: current[0]! > 0 ? position : null }
  })
}

export function formatScore(entry: Pick<LeagueEntry, 'days' | 'volume_kg' | 'records'>, metric: LeagueMetric): string {
  if (metric === 'volume') {
    return entry.volume_kg >= 10000
      ? `${(entry.volume_kg / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} t`
      : `${entry.volume_kg.toLocaleString('es-ES')} kg`
  }
  if (metric === 'records') return `${entry.records} ${entry.records === 1 ? 'récord' : 'récords'}`
  return `${entry.days} ${entry.days === 1 ? 'día' : 'días'}`
}

/** Lo que acompaña a la puntuación: un dato secundario para dar contexto. */
export function scoreDetail(entry: LeagueEntry, metric: LeagueMetric): string {
  if (entry.days === 0) return 'Aún sin entrenar'
  const days = `${entry.days} ${entry.days === 1 ? 'día' : 'días'}`
  const sets = `${entry.sets} ${entry.sets === 1 ? 'serie' : 'series'}`
  return metric === 'days' ? sets : `${days} · ${sets}`
}

const METRIC_KEY = 'evofit:league-metric'

export function readMetric(): LeagueMetric {
  try {
    const value = localStorage.getItem(METRIC_KEY)
    return value === 'volume' || value === 'records' ? value : 'days'
  } catch {
    return 'days'
  }
}

export function storeMetric(metric: LeagueMetric) {
  try {
    localStorage.setItem(METRIC_KEY, metric)
  } catch {
    // Sin almacenamiento: la elección dura esta visita.
  }
}
