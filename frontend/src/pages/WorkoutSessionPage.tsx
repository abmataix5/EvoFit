import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { api, type ExerciseSetLog, type PreviousLift, type PreviousLiftSet, type WorkoutSession } from '../lib/api'
import {
  bestScoreLabel,
  formatDuration,
  formatScore,
  isTimeMode,
  joinDuration,
  splitDuration,
  type TimeDirection,
  type TrackingMode,
} from '../lib/tracking'

type SetDraft = {
  routine_exercise_id: number
  set_number: number
  weight_kg: string
  reps: string
  minutes: string
  seconds: string
}

type ExerciseGroup = {
  id: number
  name: string
  rest?: number | null
  muscle?: string | null
  mode: TrackingMode
  direction: TimeDirection
  goalSeconds: number | null
  sets: Array<SetDraft & { draftIndex: number }>
}

function scoreOfLift(mode: TrackingMode, source: PreviousLift) {
  return formatScore({
    mode,
    weight: source.best_weight_kg,
    reps: source.best_reps,
    duration: source.best_duration_seconds,
  })
}

function scoreOfSet(mode: TrackingMode, source: PreviousLiftSet) {
  return formatScore({
    mode,
    weight: source.weight_kg,
    reps: source.reps,
    duration: source.duration_seconds,
  })
}

function setLogged(draft: SetDraft, mode: TrackingMode) {
  if (isTimeMode(mode)) return joinDuration(draft.minutes, draft.seconds) != null
  return draft.weight_kg.trim() !== ''
}

