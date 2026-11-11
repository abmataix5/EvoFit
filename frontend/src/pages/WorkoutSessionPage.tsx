import { useMutation, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { ExercisePickerSheet } from '../components/exercises/ExercisePickerSheet'
import { Button } from '../components/ui/Button'
import { ExerciseCard } from '../features/workout/ExerciseCard'
import { SessionReportButton } from '../features/reports/SessionReportButton'
import { sessionHasReport } from '../lib/reports'
import { RecordCelebration, type RecordEvent } from '../features/workout/RecordCelebration'
import { RestTimer, type RestTimerState } from '../features/workout/RestTimer'
import { WorkoutSummary } from '../features/workout/WorkoutSummary'
import {
  estimateOneRepMax,
  formatKg,
  modeOf,
  parseDecimal,
  parseInteger,
  previousFor,
  sessionExercises,
  sessionStats,
  setLogged,
  type ExerciseGroup,
  type SetDraft,
} from '../features/workout/model'
import { formatDuration, isTimeMode, joinDuration } from '../lib/tracking'
import { useWakeLock } from '../features/workout/useWakeLock'
import { useWorkoutAutosave, type SaveState } from '../features/workout/useWorkoutAutosave'
import { api, apiErrorMessage, validationErrors, type CatalogExercise, type WorkoutSession } from '../lib/api'
import { formatDayLabel } from '../lib/dates'
import { queryClient } from '../lib/queryClient'

const saveLabels: Record<SaveState, { text: string; tone: string }> = {
  idle: { text: 'Los cambios se guardan solos', tone: 'bg-evo-surface-2 text-evo-muted' },
  pending: { text: 'Guardando…', tone: 'bg-evo-surface-2 text-evo-muted' },
  saving: { text: 'Guardando…', tone: 'bg-evo-warn/15 text-evo-warn' },
  saved: { text: '✓ Guardado', tone: 'bg-evo-lime/15 text-evo-lime' },
  offline: { text: 'Sin conexión · guardado en el móvil', tone: 'bg-evo-warn/15 text-evo-warn' },
  error: { text: 'Error al guardar · reintentando', tone: 'bg-evo-danger/15 text-evo-danger' },
}

export function WorkoutSessionPage() {
  const { id } = useParams()
  const sessionId = Number(id)
  const navigate = useNavigate()
  const { notify, confirm } = useUiFeedback()

  const sessionQuery = useQuery({
    queryKey: ['workout-session', sessionId],
    enabled: Number.isFinite(sessionId),
    refetchOnMount: 'always',
    staleTime: 0,
    queryFn: async () => {
      const { data } = await api.get<{ data: WorkoutSession }>(`/workout-sessions/${sessionId}`)
      return data.data
    },
  })

  const session = sessionQuery.data
  const autosave = useWorkoutAutosave(sessionId, session)
  const { drafts, saveState } = autosave

  // undefined = el usuario aún no ha elegido: se abre el primer ejercicio sin terminar.
  const [chosenExerciseId, setOpenExerciseId] = useState<number | null | undefined>(undefined)
  const [restTimer, setRestTimer] = useState<RestTimerState>(null)
  const [finished, setFinished] = useState<{ stats: ReturnType<typeof sessionStats>; minutes: number | null } | null>(null)
  const [completing, setCompleting] = useState(false)
  const [recordEvent, setRecordEvent] = useState<RecordEvent | null>(null)
  const clearRecord = useCallback(() => setRecordEvent(null), [])
  /** Selector de ejercicio abierto: para cambiar uno (replace) o añadir al final. */
  const [picker, setPicker] = useState<{ replace?: ExerciseGroup } | null>(null)
  const [changingExercises, setChangingExercises] = useState(false)

  // Mejores marcas ya celebradas por ejercicio en esta visita: igualarlas no vuelve a saltar.
  const celebrated = useRef(new Map<number, { weight: number; e1rm: number; time: number }>())

  const celebrate = useCallback((group: ExerciseGroup, draft: SetDraft) => {
    const previous = group.previous
    const weightNow = parseDecimal(draft.weight_kg) ?? 0
    const e1rmNow = estimateOneRepMax(parseDecimal(draft.weight_kg), parseInteger(draft.reps)) ?? 0
    const duration = joinDuration(draft.minutes, draft.seconds)
    const timeNow = duration == null ? -Infinity : group.direction === 'longer' ? duration : -duration
    const seen = celebrated.current.get(group.id)
    if (seen) {
      const better = isTimeMode(group.mode) ? timeNow > seen.time : weightNow > seen.weight || e1rmNow > seen.e1rm
      if (!better) return
    }
    celebrated.current.set(group.id, {
      weight: Math.max(seen?.weight ?? 0, weightNow),
      e1rm: Math.max(seen?.e1rm ?? 0, e1rmNow),
      time: Math.max(seen?.time ?? -Infinity, timeNow),
    })

    if (isTimeMode(group.mode)) {
      setRecordEvent({
        id: Date.now(),
        exercise: group.name,
        label: formatDuration(joinDuration(draft.minutes, draft.seconds)),
        previous: previous?.record_duration_seconds != null ? formatDuration(previous.record_duration_seconds) : null,
      })
      return
    }
    const weight = parseDecimal(draft.weight_kg)
    const reps = parseInteger(draft.reps)
    const heavier = weight != null && previous?.record_weight_kg != null && weight > previous.record_weight_kg
    setRecordEvent({
      id: Date.now(),
      exercise: group.name,
      label: heavier || reps == null
        ? `${formatKg(weight)}${reps ? ` × ${reps}` : ''}`
        : `1RM est. ${formatKg(estimateOneRepMax(weight, reps))}`,
      previous: heavier
        ? `${formatKg(previous?.record_weight_kg)}${previous?.record_reps ? ` × ${previous.record_reps}` : ''}`
        : previous?.record_est_1rm != null
          ? `1RM est. ${formatKg(previous.record_est_1rm)}`
          : null,
    })
  }, [])

  useWakeLock(Boolean(session) && !finished)

  const groups = useMemo<ExerciseGroup[]>(() => {
    if (!session) return []
    return sessionExercises(session).map((exercise) => ({
      exercise,
      id: exercise.id,
      name: exercise.name,
      rest: exercise.rest_seconds ?? 90,
      mode: modeOf(exercise),
      direction: exercise.time_direction ?? 'faster',
      goalSeconds: exercise.default_duration_seconds ?? null,
      defaultReps: exercise.default_reps ?? 0,
      previous: previousFor(session, exercise.id),
      sets: drafts
        .map((draft, draftIndex) => ({ ...draft, draftIndex }))
        .filter((draft) => draft.routine_exercise_id === exercise.id),
    }))
  }, [session, drafts])

  const openExerciseId =
    chosenExerciseId !== undefined
      ? chosenExerciseId
      : ((groups.find((group) => group.sets.some((set) => !set.done)) ?? groups[0])?.id ?? null)

  const openExercise = useCallback((exerciseId: number | null) => {
    setOpenExerciseId(exerciseId)
    if (exerciseId == null) return
    // Tras plegar el anterior, la tarjeta nueva puede quedar fuera de pantalla.
    window.requestAnimationFrame(() => {
      document.getElementById(`exercise-${exerciseId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const startRest = useCallback((group: ExerciseGroup) => {
    if (!group.rest || group.rest <= 0) return
    setRestTimer({ endsAt: Date.now() + group.rest * 1000, total: group.rest, label: group.name })
  }, [])

  const notesMutation = useMutation({
    mutationFn: async (notes: string) => {
      const { data } = await api.patch<{ data: WorkoutSession }>(`/workout-sessions/${sessionId}`, { notes })
      return data.data
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<WorkoutSession>(['workout-session', sessionId], (current) =>
        current ? { ...current, notes: saved.notes } : saved,
      )
    },
    onError: () => notify('No se pudo guardar la nota.', 'error'),
  })

  /** Aplica en pantalla la sesión que devuelve el servidor tras cambiar sus ejercicios. */
  function applyExercises(updated: WorkoutSession) {
    queryClient.setQueryData(['workout-session', sessionId], updated)
    autosave.syncExercises(updated)
  }

  async function changeExercises(request: () => Promise<WorkoutSession>, done: string): Promise<WorkoutSession | null> {
    setChangingExercises(true)
    try {
      // Primero se guarda lo pendiente: el servidor tiene que ver las series antes del cambio.
      if (!(await autosave.flushNow())) {
        notify('Sin conexión: para cambiar ejercicios hace falta internet.', 'error')
        return null
      }
      const updated = await request()
      applyExercises(updated)
      notify(done, 'success')
      return updated
    } catch (error) {
      const errors = validationErrors(error)
      notify(Object.values(errors)[0] ?? apiErrorMessage(error, 'No se ha podido cambiar el ejercicio.'), 'error')
      return null
    } finally {
      setChangingExercises(false)
    }
  }

  async function handlePicked([choice]: CatalogExercise[]) {
    if (!choice) return
    const replace = picker?.replace
    const position = replace ? groups.findIndex((group) => group.id === replace.id) : groups.length
    const updated = await changeExercises(
      async () =>
        (
          await api.post<{ data: WorkoutSession }>(`/workout-sessions/${sessionId}/exercises`, {
            catalog_exercise_id: choice.id,
            replaces_routine_exercise_id: replace?.id ?? null,
          })
        ).data.data,
      replace ? `Hoy: ${choice.name} en lugar de ${replace.name}` : `${choice.name} añadido al entreno de hoy`,
    )
    if (!updated) return
    setPicker(null)
    const next = sessionExercises(updated)[position]
    if (next) openExercise(next.id)
  }

  function requestReplace(group: ExerciseGroup) {
    if (group.sets.some((set) => setLogged(set, group.mode) || set.reps.trim() !== '')) {
      notify('Ya has apuntado series de este ejercicio. Si hoy haces otro, añádelo con «Añadir ejercicio».', 'info')
      return
    }
    setPicker({ replace: group })
  }

  async function removeExtra(group: ExerciseGroup) {
    const logged = group.sets.filter((set) => setLogged(set, group.mode)).length
    const restoring = Boolean(group.exercise.replaces_routine_exercise_id)
    const ok = await confirm({
      title: restoring ? '¿Volver al ejercicio de la rutina?' : `¿Quitar ${group.name} de hoy?`,
      message:
        logged > 0
          ? `Se borrarán las ${logged} series que has apuntado de ${group.name}.`
          : restoring
            ? 'Vuelve el ejercicio que tenía la rutina para hoy.'
            : 'Solo se quita de este entreno.',
      confirmLabel: restoring ? 'Volver' : 'Quitar',
      cancelLabel: 'Cancelar',
      danger: logged > 0,
    })
    if (!ok) return
    await changeExercises(
      async () => (await api.delete<{ data: WorkoutSession }>(`/workout-sessions/${sessionId}/exercises/${group.id}`)).data.data,
      restoring ? 'Vuelve el ejercicio de la rutina' : `${group.name} quitado de hoy`,
    )
  }

  async function completeSession() {
    const stats = sessionStats(groups)
    const pending = stats.totalSets - stats.doneSets
    const ok = await confirm({
      title: '¿Completar sesión?',
      message:
        pending > 0
          ? `Te quedan ${pending} series sin marcar. Las que tengan datos se guardan igual.`
          : 'Se marcará como hecha en la agenda.',
      confirmLabel: 'Completar',
      cancelLabel: 'Seguir entrenando',
    })
    if (!ok) return
    setCompleting(true)
    const saved = await autosave.complete()
    setCompleting(false)
    if (!saved) {
      notify('Sin conexión: lo tienes guardado en el móvil. Vuelve a pulsar cuando tengas cobertura.', 'error')
      return
    }
    setRestTimer(null)
    const startedAt = session?.started_at ? new Date(session.started_at).getTime() : null
    const minutes = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 60000)) : null
    setFinished({ stats, minutes: minutes != null && minutes < 6 * 60 ? minutes : null })
    window.scrollTo({ top: 0 })
  }

  if (sessionQuery.isLoading) {
    return <p className="text-sm text-evo-muted">Cargando sesión…</p>
  }

  if (sessionQuery.isError && !session) {
    const notFound = isAxiosError(sessionQuery.error) && [403, 404].includes(sessionQuery.error.response?.status ?? 0)
    return (
      <div className="panel space-y-3 p-5">
        <p className="font-display text-xl font-bold">{notFound ? 'Sesión no encontrada' : 'No se pudo cargar la sesión'}</p>
        <p className="text-sm text-evo-muted">
          {notFound ? 'Puede que se haya borrado la rutina.' : 'Revisa la conexión e inténtalo de nuevo.'}
        </p>
        <div className="flex gap-2">
          {!notFound ? <Button onClick={() => void sessionQuery.refetch()}>Reintentar</Button> : null}
          <Button variant="secondary" onClick={() => navigate('/calendar')}>
            Ir a la agenda
          </Button>
        </div>
      </div>
    )
  }

  if (!session) return null

  if (finished) {
    return (
      <WorkoutSummary
        sessionId={session.id}
        title={session.day?.name ?? session.routine?.name ?? 'Entrenamiento'}
        stats={finished.stats}
        minutes={finished.minutes}
        onDone={() => navigate('/calendar')}
      />
    )
  }

  const stats = sessionStats(groups)
  const progress = stats.totalSets > 0 ? stats.doneSets / stats.totalSets : 0
  const save = saveLabels[saveState]

  return (
    <div className="space-y-4 pb-48 lg:pb-0">
      <div className="panel space-y-3 p-4">
        <Link
          to={`/routines/${session.routine_id}`}
          className="text-xs font-bold uppercase tracking-wide text-evo-muted hover:text-evo-accent"
        >
          {session.routine?.name ?? 'Rutina'}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">{session.day?.name ?? 'Entrenamiento'}</h1>
            <p className="text-sm capitalize text-evo-muted">
              {formatDayLabel(session.scheduled_date)}
              {session.completed_at ? ' · completada' : ''}
            </p>
          </div>
          {sessionHasReport(session) ? (
            <SessionReportButton sessionId={session.id} label="Descargar informe PDF de la sesión" compact />
          ) : null}
        </div>
        <div>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>
              {stats.doneSets}/{stats.totalSets} series
            </span>
            {stats.volumeKg > 0 ? <span className="text-evo-muted">{stats.volumeKg.toLocaleString('es-ES')} kg movidos</span> : null}
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-evo-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-evo-lime transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={['chip', save.tone].join(' ')} aria-live="polite">
            {save.text}
          </span>
          {saveState === 'offline' || saveState === 'error' ? (
            <button type="button" className="chip bg-evo-surface-2 text-evo-text" onClick={autosave.retryNow}>
              Reintentar ahora
            </button>
          ) : null}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-evo-muted">Este día no tiene ejercicios configurados.</p>
      ) : (
        <ul className="space-y-2">
          {groups.map((group, index) => (
            <ExerciseCard
              key={group.id}
              group={group}
              index={index}
              open={openExerciseId === group.id}
              onToggle={() => openExercise(openExerciseId === group.id ? null : group.id)}
              onNext={index < groups.length - 1 ? () => openExercise(groups[index + 1]?.id ?? null) : null}
              updateDraft={autosave.updateDraft}
              updateMany={autosave.updateMany}
              addSet={autosave.addSet}
              removeSet={autosave.removeSet}
              onSetDone={startRest}
              onRecord={celebrate}
              onReplace={requestReplace}
              onRemoveExtra={(g) => void removeExtra(g)}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={changingExercises}
        onClick={() => setPicker({})}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-evo-border text-base font-bold text-evo-text transition active:scale-[0.99] disabled:opacity-50"
      >
        <span className="text-xl text-evo-accent" aria-hidden>
          +
        </span>
        Añadir ejercicio
      </button>

      {picker ? (
        <ExercisePickerSheet
          title={picker.replace ? `Cambiar ${picker.replace.name}` : 'Añadir ejercicio a hoy'}
          mode="single"
          busy={changingExercises}
          usedIds={groups.map((group) => group.exercise.catalog_exercise_id).filter((v): v is number => v != null)}
          onClose={() => setPicker(null)}
          onConfirm={handlePicked}
        />
      ) : null}

      <SessionNotes
        key={session.id}
        initial={session.notes ?? ''}
        saving={notesMutation.isPending}
        onSave={(notes) => notesMutation.mutate(notes)}
      />

      {recordEvent ? <RecordCelebration event={recordEvent} onDone={clearRecord} /> : null}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-evo-border bg-evo-bg/95 px-4 pt-3 backdrop-blur-md lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0">
        <RestTimer timer={restTimer} onChange={setRestTimer} />
        <Button size="lg" fullWidth disabled={completing || drafts.length === 0} onClick={() => void completeSession()}>
          {completing ? 'Guardando…' : session.completed_at ? 'Guardar y cerrar' : 'Completar sesión'}
        </Button>
      </div>
    </div>
  )
}

function SessionNotes({ initial, saving, onSave }: { initial: string; saving: boolean; onSave: (notes: string) => void }) {
  const [value, setValue] = useState(initial)
  const [open, setOpen] = useState(initial.trim() !== '')
  const dirty = value !== initial

  if (!open) {
    return (
      <button
        type="button"
        className="min-h-12 w-full rounded-2xl border-2 border-dashed border-evo-border text-sm font-bold text-evo-muted"
        onClick={() => setOpen(true)}
      >
        + Nota de la sesión
      </button>
    )
  }

  return (
    <div className="panel space-y-2 p-4">
      <label htmlFor="session-notes" className="text-sm font-bold">
        Nota de la sesión
      </label>
      <textarea
        id="session-notes"
        rows={3}
        maxLength={2000}
        className="w-full rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-4 py-3 text-base text-evo-text placeholder:text-evo-muted/70 focus:border-evo-accent focus:outline-none"
        placeholder="Cómo te has sentido, molestias, algo a cambiar…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (dirty) onSave(value)
        }}
      />
      <p className="text-xs text-evo-muted">{saving ? 'Guardando…' : dirty ? 'Se guarda al salir del campo' : 'Guardada'}</p>
    </div>
  )
}
