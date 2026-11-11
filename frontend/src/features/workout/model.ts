import type { ExerciseSetLog, PreviousLift, PreviousLiftSet, RoutineExercise, WorkoutSession } from '../../lib/api'
import { isTimeMode, joinDuration, splitDuration, type TimeDirection, type TrackingMode } from '../../lib/tracking'
import type { StoredSetDraft } from '../../lib/workoutDrafts'

export type SetDraft = StoredSetDraft

export type ExerciseGroup = {
  exercise: RoutineExercise
  id: number
  name: string
  rest: number
  mode: TrackingMode
  direction: TimeDirection
  goalSeconds: number | null
  defaultReps: number
  previous: PreviousLift | null
  sets: Array<SetDraft & { draftIndex: number }>
}

export const MAX_SETS = 20

export function parseDecimal(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (trimmed === '' || trimmed === '.') return null
  const n = Number(trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed)
  return Number.isFinite(n) ? n : null
}

export function parseInteger(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? Math.round(n) : null
}

export function modeOf(exercise: RoutineExercise): TrackingMode {
  return exercise.tracking_mode ?? 'weight_reps'
}

/** Serie con el dato principal apuntado (kg, o tiempo en ejercicios por tiempo). */
export function setLogged(draft: SetDraft, mode: TrackingMode) {
  if (isTimeMode(mode)) return joinDuration(draft.minutes, draft.seconds) != null
  return draft.weight_kg.trim() !== ''
}

/** Ejercicios de hoy: los del día con los cambios de esta sesión (versiones antiguas: los del día). */
export function sessionExercises(session: WorkoutSession): RoutineExercise[] {
  return session.exercises ?? session.day?.exercises ?? []
}

export function previousFor(session: WorkoutSession, exerciseId: number): PreviousLift | null {
  return session.previous_lifts?.[String(exerciseId)] ?? null
}

/** Serie de referencia de la última vez: la misma serie o, si hoy haces más, la última que hiciste. */
export function previousSetFor(previous: PreviousLift | null, setNumber: number): PreviousLiftSet | null {
  if (!previous || previous.sets.length === 0) return null
  return previous.sets.find((set) => set.set_number === setNumber) ?? previous.sets[previous.sets.length - 1] ?? null
}

function emptyDraft(exercise: RoutineExercise, setNumber: number): SetDraft {
  return {
    routine_exercise_id: exercise.id,
    set_number: setNumber,
    weight_kg: '',
    reps: '',
    minutes: '',
    seconds: '',
    rpe: '',
    notes: '',
    done: false,
  }
}

export function newSetDraft(exercise: RoutineExercise, setNumber: number): SetDraft {
  return emptyDraft(exercise, setNumber)
}

function draftFromLog(exercise: RoutineExercise, log: ExerciseSetLog): SetDraft {
  const mode = modeOf(exercise)
  const duration = splitDuration(log.duration_seconds)
  const draft: SetDraft = {
    ...emptyDraft(exercise, log.set_number),
    weight_kg: mode !== 'time' && log.weight_kg != null ? String(Number(log.weight_kg)) : '',
    reps: mode === 'weight_reps' && log.reps != null ? String(log.reps) : '',
    minutes: isTimeMode(mode) ? duration.minutes : '',
    seconds: isTimeMode(mode) ? duration.seconds : '',
    rpe: log.rpe != null ? String(log.rpe) : '',
    notes: log.notes ?? '',
  }
  // Antes de existir el check, todas las series se guardaban como "completed": solo cuentan si tienen dato.
  draft.done = Boolean(log.completed) && setLogged(draft, mode)
  return draft
}

export function buildDrafts(session: WorkoutSession): SetDraft[] {
  const exercises = sessionExercises(session)
  const logsByExercise = new Map<number, ExerciseSetLog[]>()
  for (const log of session.set_logs ?? []) {
    const list = logsByExercise.get(log.routine_exercise_id) ?? []
    list.push(log)
    logsByExercise.set(log.routine_exercise_id, list)
  }

  const drafts: SetDraft[] = []
  for (const exercise of exercises) {
    const logs = logsByExercise.get(exercise.id) ?? []
    const maxLogged = logs.reduce((max, log) => Math.max(max, log.set_number), 0)
    const count = Math.min(MAX_SETS, Math.max(exercise.default_sets || 1, maxLogged))
    for (let set = 1; set <= count; set += 1) {
      const log = logs.find((item) => item.set_number === set)
      drafts.push(log ? draftFromLog(exercise, log) : emptyDraft(exercise, set))
    }
  }
  return drafts
}

/** Si hay copia local, manda ella; se completa con ejercicios nuevos que no estuvieran. */
export function mergeLocalDrafts(session: WorkoutSession, local: SetDraft[]): SetDraft[] {
  const exercises = sessionExercises(session)
  const fromServer = buildDrafts(session)
  const result: SetDraft[] = []
  for (const exercise of exercises) {
    const mine = local.filter((draft) => draft.routine_exercise_id === exercise.id)
    const sorted = (mine.length > 0 ? mine : fromServer.filter((d) => d.routine_exercise_id === exercise.id))
      .map((draft) => ({ ...emptyDraft(exercise, draft.set_number), ...draft }))
      .sort((a, b) => a.set_number - b.set_number)
    result.push(...sorted)
  }
  return result
}

