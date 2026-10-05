import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { CopyDayPicker } from '../components/routines/CopyDayPicker'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import {
  FOCUS_LABELS,
  WEEKDAY_LABELS,
  api,
  type ExerciseSetLog,
  type Routine,
  type WorkoutSession,
} from '../lib/api'
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
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await api.post<{ session: WorkoutSession }>('/workout-sessions', {
        routine_id: routineId,
        routine_day_id: dayId,
        scheduled_date: today,
      })
      return data.session
    },
    onSuccess: async (session) => {
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      navigate(`/workout/${session.id}`)
    },
  })

  const toggleActive = useMutation({
    mutationFn: async (is_active: boolean) => {
      await api.patch(`/routines/${routineId}`, { is_active })
    },
    onSuccess: async (_, is_active) => {
      await queryClient.invalidateQueries({ queryKey: ['routine', routineId] })
      await queryClient.invalidateQueries({ queryKey: ['routines'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      notify(is_active ? 'Rutina activada' : 'Rutina pausada', 'success')
    },
  })

  const deleteRoutine = useMutation({
    mutationFn: async () => {
      await api.delete(`/routines/${routineId}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['routines'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      notify('Rutina eliminada', 'success')
      navigate('/routines')
    },
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
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      notify('Fechas actualizadas', 'success')
    },
  })

  const copyDay = useMutation({
    mutationFn: async (payload: { fromId: number; targetIds: number[] }) => {
      await api.post(`/routines/${routineId}/days/${payload.fromId}/copy`, {
        target_day_ids: payload.targetIds,
        replace: true,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['routine', routineId] })
      notify('Ejercicios copiados', 'success')
    },
    onError: () => notify('No se pudo copiar el día', 'error'),
  })

  if (routineQuery.isLoading) {
    return <p className="text-sm text-evo-muted">Cargando rutina…</p>
  }

  if (!routine) {
    return <p className="text-sm text-evo-danger">No encontramos esta rutina.</p>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/routines" className="text-sm font-semibold text-evo-accent hover:text-evo-accent-soft">
            ← Volver a rutinas
          </Link>
          <h2 className="mt-2 font-display text-3xl font-bold">{routine.name}</h2>
          <p className="text-sm text-evo-muted">
            {routine.sessions_per_week} días/semana · {routine.exercises_count ?? 0} ejercicios
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={routine.is_active ? 'secondary' : 'lime'}
            disabled={toggleActive.isPending || deleteRoutine.isPending}
            onClick={() => toggleActive.mutate(!routine.is_active)}
          >
            {routine.is_active ? 'Pausar' : 'Activar'}
          </Button>
          <Button
            variant="danger"
            disabled={toggleActive.isPending || deleteRoutine.isPending}
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: `¿Borrar "${routine.name}"?`,
                  message: 'Se eliminarán días y sesiones asociadas. Esta acción no se puede deshacer.',
                  confirmLabel: 'Borrar',
                  cancelLabel: 'Cancelar',
                  danger: true,
                })
                if (ok) deleteRoutine.mutate()
              })()
            }}
          >
            Borrar
          </Button>
        </div>
      </div>

      <section className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <Input label="Inicio" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        <Input label="Fin" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        <div className="flex items-end">
          <Button fullWidth variant="secondary" disabled={saveDates.isPending} onClick={() => saveDates.mutate()}>
            Guardar fechas
          </Button>
        </div>
        <p className="text-xs text-evo-muted sm:col-span-2 lg:col-span-3">
          Vacío = indefinida. Varias rutinas activas pueden convivir en el mismo calendario.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {days.map((day) => {
          const selected = (activeDay?.id ?? null) === day.id
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => setSelectedDayId(day.id)}
              className={[
                'rounded-2xl border-2 px-3 py-2 text-left text-xs',
                selected
                  ? 'border-evo-accent bg-evo-accent/10 text-evo-accent'
                  : 'border-evo-border bg-evo-surface text-evo-muted',
              ].join(' ')}
            >
              <span className="block font-semibold">D{day.day_index}</span>
              <span className="block truncate">{day.name}</span>
              <span className="mt-1 block text-xs">
                {day.weekday ? WEEKDAY_LABELS[day.weekday - 1] : 'Sin día'}
              </span>
            </button>
          )
        })}
      </div>

      {activeDay ? (
        <section className="panel space-y-3 p-4 lg:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-xl font-semibold">{activeDay.name}</h3>
              <p className="text-xs text-evo-muted">
                {FOCUS_LABELS[activeDay.focus ?? ''] ?? 'Sin enfoque'}
                {activeDay.weekday ? ` · ${WEEKDAY_LABELS[activeDay.weekday - 1]}` : ''}
              </p>
            </div>
            <Button
              onClick={() => startSession.mutate(activeDay.id)}
              disabled={startSession.isPending || !(activeDay.exercises?.length)}
            >
              Entrenar hoy
            </Button>
          </div>
          <ul className="space-y-2">
            {(activeDay.exercises ?? []).map((exercise) => (
              <li key={exercise.id} className="rounded-xl border border-evo-border bg-evo-surface-2 px-4 py-3 text-sm">
                <p className="font-medium">{exercise.name}</p>
                <p className="text-evo-muted">
                  {exercisePlanLabel(exercise)}
                  {exercise.target_muscle ? ` · ${exercise.target_muscle}` : ''}
                </p>
              </li>
            ))}
          </ul>

          {days.length > 1 ? (
            <CopyDayPicker
              sourceLabel={`D${activeDay.day_index} · ${activeDay.name}`}
              disabled={!(activeDay.exercises?.length)}
              busy={copyDay.isPending}
              options={days
                .filter((day) => day.id !== activeDay.id)
                .map((day) => ({
                  id: day.id,
                  label: `D${day.day_index}`,
                  sublabel: day.name,
                }))}
              onCopy={(targetIds) =>
                copyDay.mutateAsync({
                  fromId: activeDay.id,
                  targetIds: targetIds.map(Number),
                })
              }
            />
          ) : null}
        </section>
      ) : null}

      <HistorySection
        history={historyQuery.data ?? []}
        loading={historyQuery.isLoading}
        expandedSession={expandedSession}
        setExpandedSession={setExpandedSession}
      />
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
            const grouped = groupLogs(session.set_logs ?? [])
            return (
              <li key={session.id} className="panel overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  onClick={() => setExpandedSession(open ? null : session.id)}
                >
                  <div>
                    <p className="font-semibold">
                      {session.scheduled_date} · {session.day?.name ?? 'Sesión'}
                    </p>
                    <p className="text-xs text-evo-muted">
                      {(session.set_logs ?? []).length} series ·{' '}
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
                    <Link to={`/workout/${session.id}`} className="inline-flex text-sm font-semibold text-evo-accent">
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
