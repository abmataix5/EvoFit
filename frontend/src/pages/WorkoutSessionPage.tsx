import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { api, type ExerciseSetLog, type WorkoutSession } from '../lib/api'

type SetDraft = {
  routine_exercise_id: number
  set_number: number
  weight_kg: string
  reps: string
}

type ExerciseGroup = {
  id: number
  name: string
  rest?: number | null
  muscle?: string | null
  sets: Array<SetDraft & { draftIndex: number }>
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
      drafts.push({
        routine_exercise_id: exercise.id,
        set_number: set,
        weight_kg: log?.weight_kg != null ? String(log.weight_kg) : '',
        reps: log?.reps != null ? String(log.reps) : String(exercise.default_reps),
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
  const saveTimerRef = useRef<number | null>(null)

  const session = sessionQuery.data

  const groups = useMemo<ExerciseGroup[]>(() => {
    const exercises = session?.day?.exercises ?? []
    return exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      rest: exercise.rest_seconds,
      muscle: exercise.target_muscle,
      sets: drafts
        .map((draft, draftIndex) => ({ ...draft, draftIndex }))
        .filter((draft) => draft.routine_exercise_id === exercise.id),
    }))
  }, [session, drafts])

  useEffect(() => {
    if (!session || hydratedRef.current) return
    const next = buildDrafts(session)
    setDrafts(next)
    draftsRef.current = next
    setOpenExerciseId(session.day?.exercises?.[0]?.id ?? null)
    hydratedRef.current = true
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
        completed: true,
      }))
      await api.put(`/workout-sessions/${sessionId}/logs`, { sets, complete })
      return complete
    },
    onMutate: () => setSaveState('saving'),
    onSuccess: async (complete) => {
      setSaveState('saved')
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      await queryClient.invalidateQueries({ queryKey: ['routine-history'] })
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

  function queueAutosave() {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveMutation.mutate(false)
    }, 650)
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
      message: 'Se marcará como hecha en el calendario. Podrás seguir viendo los pesos en el historial.',
      confirmLabel: 'Completar',
      cancelLabel: 'Seguir editando',
    })
    if (!ok) return
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveMutation.mutate(true)
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  if (sessionQuery.isLoading) {
    return <p className="text-sm text-evo-muted">Cargando sesión…</p>
  }

  if (!session) {
    return <p className="text-sm font-semibold text-evo-danger">Sesión no encontrada.</p>
  }

  const filledSets = drafts.filter((d) => d.weight_kg !== '').length
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
            {filledSets}/{totalSets} series con kg
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
            const doneSets = group.sets.filter((set) => set.weight_kg !== '').length
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
                    <span className="block text-xs text-evo-muted">
                      {group.sets.length} series
                      {group.muscle ? ` · ${group.muscle}` : ''}
                      {group.rest ? ` · descanso ${group.rest}s` : ''}
                      {doneSets > 0 ? ` · ${doneSets} con kg` : ''}
                    </span>
                  </span>
                  <span className="text-evo-muted" aria-hidden>
                    {open ? '▲' : '▼'}
                  </span>
                </button>

                {open ? (
                  <div className="space-y-2 border-t border-evo-border bg-evo-bg/30 px-3 py-3">
                    {group.sets.map((set) => (
                      <div
                        key={`${group.id}-${set.set_number}`}
                        className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 rounded-2xl border border-evo-border bg-evo-surface-2 p-3"
                      >
                        <span className="pb-3 text-sm font-bold text-evo-accent">S{set.set_number}</span>
                        <div className="min-w-0">
                          <Input
                            label="Kg"
                            inputMode="decimal"
                            value={set.weight_kg}
                            onChange={(e) => updateDraft(set.draftIndex, { weight_kg: e.target.value })}
                          />
                        </div>
                        <div className="min-w-0">
                          <Input
                            label="Reps"
                            inputMode="numeric"
                            value={set.reps}
                            onChange={(e) => updateDraft(set.draftIndex, { reps: e.target.value })}
                          />
                        </div>
                      </div>
                    ))}
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