export function toPayloadSet(draft: SetDraft) {
  return {
    routine_exercise_id: draft.routine_exercise_id,
    set_number: draft.set_number,
    weight_kg: parseDecimal(draft.weight_kg),
    reps: parseInteger(draft.reps),
    duration_seconds: joinDuration(draft.minutes, draft.seconds),
    rpe: parseDecimal(draft.rpe),
    notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
    completed: draft.done,
  }
}

export function estimateOneRepMax(weight: number | null, reps: number | null): number | null {
  if (weight == null || reps == null || weight <= 0 || reps <= 0) return null
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

/** Redondea al disco más pequeño habitual (1,25 kg por lado = 2,5 kg). */
function roundToPlate(kg: number) {
  return Math.round(kg / 2.5) * 2.5
}

/**
 * Sugerencia de doble progresión: si la última vez completaste todas las series
 * con las reps objetivo, toca subir peso; si no, repetir.
 */
export function progressionSuggestion(group: Pick<ExerciseGroup, 'mode' | 'defaultReps' | 'previous'>):
  | { kind: 'up' | 'repeat'; weight: number; reps: number }
  | null {
  const previous = group.previous
  if (group.mode !== 'weight_reps' || !previous || previous.best_weight_kg == null) return null
  const topWeight = previous.best_weight_kg
  const topSets = previous.sets.filter((set) => set.weight_kg === topWeight)
  const target = group.defaultReps > 0 ? group.defaultReps : 8
  const hitAll = topSets.length > 0 && topSets.every((set) => (set.reps ?? 0) >= target)
  if (hitAll) {
    const step = topWeight < 20 ? 1 : 2.5
    return { kind: 'up', weight: step === 2.5 ? roundToPlate(topWeight + step) : topWeight + step, reps: target }
  }
  return { kind: 'repeat', weight: topWeight, reps: target }
}

export function formatKg(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return `${Number(value).toLocaleString('es-ES', { maximumFractionDigits: 2 })} kg`
}

export type SessionStats = {
  doneSets: number
  totalSets: number
  volumeKg: number
  records: Array<{ exercise: string; label: string }>
}

export function sessionStats(groups: ExerciseGroup[]): SessionStats {
  let doneSets = 0
  let totalSets = 0
  let volumeKg = 0
  const records: SessionStats['records'] = []

  for (const group of groups) {
    totalSets += group.sets.length
    let bestWeight: number | null = null
    let bestRepsAtBest: number | null = null
    let best1rm: number | null = null
    let bestDuration: number | null = null

    for (const set of group.sets) {
      if (!setLogged(set, group.mode)) continue
      if (set.done) doneSets += 1
      const weight = parseDecimal(set.weight_kg)
      const reps = parseInteger(set.reps)
      const duration = joinDuration(set.minutes, set.seconds)
      if (weight != null && reps != null) volumeKg += weight * reps
      if (weight != null && (bestWeight == null || weight > bestWeight)) {
        bestWeight = weight
        bestRepsAtBest = reps
      }
      const e1rm = estimateOneRepMax(weight, reps)
      if (e1rm != null && (best1rm == null || e1rm > best1rm)) best1rm = e1rm
      if (duration != null) {
        if (bestDuration == null) bestDuration = duration
        else bestDuration = group.direction === 'longer' ? Math.max(bestDuration, duration) : Math.min(bestDuration, duration)
      }
    }

    const previous = group.previous
    if (!previous) continue
    if (isTimeMode(group.mode)) {
      const record = previous.record_duration_seconds
      if (bestDuration != null && record != null) {
        const better = group.direction === 'longer' ? bestDuration > record : bestDuration < record
        if (better) records.push({ exercise: group.name, label: `Mejor tiempo` })
      }
      continue
    }
    if (bestWeight != null && previous.record_weight_kg != null && bestWeight > previous.record_weight_kg) {
      records.push({
        exercise: group.name,
        label: `${formatKg(bestWeight)}${bestRepsAtBest ? ` × ${bestRepsAtBest}` : ''} (antes ${formatKg(previous.record_weight_kg)})`,
      })
    } else if (best1rm != null && previous.record_est_1rm != null && best1rm > previous.record_est_1rm) {
      records.push({ exercise: group.name, label: `1RM estimado ${formatKg(best1rm)}` })
    }
  }

  return { doneSets, totalSets, volumeKg: Math.round(volumeKg), records }
}

/** ¿Esta serie supera el récord de siempre? */
export function isRecordSet(group: ExerciseGroup, draft: SetDraft): boolean {
  const previous = group.previous
  if (!previous || !setLogged(draft, group.mode)) return false
  if (isTimeMode(group.mode)) {
    const duration = joinDuration(draft.minutes, draft.seconds)
    const record = previous.record_duration_seconds
    if (duration == null || record == null) return false
    return group.direction === 'longer' ? duration > record : duration < record
  }
  const weight = parseDecimal(draft.weight_kg)
  if (weight == null) return false
  if (previous.record_weight_kg != null && weight > previous.record_weight_kg) return true
  const e1rm = estimateOneRepMax(weight, parseInteger(draft.reps))
  return e1rm != null && previous.record_est_1rm != null && e1rm > previous.record_est_1rm
}
