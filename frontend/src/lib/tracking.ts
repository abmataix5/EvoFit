export type TrackingMode = 'weight_reps' | 'time' | 'weight_time'
export type TimeDirection = 'faster' | 'longer'

export function isTimeMode(mode: TrackingMode | null | undefined): boolean {
  return mode === 'time' || mode === 'weight_time'
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(Number(totalSeconds))) return '—'
  const total = Math.max(0, Math.round(Number(totalSeconds)))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function splitDuration(totalSeconds: number | null | undefined): { minutes: string; seconds: string } {
  if (totalSeconds == null || !Number.isFinite(Number(totalSeconds))) {
    return { minutes: '', seconds: '' }
  }
  const total = Math.max(0, Math.round(Number(totalSeconds)))
  return {
    minutes: String(Math.floor(total / 60)),
    seconds: String(total % 60),
  }
}

export function joinDuration(minutes: string, seconds: string): number | null {
  if (minutes.trim() === '' && seconds.trim() === '') return null
  const parsedMinutes = minutes.trim() === '' ? 0 : Number(minutes)
  const parsedSeconds = seconds.trim() === '' ? 0 : Number(seconds)
  if (!Number.isFinite(parsedMinutes) || !Number.isFinite(parsedSeconds)) return null
  if (parsedMinutes < 0 || parsedSeconds < 0) return null
  const total = Math.round(parsedMinutes) * 60 + Math.round(parsedSeconds)
  return total > 0 ? total : null
}

export function formatScore(input: {
  mode: TrackingMode
  weight?: number | null
  reps?: number | null
  duration?: number | null
}): string {
  const kg =
    input.weight != null && Number.isFinite(Number(input.weight))
      ? `${Number(input.weight).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`
      : null
  const time = input.duration != null ? formatDuration(input.duration) : null

  if (input.mode === 'time') return time ?? '—'
  if (input.mode === 'weight_time') {
    if (kg && time) return `${kg} · ${time}`
    return kg ?? time ?? '—'
  }
  if (kg && input.reps != null) return `${kg} × ${input.reps}`
  return kg ?? '—'
}

export function modeLabel(mode: TrackingMode): string {
  if (mode === 'time') return 'Solo tiempo'
  if (mode === 'weight_time') return 'Tiempo y kilos'
  return 'Kilos y reps'
}

export function directionLabel(direction: TimeDirection): string {
  return direction === 'longer' ? 'Más tiempo es mejor' : 'Menos tiempo es mejor'
}

export function bestScoreLabel(mode: TrackingMode, direction: TimeDirection | null | undefined): string {
  if (mode === 'weight_reps') return 'Mejor serie'
  if (direction === 'longer') return 'Mayor tiempo'
  return 'Mejor tiempo'
}

export function exercisePlanLabel(exercise: {
  tracking_mode?: TrackingMode | null
  time_direction?: TimeDirection | null
  default_sets: number
  default_reps: number
  default_duration_seconds?: number | null
  rest_seconds?: number | null
}): string {
  const mode = exercise.tracking_mode ?? 'weight_reps'
  const pause = exercise.rest_seconds ? ` · ${exercise.rest_seconds}s pausa` : ''
  if (!isTimeMode(mode)) {
    return `${exercise.default_sets}×${exercise.default_reps}${pause}`
  }
  const goal = exercise.default_duration_seconds
    ? ` · objetivo ${formatDuration(exercise.default_duration_seconds)}`
    : ''
  const direction = exercise.time_direction === 'longer' ? ' · más tiempo' : ' · menos tiempo'
  return `${exercise.default_sets} series${goal}${direction}${pause}`
}