function formatPreviousDate(iso: string) {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

function previousFor(session: WorkoutSession, exerciseId: number): PreviousLift | null {
  return session.previous_lifts?.[String(exerciseId)] ?? null
}

function buildDrafts(session: WorkoutSession): SetDraft[] {
  const exercises = session.day?.exercises ?? []
  const existing = new Map<string, ExerciseSetLog>()
  for (const log of session.set_logs ?? []) {
    existing.set(`${log.routine_exercise_id}-${log.set_number}`, log)
  }

  const drafts: SetDraft[] = []
  for (const exercise of exercises) {
    for (let set = 1; set <= exercise.default_sets; set += 1) {
      const key = `${exercise.id}-${set}`
      const log = existing.get(key)
      const mode = exercise.tracking_mode ?? 'weight_reps'
      const duration = splitDuration(log?.duration_seconds)
      drafts.push({
        routine_exercise_id: exercise.id,
        set_number: set,
        weight_kg: !isTimeMode(mode) || mode === 'weight_time'
          ? log?.weight_kg != null
            ? String(log.weight_kg)
            : ''
          : '',
        reps: mode === 'weight_reps'
          ? log?.reps != null
            ? String(log.reps)
            : String(exercise.default_reps)
          : '',
        minutes: duration.minutes,
        seconds: duration.seconds,
      })
    }
  }
  return drafts
}

export function WorkoutSessionPage() {
  const { id } = useParams()
  const sessionId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify, confirm } = useUiFeedback()

  const sessionQuery = useQuery({
    queryKey: ['workout-session', sessionId],
    enabled: Number.isFinite(sessionId),
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data } = await api.get<{ data: WorkoutSession }>(`/workout-sessions/${sessionId}`)
      return data.data
    },
  })

  const [drafts, setDrafts] = useState<SetDraft[]>([])
  const [openExerciseId, setOpenExerciseId] = useState<number | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const draftsRef = useRef<SetDraft[]>([])
  const hydratedRef = useRef(false)
  const pendingRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const flushRef = useRef<() => void>(() => {})

  const session = sessionQuery.data

  const groups = useMemo<ExerciseGroup[]>(() => {
    const exercises = session?.day?.exercises ?? []
    return exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      rest: exercise.rest_seconds,
      muscle: exercise.target_muscle,
      mode: exercise.tracking_mode ?? 'weight_reps',
      direction: exercise.time_direction ?? 'faster',
      goalSeconds: exercise.default_duration_seconds ?? null,
      sets: drafts
        .map((draft, draftIndex) => ({ ...draft, draftIndex }))
        .filter((draft) => draft.routine_exercise_id === exercise.id),
    }))
  }, [session, drafts])

  useEffect(() => {
    if (!session || pendingRef.current) return
    const next = buildDrafts(session)
    setDrafts(next)
    draftsRef.current = next
    if (!hydratedRef.current) {
      setOpenExerciseId(session.day?.exercises?.[0]?.id ?? null)
      hydratedRef.current = true
    }
  }, [session])

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  const saveMutation = useMutation({
    mutationFn: async (complete: boolean) => {
      const sets = draftsRef.current.map((draft) => ({
        routine_exercise_id: draft.routine_exercise_id,
        set_number: draft.set_number,
        weight_kg: draft.weight_kg === '' ? null : Number(draft.weight_kg),
        reps: draft.reps === '' ? null : Number(draft.reps),
        duration_seconds: joinDuration(draft.minutes, draft.seconds),
        completed: true,
      }))
      const { data } = await api.put<{ data: WorkoutSession }>(`/workout-sessions/${sessionId}/logs`, {
        sets,
        complete,
      })
      return { complete, session: data.data }
    },
    onMutate: () => setSaveState('saving'),
    onSuccess: async ({ complete, session: saved }) => {
      setSaveState('saved')
      queryClient.setQueryData(['workout-session', sessionId], saved)
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      await queryClient.invalidateQueries({ queryKey: ['routine-history'] })
      if (pendingRef.current) {
        flushRef.current()
      }
      if (complete) {
        notify('Sesión completada', 'success')
        navigate('/calendar')
      }
    },
    onError: () => {
      setSaveState('error')
      notify('No se pudo guardar. Revisa la conexión.', 'error')
    },
  })

  function flushAutosave() {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (!pendingRef.current) return
    pendingRef.current = false
    saveMutation.mutate(false)
  }

  flushRef.current = flushAutosave

  function queueAutosave() {
    pendingRef.current = true
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      flushAutosave()
    }, 250)
  }

  function updateDraft(index: number, patch: Partial<SetDraft>) {
    setDrafts((current) => {
      const next = current.map((item, i) => (i === index ? { ...item, ...patch } : item))
      draftsRef.current = next
      return next
    })
    setSaveState('idle')
    queueAutosave()
  }

  async function completeSession() {
    const ok = await confirm({
      title: '¿Completar sesión?',
      message: 'Se marcará como hecha en el calendario. Podrás seguir viendo kilos y tiempos en el historial.',
      confirmLabel: 'Completar',
      cancelLabel: 'Seguir editando',
    })
    if (!ok) return
    pendingRef.current = false
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    saveMutation.mutate(true)
  }

  useEffect(() => {
    function flushIfHidden() {
      if (document.visibilityState === 'hidden') flushRef.current()
    }
    function flushOnLeave() {
      flushRef.current()
    }
    document.addEventListener('visibilitychange', flushIfHidden)
    window.addEventListener('pagehide', flushOnLeave)
    return () => {
      document.removeEventListener('visibilitychange', flushIfHidden)
      window.removeEventListener('pagehide', flushOnLeave)
      flushRef.current()
    }
  }, [])

  if (sessionQuery.isLoading) {
    return <p className="text-sm text-evo-muted">Cargando sesión…</p>
  }

  if (!session) {
    return <p className="text-sm font-semibold text-evo-danger">Sesión no encontrada.</p>
  }

  const modeByExercise = new Map((session.day?.exercises ?? []).map((exercise) => [exercise.id, exercise.tracking_mode ?? 'weight_reps']))
  const filledSets = drafts.filter((draft) => setLogged(draft, modeByExercise.get(draft.routine_exercise_id) ?? 'weight_reps')).length
  const totalSets = drafts.length

  return (
    <div className="space-y-4 pb-28 lg:pb-0">
      <div className="panel space-y-2 p-4">
        <Link
          to={`/routines/${session.routine_id}`}
          className="text-sm font-semibold text-evo-accent hover:text-evo-accent-soft"
        >
          ← Rutina
        </Link>
        <h2 className="font-display text-2xl font-bold">
          {session.day?.name ?? session.routine?.name ?? 'Entrenamiento'}
        </h2>
        <p className="text-sm text-evo-muted">
          {session.routine?.name} · {session.scheduled_date}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="chip bg-evo-surface-2 text-evo-muted">
            {filledSets}/{totalSets} series anotadas
          </span>
          <span
            className={[
              'chip',
              saveState === 'saving'
                ? 'bg-evo-warn/20 text-evo-warn'
                : saveState === 'saved'
                  ? 'bg-evo-lime/20 text-[#163000]'
                  : saveState === 'error'
                    ? 'bg-evo-danger/20 text-evo-danger'
                    : 'bg-evo-surface-2 text-evo-muted',
            ].join(' ')}
            aria-live="polite"
          >
            {saveState === 'saving'
              ? 'Guardando…'
              : saveState === 'saved'
                ? 'Guardado automático'
                : saveState === 'error'
                  ? 'Error al guardar'
                  : 'Los cambios se guardan solos'}
          </span>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-evo-muted">Este día no tiene ejercicios configurados.</p>
      ) : (
        <ul className="space-y-2">
          {groups.map((group, index) => {
            const open = openExerciseId === group.id
            const doneSets = group.sets.filter((set) => setLogged(set, group.mode)).length
            const previous = previousFor(session, group.id)
            const loggedLabel = isTimeMode(group.mode) ? 'con tiempo' : 'con kg'
            return (
              <li key={group.id} className="panel overflow-hidden">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenExerciseId(open ? null : group.id)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-evo-surface-2/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-evo-accent/20 text-sm font-bold text-evo-accent">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-bold">{group.name}</span>
                    {previous ? (
                      <span className="mt-0.5 block text-sm font-semibold text-evo-accent">
                        Última {formatPreviousDate(previous.recorded_on)} · {scoreOfLift(group.mode, previous)}
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-sm text-evo-muted">Primera vez</span>
                    )}
                    <span className="block text-xs text-evo-muted">
                      {group.sets.length} series
                      {doneSets > 0 ? ` · ${doneSets} ${loggedLabel}` : ''}
                    </span>
                  </span>
                  <span className="text-evo-muted" aria-hidden>
                    {open ? '▲' : '▼'}
                  </span>
                </button>

                {open ? (
                  <div className="space-y-2 border-t border-evo-border bg-evo-bg/30 px-3 py-3">
                    {isTimeMode(group.mode) ? (
                      <p className="px-1 text-sm text-evo-muted">
                        {group.direction === 'longer' ? 'Más tiempo es mejor.' : 'Menos tiempo es mejor.'}
                        {group.goalSeconds ? ` Objetivo ${formatDuration(group.goalSeconds)}.` : ''}
                      </p>
                    ) : null}
                    {previous ? (
                      <div className="rounded-2xl bg-evo-surface px-3 py-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">
                          Última vez · {formatPreviousDate(previous.recorded_on)}
                        </p>
                        <p className="mt-1 font-display text-lg font-bold">
                          {bestScoreLabel(group.mode, group.direction)} {scoreOfLift(group.mode, previous)}
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {previous.sets.map((prev) => (
                            <li
                              key={prev.set_number}
                              className="rounded-full bg-evo-surface-2 px-3 py-1 text-sm font-semibold"
                            >
                              S{prev.set_number} {scoreOfSet(group.mode, prev)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {group.sets.map((set) => {
                      const previousSet = previous?.sets.find((prev) => prev.set_number === set.set_number)
                      return (
                      <div
                        key={`${group.id}-${set.set_number}`}
                        className="min-w-0 rounded-2xl border border-evo-border bg-evo-surface-2 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-evo-accent">Serie {set.set_number}</span>
                          {previousSet ? (
                            <button
                              type="button"
                              className="rounded-full bg-evo-bg px-3 py-1 text-sm font-semibold text-evo-text"
                              onClick={() => {
                                const duration = splitDuration(previousSet.duration_seconds)
                                updateDraft(set.draftIndex, {
                                  weight_kg:
                                    previousSet.weight_kg != null ? String(previousSet.weight_kg) : '',
                                  reps: previousSet.reps != null ? String(previousSet.reps) : set.reps,
                                  minutes: duration.minutes,
                                  seconds: duration.seconds,
                                })
                              }}
                            >
                              Usar {scoreOfSet(group.mode, previousSet)}
                            </button>
                          ) : null}
                        </div>
                        <div className="grid min-w-0 grid-cols-2 gap-2">
                        {group.mode !== 'time' ? (
                        <div className={group.mode === 'weight_time' ? 'col-span-2 min-w-0' : 'min-w-0'}>
                          <Input
                            label="Kg"
                            inputMode="decimal"
                            value={set.weight_kg}
                            onChange={(e) => updateDraft(set.draftIndex, { weight_kg: e.target.value })}
                          />
                        </div>
                        ) : null}
                        {group.mode === 'weight_reps' ? (
                        <div className="min-w-0">
                          <Input
                            label="Reps"
                            inputMode="numeric"
                            value={set.reps}
                            onChange={(e) => updateDraft(set.draftIndex, { reps: e.target.value })}
                          />
                        </div>
                        ) : (
                          <>
                            <div className="min-w-0">
                              <Input
                                label="Min"
                                inputMode="numeric"
                                value={set.minutes}
                                placeholder="0"
                                onChange={(e) => updateDraft(set.draftIndex, { minutes: e.target.value })}
                              />
                            </div>
                            <div className="min-w-0">
                              <Input
                                label="Seg"
                                inputMode="numeric"
                                value={set.seconds}
                                placeholder="00"
                                onChange={(e) => updateDraft(set.draftIndex, { seconds: e.target.value })}
                                onBlur={() => {
                                  const total = joinDuration(set.minutes, set.seconds)
                                  if (total == null) return
                                  const parts = splitDuration(total)
                                  updateDraft(set.draftIndex, parts)
                                }}
                              />
                            </div>
                          </>
                        )}
                        </div>
                      </div>
                      )
                    })}
                    {index < groups.length - 1 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        onClick={() => setOpenExerciseId(groups[index + 1]?.id ?? null)}
                      >
                        Siguiente ejercicio →
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-evo-border bg-evo-bg/95 px-4 pt-3 backdrop-blur-md lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0">
        <Button
          size="lg"
          fullWidth
          disabled={saveMutation.isPending || drafts.length === 0}
          onClick={() => void completeSession()}
        >
          Completar sesión
        </Button>
      </div>
    </div>
  )
}
