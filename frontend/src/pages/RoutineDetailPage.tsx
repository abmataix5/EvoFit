import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { LoadError } from '../components/feedback/LoadError'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Icon } from '../components/icons/Icon'
import { ExerciseImage } from '../components/exercises/ExerciseImage'
import { WeekStrip } from '../components/routines/WeekStrip'
import { Button, ButtonLink } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import {
  FOCUS_LABELS,
  WEEKDAY_LABELS,
  api,
  apiErrorMessage,
  type ExerciseSetLog,
  type Routine,
  type WorkoutSession,
} from '../lib/api'
import { formatDayLabel, localDateKey } from '../lib/dates'
import { invalidateTraining } from '../lib/queryClient'
import { exercisePlanLabel, formatScore } from '../lib/tracking'

export function RoutineDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirm, notify } = useUiFeedback()
  const routineId = Number(id)
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null)
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [expandedSession, setExpandedSession] = useState<number | null>(null)

  const routineQuery = useQuery({
    queryKey: ['routine', routineId],
    enabled: Number.isFinite(routineId),
    queryFn: async () => {
      const { data } = await api.get<{ data: Routine }>(`/routines/${routineId}`)
      return data.data
    },
  })

  const historyQuery = useQuery({
    queryKey: ['routine-history', routineId],
    enabled: Number.isFinite(routineId),
    queryFn: async () => {
      const { data } = await api.get<{ data: WorkoutSession[] }>(`/routines/${routineId}/history`)
      return data.data
    },
  })

  const routine = routineQuery.data
  const days = routine?.days ?? []
  const activeDay = days.find((day) => day.id === selectedDayId) ?? days[0]

  useEffect(() => {
    if (!routine) return
    setStartsOn(routine.starts_on ?? '')
    setEndsOn(routine.ends_on ?? '')
  }, [routine])

  const startSession = useMutation({
    mutationFn: async (dayId: number) => {
      // Fecha local: con toISOString de madrugada salía el día anterior.
      const today = localDateKey()
      const { data } = await api.post<{ session: WorkoutSession }>('/workout-sessions', {
        routine_id: routineId,
        routine_day_id: dayId,
        scheduled_date: today,
      })
      return data.session
    },
    onSuccess: async (session) => {
      void invalidateTraining()
      navigate(`/workout/${session.id}`)
    },
    onError: () => notify('No se pudo empezar la sesión. Revisa la conexión.', 'error'),
  })

  const toggleActive = useMutation({
    mutationFn: async (is_active: boolean) => {
      await api.patch(`/routines/${routineId}`, { is_active })
    },
    onSuccess: async (_, is_active) => {
      await queryClient.invalidateQueries({ queryKey: ['routine', routineId] })
      await queryClient.invalidateQueries({ queryKey: ['routines'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar-week'] })
      notify(is_active ? 'Rutina activada' : 'Rutina pausada', 'success')
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido cambiar. Revisa la conexión.'), 'error'),
  })

  const deleteRoutine = useMutation({
    mutationFn: async () => {
      await api.delete(`/routines/${routineId}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['routines'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar-week'] })
      // Fuera de la caché y del historial: "atrás" no debe volver a una rutina que ya no existe.
      queryClient.removeQueries({ queryKey: ['routine', routineId] })
      notify('Rutina eliminada', 'success')
      navigate('/routines', { replace: true })
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido eliminar. Revisa la conexión.'), 'error'),
  })

  const saveDates = useMutation({
    mutationFn: async () => {
      await api.patch(`/routines/${routineId}`, {
        starts_on: startsOn || null,
        ends_on: endsOn || null,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['routine', routineId] })
      await queryClient.invalidateQueries({ queryKey: ['routines'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar-week'] })
      notify('Fechas actualizadas', 'success')
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se han podido guardar las fechas.'), 'error'),
  })

  if (!routine && routineQuery.isError) {
    const notFound = isAxiosError(routineQuery.error) && [403, 404].includes(routineQuery.error.response?.status ?? 0)
    return notFound ? (
      <LoadError title="No encontramos esta rutina" message="Puede que se haya borrado." onRetry={() => navigate('/routines', { replace: true })} />
    ) : (
      <LoadError onRetry={() => void routineQuery.refetch()} />
    )
  }

  if (!routine) {
    return (
      <div className="mx-auto max-w-2xl space-y-4" role="status" aria-label="Cargando rutina">
        <div className="evo-skeleton h-44 rounded-3xl" />
        <div className="evo-skeleton h-64 rounded-3xl" />
      </div>
    )
  }

  const totalExercises = days.reduce((sum, day) => sum + (day.exercises?.length ?? 0), 0)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="panel space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">{routine.name}</h1>
            <p className="mt-1 text-sm text-evo-muted">
              {days.length} {days.length === 1 ? 'día' : 'días'} por semana · {totalExercises} ejercicios
            </p>
          </div>
          <span className={['chip shrink-0', routine.is_active ? 'bg-evo-lime/20 text-evo-lime' : 'bg-evo-surface-2 text-evo-muted'].join(' ')}>
            {routine.is_active ? 'Activa' : 'En pausa'}
          </span>
        </div>
        <WeekStrip weekdays={days.map((day) => day.weekday)} />
        <div className="grid grid-cols-2 gap-2">
          <ButtonLink to={`/routines/${routine.id}/edit`} variant="secondary">
            Editar rutina
          </ButtonLink>
          <Button
            variant="secondary"
            disabled={toggleActive.isPending || deleteRoutine.isPending}
            onClick={() => toggleActive.mutate(!routine.is_active)}
          >
            {routine.is_active ? 'Pausar' : 'Activar'}
          </Button>
        </div>
      </section>

      {days.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Días">
          {days.map((day) => {
            const selected = (activeDay?.id ?? null) === day.id
            return (
              <button
                key={day.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setSelectedDayId(day.id)}
                className={[
                  'min-w-[7.5rem] shrink-0 rounded-2xl border-2 px-3 py-2 text-left transition',
                  selected ? 'border-evo-accent bg-evo-accent/10' : 'border-evo-border/70 bg-evo-surface',
                ].join(' ')}
              >
                <span className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-evo-muted">
                  {day.weekday ? WEEKDAY_LABELS[day.weekday - 1]?.slice(0, 3) : `D${day.day_index}`}
                  <span className="tabular-nums">{day.exercises?.length ?? 0}</span>
                </span>
                <span className="mt-0.5 block max-w-[9rem] truncate text-sm font-bold">{day.name}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {activeDay ? (
        <section className="space-y-3" aria-label={activeDay.name}>
          <div className="flex items-end justify-between gap-3 px-1">
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-bold">{activeDay.name}</h2>
              <p className="text-sm text-evo-muted">
                {activeDay.weekday ? WEEKDAY_LABELS[activeDay.weekday - 1] : 'Sin día fijo'}
                {FOCUS_LABELS[activeDay.focus ?? ''] ? ` · ${FOCUS_LABELS[activeDay.focus ?? '']}` : ''}
              </p>
            </div>
          </div>

          {(activeDay.exercises ?? []).length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-evo-border p-5 text-center text-sm text-evo-muted">
              Este día no tiene ejercicios.{' '}
              <Link to={`/routines/${routine.id}/edit`} className="font-bold text-evo-accent">
                Añádelos
              </Link>
            </div>
          ) : (
            <ol className="overflow-hidden rounded-3xl border border-evo-border/60 bg-evo-surface">
              {(activeDay.exercises ?? []).map((exercise, index) => (
                <li key={exercise.id} className="border-b border-evo-border/40 last:border-b-0">
                  <Link
                    to={`/exercise-history/${exercise.id}`}
                    className="flex min-h-16 items-center gap-3 px-4 py-3 transition active:bg-evo-surface-2"
                  >
                    <span className="relative shrink-0">
                      <ExerciseImage urls={exercise.image_urls} name={exercise.name} />
                      <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-evo-accent text-xs font-bold text-[#1a120c] ring-2 ring-evo-surface" aria-hidden>
                        {index + 1}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{exercise.name}</span>
                      <span className="block truncate text-sm text-evo-muted">
                        {exercisePlanLabel(exercise)}
                        {exercise.target_muscle ? ` · ${exercise.target_muscle}` : ''}
                      </span>
                    </span>
                    <span className="sr-only">Ver historial</span>
                    <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
                  </Link>
                </li>
              ))}
            </ol>
          )}

          <Button
            size="lg"
            fullWidth
            onClick={() => startSession.mutate(activeDay.id)}
            disabled={startSession.isPending || !activeDay.exercises?.length || !routine.is_active}
          >
            {startSession.isPending ? 'Empezando…' : `Entrenar ${activeDay.name} hoy`}
          </Button>
          {!routine.is_active ? (
            <p className="text-center text-sm text-evo-muted">Esta rutina está en pausa. Actívala para entrenarla y que cuente en tu agenda.</p>
          ) : null}
        </section>
      ) : null}

      <HistorySection
        history={historyQuery.data ?? []}
        loading={historyQuery.isLoading}
        expandedSession={expandedSession}
        setExpandedSession={setExpandedSession}
      />

      <details className="group rounded-3xl border border-evo-border/60 bg-evo-surface">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold">
          Ajustes de la rutina
          <Icon name="chevron" className="h-4 w-4 text-evo-muted transition group-open:rotate-90" />
        </summary>
        <div className="space-y-5 border-t border-evo-border/40 p-4">
          <div className="space-y-3">
            <div>
              <p className="font-bold">Fechas</p>
              <p className="text-sm text-evo-muted">Vacío = sin fecha. Útil para bloques de 8-12 semanas.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Empieza" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              <Input label="Termina" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </div>
            <Button
              fullWidth
              variant="secondary"
              disabled={saveDates.isPending || (startsOn === (routine.starts_on ?? '') && endsOn === (routine.ends_on ?? ''))}
              onClick={() => saveDates.mutate()}
            >
              Guardar fechas
            </Button>
          </div>
          <div className="space-y-2 border-t border-evo-border/40 pt-4">
            <p className="font-bold">Borrar rutina</p>
            <p className="text-sm text-evo-muted">Se eliminan sus días y sesiones. No se puede deshacer.</p>
            <Button
              variant="danger"
              fullWidth
              disabled={toggleActive.isPending || deleteRoutine.isPending}
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: `¿Borrar «${routine.name}»?`,
                    message: 'Se eliminarán sus días y sesiones. Esta acción no se puede deshacer.',
                    confirmLabel: 'Borrar',
                    cancelLabel: 'Cancelar',
                    danger: true,
                  })
                  if (ok) deleteRoutine.mutate()
                })()
              }}
            >
              Borrar rutina
            </Button>
          </div>
        </div>
      </details>
    </div>
  )
}

function HistorySection({
  history,
  loading,
  expandedSession,
  setExpandedSession,
}: {
  history: WorkoutSession[]
  loading: boolean
  expandedSession: number | null
  setExpandedSession: (id: number | null) => void
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-display text-xl font-bold">Historial</h3>
        <p className="text-sm text-evo-muted">Kilos, repeticiones y tiempos de cada sesión.</p>
      </div>
      {loading ? (
        <p className="text-sm text-evo-muted">Cargando historial…</p>
      ) : history.length === 0 ? (
        <div className="panel border-dashed p-4 text-sm text-evo-muted">
          Todavía no hay sesiones guardadas en esta rutina.
        </div>
      ) : (
        <ul className="space-y-2">
          {history.map((session) => {
            const open = expandedSession === session.id
            const logged = (session.set_logs ?? []).filter(
              (log) => (log.weight_kg != null && log.weight_kg !== '') || log.duration_seconds != null || log.reps != null,
            )
            const grouped = groupLogs(logged)
            return (
              <li key={session.id} className="panel overflow-hidden">
                <button
                  type="button"
                  aria-expanded={open}
                  className="flex min-h-14 w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  onClick={() => setExpandedSession(open ? null : session.id)}
                >
                  <div>
                    <p className="font-semibold">
                      <span className="capitalize">{formatDayLabel(session.scheduled_date)}</span> · {session.day?.name ?? 'Sesión'}
                    </p>
                    <p className="text-xs text-evo-muted">
                      {logged.length} series ·{' '}
                      {session.completed_at ? 'Completada' : 'Con registros'}
                    </p>
                  </div>
                  <span className="text-evo-muted">{open ? '▲' : '▼'}</span>
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-evo-border px-4 py-3">
                    {grouped.map(([name, sets]) => (
                      <div key={name}>
                        <p className="text-sm font-semibold text-evo-lime">{name}</p>
                        <ul className="mt-1 space-y-1 text-xs text-evo-muted">
                          {sets.map((set) => (
                            <li key={`${name}-${set.set_number}`}>
                              Serie {set.set_number}:{' '}
                              {formatScore({
                                mode: set.exercise?.tracking_mode ?? 'weight_reps',
                                weight: set.weight_kg == null || set.weight_kg === '' ? null : Number(set.weight_kg),
                                reps: set.reps,
                                duration: set.duration_seconds,
                              })}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <Link to={`/workout/${session.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-evo-accent">
                      Abrir sesión →
                    </Link>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function groupLogs(logs: ExerciseSetLog[]) {
  const map = new Map<string, ExerciseSetLog[]>()
  for (const log of logs) {
    const name = log.exercise?.name ?? `Ejercicio #${log.routine_exercise_id}`
    const list = map.get(name) ?? []
    list.push(log)
    map.set(name, list)
  }
  return [...map.entries()]
}
