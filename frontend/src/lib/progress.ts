import { queryOptions } from '@tanstack/react-query'
import { api } from './api'

export type ProgressRange = 4 | 12 | 52

export const RANGE_OPTIONS: Array<{ weeks: ProgressRange; label: string; previous: string }> = [
  { weeks: 4, label: '4 semanas', previous: 'las 4 anteriores' },
  { weeks: 12, label: '3 meses', previous: 'los 3 anteriores' },
  { weeks: 52, label: '1 año', previous: 'el año anterior' },
]

export type ProgressKpis = { workouts: number; sets: number; volume_kg: number; minutes: number; records: number }

export type StrengthPoint = { date: string; e1rm: number; weight_kg: number; reps: number }

export type StrengthExercise = {
  key: string
  name: string
  muscle: string | null
  image_url: string | null
  routine_exercise_id: number
  sessions: number
  best_e1rm: number
  best_weight_kg: number
  all_time_best_kg: number | null
  change_pct: number | null
  points: StrengthPoint[]
}

export type RecordEvent = {
  date: string
  exercise: string
  routine_exercise_id: number
  image_url: string | null
  weight_kg: number
  reps: number | null
  previous_kg: number
}

export type ProgressOverview = {
  range_weeks: ProgressRange
  period: { from: string; to: string }
  kpis: { current: ProgressKpis; previous: ProgressKpis }
  weekly: Array<{ week_start: string; workouts: number; sets: number; volume_kg: number }>
  calendar: { from: string; to: string; days: Record<string, number> }
  records: RecordEvent[]
  exercises: StrengthExercise[]
}

export const overviewQuery = (weeks: ProgressRange) =>
  queryOptions({
    queryKey: ['progress-overview', weeks],
    queryFn: async () => (await api.get<ProgressOverview>('/progress/overview', { params: { weeks } })).data,
    placeholderData: (previous) => previous,
  })

export function formatKg(value: number | null | undefined, digits = 1) {
  if (value == null) return '—'
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: digits })} kg`
}

/** Volumen legible: 12.400 kg o 1,2 t. */
export function formatVolume(kg: number) {
  return kg >= 10000 ? `${(kg / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} t` : `${kg.toLocaleString('es-ES')} kg`
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  // A partir de 10 h, los minutos sobran (y no caben en la tarjeta).
  if (minutes >= 600) return `${Math.round(minutes / 60)} h`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Cambio en % frente al periodo anterior (null si no hay base para comparar). */
export function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0
  return Math.round(((current - previous) / previous) * 100)
}

export function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
