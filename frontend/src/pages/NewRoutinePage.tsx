import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { ExerciseCatalogPicker } from '../components/exercises/ExerciseCatalogPicker'
import { CopyDayPicker } from '../components/routines/CopyDayPicker'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import {
  TRAINING_TEMPLATES,
  WEEKDAY_LABELS,
  api,
  defaultWeekdays,
  type CatalogExercise,
  type Routine,
} from '../lib/api'
import { invalidateTraining } from '../lib/queryClient'
import {
  directionLabel,
  isTimeMode,
  joinDuration,
  modeLabel,
  splitDuration,
  type TimeDirection,
  type TrackingMode,
} from '../lib/tracking'

type DraftExercise = {
  /** Solo al editar: ejercicio ya guardado (conserva su historial). */
  id?: number
  name: string
  catalog_exercise_id: number | null
  tracking_mode: TrackingMode
  time_direction: TimeDirection
  default_sets: number
  default_reps: number
  duration_minutes: string
  duration_seconds: string
  rest_seconds: number
}

type DraftDay = {
  id?: number
  day_index: number
  weekday: number
  name: string
  focus: string
  exercises: DraftExercise[]
}

function emptyExercise(): DraftExercise {
  return {
    name: '',
    catalog_exercise_id: null,
    tracking_mode: 'weight_reps',
    time_direction: 'faster',
    default_sets: 3,
    default_reps: 10,
    duration_minutes: '',
    duration_seconds: '',
    rest_seconds: 90,
  }
}

function draftsFromRoutine(routine: Routine): DraftDay[] {
  return [...(routine.days ?? [])]
    .sort((a, b) => a.day_index - b.day_index)
    .map((day, index) => ({
      id: day.id,
      day_index: index + 1,
      weekday: day.weekday ?? index + 1,
      name: day.name,
      focus: day.focus ?? '',
      exercises: [...(day.exercises ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((exercise) => {
          const duration = splitDuration(exercise.default_duration_seconds)
          return {
            id: exercise.id,
            name: exercise.name,
            catalog_exercise_id: exercise.catalog_exercise_id ?? null,
            tracking_mode: exercise.tracking_mode ?? 'weight_reps',
            time_direction: exercise.time_direction ?? 'faster',
            default_sets: exercise.default_sets,
            default_reps: exercise.default_reps,
            duration_minutes: duration.minutes,
            duration_seconds: duration.seconds,
            rest_seconds: exercise.rest_seconds ?? 90,
          }
        }),
    }))
}

/** Ajusta el número de días sin perder lo ya escrito: se conservan los primeros y se añaden de plantilla. */
function resizeDays(current: DraftDay[], count: number): DraftDay[] {
  const fresh = buildDaysFromTemplate(count)
  const used = new Set(current.slice(0, count).map((day) => day.weekday))
  const freeWeekdays = [1, 2, 3, 4, 5, 6, 7].filter((w) => !used.has(w))
  return fresh.map((templateDay, index) => {
    const existing = current[index]
    if (existing) return { ...existing, day_index: index + 1 }
    return { ...templateDay, weekday: freeWeekdays.shift() ?? templateDay.weekday }
  })
}

function hasContent(days: DraftDay[]) {
  return days.some((day) => day.exercises.some((e) => e.name.trim()))
}

function buildDaysFromTemplate(count: number): DraftDay[] {
  const template = (TRAINING_TEMPLATES[count] ?? TRAINING_TEMPLATES[3])!
  const weekdays = defaultWeekdays(count)
  return template.days.slice(0, count).map((day, index) => ({
    day_index: index + 1,
    weekday: weekdays[index] ?? index + 1,
    name: day.name,
    focus: day.focus,
    exercises: [emptyExercise(), emptyExercise(), emptyExercise()],
  }))
}

export function NewRoutinePage() {
  const { id } = useParams()
  const editingId = id ? Number(id) : null
  const isEditing = editingId != null && Number.isFinite(editingId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirm } = useUiFeedback()
  const loadedRef = useRef(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [sessionsPerWeek, setSessionsPerWeek] = useState(4)
  const [isActive, setIsActive] = useState(true)
  const [activeDay, setActiveDay] = useState(0)
  const [days, setDays] = useState<DraftDay[]>(() => buildDaysFromTemplate(4))
  const [error, setError] = useState<string | null>(null)
  const [dates, setDates] = useState<{ starts_on: string | null; ends_on: string | null }>({
    starts_on: null,
    ends_on: null,
  })

  const routineQuery = useQuery({
    queryKey: ['routine', editingId],
    enabled: isEditing,
    queryFn: async () => {
      const { data } = await api.get<{ data: Routine }>(`/routines/${editingId}`)
      return data.data
    },
  })

  // Al editar, el formulario se rellena una sola vez con la rutina guardada.
  useEffect(() => {
    const routine = routineQuery.data
    if (!routine || loadedRef.current) return
    loadedRef.current = true
    const loaded = draftsFromRoutine(routine)
    setName(routine.name)
    setIsActive(routine.is_active)
    setSessionsPerWeek(Math.max(1, Math.min(7, loaded.length || routine.sessions_per_week)))
    setDays(loaded.length > 0 ? loaded : buildDaysFromTemplate(routine.sessions_per_week))
    setDates({ starts_on: routine.starts_on ?? null, ends_on: routine.ends_on ?? null })
  }, [routineQuery.data])

  const { data: catalog = [] } = useQuery({
    queryKey: ['catalog-exercises'],
    queryFn: async () => {
      const { data: response } = await api.get<{ data: CatalogExercise[] }>('/catalog-exercises')
      return response.data
    },
  })

  const template = (TRAINING_TEMPLATES[sessionsPerWeek] ?? TRAINING_TEMPLATES[3])!
  const currentDay = days[activeDay]

  async function changeSessionsPerWeek(count: number) {
    if (count === sessionsPerWeek) return
    if (count < days.length && hasContent(days.slice(count))) {
      const ok = await confirm({
        title: `¿Pasar a ${count} días?`,
        message: `Se quitarán los días ${days
          .slice(count)
          .map((d) => d.name)
          .join(', ')} con sus ejercicios.`,
        confirmLabel: 'Quitar días',
        cancelLabel: 'Cancelar',
        danger: true,
      })
      if (!ok) return
    }
    setSessionsPerWeek(count)
    setDays((current) => (hasContent(current) || isEditing ? resizeDays(current, count) : buildDaysFromTemplate(count)))
    setActiveDay(0)
  }

  function moveExercise(dayIndex: number, from: number, to: number) {
    setDays((current) =>
      current.map((day, i) => {
        if (i !== dayIndex || to < 0 || to >= day.exercises.length) return day
        const exercises = [...day.exercises]
        const [moved] = exercises.splice(from, 1)
        if (moved) exercises.splice(to, 0, moved)
        return { ...day, exercises }
      }),
    )
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        sessions_per_week: sessionsPerWeek,
        is_active: isActive,
        starts_on: dates.starts_on,
        ends_on: dates.ends_on,
        days: days.map((day, dayPosition) => ({
          ...(day.id ? { id: day.id } : {}),
          day_index: dayPosition + 1,
          weekday: day.weekday,
          name: day.name,
          focus: day.focus || null,
          exercises: day.exercises
            .filter((exercise) => exercise.name.trim() || exercise.catalog_exercise_id)
            .map((exercise, index) => ({
              ...(exercise.id ? { id: exercise.id } : {}),
              name: exercise.name.trim(),
              catalog_exercise_id: exercise.catalog_exercise_id,
              sort_order: index,
              tracking_mode: exercise.tracking_mode,
              time_direction: exercise.time_direction,
              default_sets: exercise.default_sets,
              default_reps: exercise.default_reps,
              default_duration_seconds: isTimeMode(exercise.tracking_mode)
                ? joinDuration(exercise.duration_minutes, exercise.duration_seconds)
                : null,
              rest_seconds: exercise.rest_seconds,
              target_muscle: null,
            })),
        })),
      }
      if (isEditing) {
        await api.put(`/routines/${editingId}`, payload)
        return editingId as number
      }
      const { data } = await api.post<{ routine: { id: number } }>('/routines', payload)
      return data.routine.id
    },
    onSuccess: async (routineId) => {
      await queryClient.invalidateQueries({ queryKey: ['routines'] })
      await queryClient.invalidateQueries({ queryKey: ['routine', routineId] })
      await queryClient.invalidateQueries({ queryKey: ['catalog-exercises'] })
      await invalidateTraining()
      navigate(`/routines/${routineId}`, { replace: isEditing })
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(message ?? 'No se pudo guardar. Revisa nombre y ejercicios.')
    },
  })

  function updateDay(index: number, patch: Partial<DraftDay>) {
    setDays((current) => current.map((day, i) => (i === index ? { ...day, ...patch } : day)))
  }

  function updateExercise(dayIndex: number, exerciseIndex: number, patch: Partial<DraftExercise>) {
    setDays((current) =>
      current.map((day, i) => {
        if (i !== dayIndex) return day
        return {
          ...day,
          exercises: day.exercises.map((exercise, j) =>
            j === exerciseIndex ? { ...exercise, ...patch } : exercise,
          ),
        }
      }),
    )
  }

  function goToExercises(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Pon un nombre a la rutina.')
      return
    }
    setError(null)
    setStep(2)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const emptyDays = days.filter((day) => !day.exercises.some((e) => e.name.trim()))
    if (emptyDays.length > 0) {
      setError(`Faltan ejercicios en: ${emptyDays.map((d) => d.name).join(', ')}.`)
      const firstEmpty = days.findIndex((day) => !day.exercises.some((e) => e.name.trim()))
      if (firstEmpty >= 0) setActiveDay(firstEmpty)
      return
    }
    setError(null)
    mutation.mutate()
  }

  if (isEditing && routineQuery.isLoading) {
    return <p className="text-sm text-evo-muted">Cargando rutina…</p>
  }

  if (isEditing && routineQuery.isError) {
    return <p className="text-sm font-semibold text-evo-danger">No se pudo cargar la rutina.</p>
  }

  const dayProgress = days.map((day) => day.exercises.some((e) => e.name.trim()))

  return (
    <div className="no-x-scroll mx-auto max-w-xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            to={isEditing ? `/routines/${editingId}` : '/routines'}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-evo-accent"
          >
            ← {isEditing ? 'Volver' : 'Rutinas'}
          </Link>
          <h2 className="mt-1 font-display text-2xl font-bold">{isEditing ? 'Editar rutina' : 'Nueva rutina'}</h2>
          <p className="text-sm text-evo-muted">
            {step === 1 ? 'Paso 1 · Datos básicos' : 'Paso 2 · Ejercicios por día'}
          </p>
        </div>
        <div className="flex gap-1.5 pt-1">
          <span className={`h-2 w-8 rounded-full ${step >= 1 ? 'bg-evo-accent' : 'bg-evo-border'}`} />
          <span className={`h-2 w-8 rounded-full ${step >= 2 ? 'bg-evo-accent' : 'bg-evo-border'}`} />
        </div>
      </div>

      {step === 1 ? (
        <form onSubmit={goToExercises} className="space-y-4">
          <div className="panel space-y-4 p-4">
            <Input
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Hipertrofia, Push Pull…"
              required
            />

            <div className="space-y-2">
              <p className="text-sm font-semibold">¿Cuántos días entrenas?</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => void changeSessionsPerWeek(n)}
                    aria-pressed={sessionsPerWeek === n}
                    className={[
                      'min-h-12 rounded-xl border-2 py-3 text-center text-base font-bold transition',
                      sessionsPerWeek === n
                      ? 'border-evo-accent bg-evo-accent text-[#111]'
                      : 'border-evo-border bg-evo-surface-2 text-evo-text',
                    ].join(' ')}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="rounded-xl bg-evo-surface-2 px-3 py-2.5 text-sm">
                <p className="font-semibold text-evo-accent">{template.label}</p>
                <p className="mt-0.5 text-xs text-evo-muted">{template.tip}</p>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-evo-border bg-evo-surface-2 px-3 py-3">
              <span>
                <span className="block text-sm font-semibold">Activar ya</span>
                <span className="block text-xs text-evo-muted">La mete sola en el calendario</span>
              </span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-5 w-5 accent-evo-accent"
              />
            </label>
          </div>

          {error ? <p className="text-sm font-semibold text-evo-danger">{error}</p> : null}

          <Button type="submit" size="lg" fullWidth>
            Continuar → ejercicios
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {days.map((day, index) => (
              <button
                key={day.day_index}
                type="button"
                onClick={() => setActiveDay(index)}
                className={[
                  'min-h-16 rounded-xl border-2 px-2.5 py-2.5 text-left transition',
                  index === activeDay
                    ? 'border-evo-accent bg-evo-accent/10'
                    : 'border-evo-border bg-evo-surface',
                ].join(' ')}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold">D{day.day_index}</span>
                  <span className="text-xs">{dayProgress[index] ? '✓' : '·'}</span>
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold">{day.name}</span>
                <span className="block text-xs text-evo-muted">
                  {WEEKDAY_LABELS[day.weekday - 1]?.slice(0, 3)}
                </span>
              </button>
            ))}
          </div>

          {currentDay ? (
            <div className="panel space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Nombre del día"
                  value={currentDay.name}
                  onChange={(e) => updateDay(activeDay, { name: e.target.value })}
                  required
                />
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-evo-text">Día de la semana</span>
                  <select
                    className="w-full"
                    value={currentDay.weekday}
                    onChange={(e) => {
                      const weekday = Number(e.target.value)
                      const taken = days.some((day, i) => i !== activeDay && day.weekday === weekday)
                      if (taken) {
                        setError('Ese día de la semana ya está pillado por otro entrenamiento.')
                        return
                      }
                      setError(null)
                      updateDay(activeDay, { weekday })
                    }}
                  >
                    {WEEKDAY_LABELS.map((label, index) => (
                      <option key={label} value={index + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Ejercicios</p>
                  <Link to="/exercises" className="inline-flex min-h-11 items-center text-sm font-semibold text-evo-accent">
                    Gestionar catálogo
                  </Link>
                </div>
                {currentDay.exercises.map((exercise, exerciseIndex) => (
                  <div
                    key={exerciseIndex}
                    className="rounded-xl border border-evo-border bg-evo-surface-2 p-3"
                  >
                    <ExerciseCatalogPicker
                      label={`#${exerciseIndex + 1}`}
                      name={exercise.name}
                      catalogId={exercise.catalog_exercise_id}
                      catalog={catalog}
                      onChange={(next) =>
                        updateExercise(activeDay, exerciseIndex, {
                          name: next.name,
                          catalog_exercise_id: next.catalog_exercise_id,
                          ...(next.tracking_mode !== undefined
                            ? { tracking_mode: next.tracking_mode }
                            : {}),
                          ...(next.time_direction !== undefined
                            ? { time_direction: next.time_direction }
                            : {}),
                          ...(next.default_sets !== undefined
                            ? { default_sets: next.default_sets }
                            : {}),
                          ...(next.default_reps !== undefined
                            ? { default_reps: next.default_reps }
                            : {}),
                          ...(next.default_duration_seconds !== undefined
                            ? splitDuration(next.default_duration_seconds)
                            : {}),
                          ...(next.rest_seconds !== undefined
                            ? { rest_seconds: next.rest_seconds }
                            : {}),
                        })
                      }
                    />
                    {exercise.name.trim() ? (
                      <p className="mt-2 text-sm font-semibold text-evo-accent">
                        {modeLabel(exercise.tracking_mode)}
                        {isTimeMode(exercise.tracking_mode)
                          ? ` · ${directionLabel(exercise.time_direction)}`
                          : ''}
                      </p>
                    ) : null}
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Input
                        label="Series"
                        type="number"
                        min={1}
                        value={exercise.default_sets}
                        onChange={(e) =>
                          updateExercise(activeDay, exerciseIndex, {
                            default_sets: Number(e.target.value),
                          })
                        }
                      />
                      {isTimeMode(exercise.tracking_mode) ? (
                        <>
                          <Input
                            label="Min"
                            inputMode="numeric"
                            value={exercise.duration_minutes}
                            placeholder="1"
                            onChange={(e) =>
                              updateExercise(activeDay, exerciseIndex, {
                                duration_minutes: e.target.value,
                              })
                            }
                          />
                          <Input
                            label="Seg"
                            inputMode="numeric"
                            value={exercise.duration_seconds}
                            placeholder="30"
                            onChange={(e) =>
                              updateExercise(activeDay, exerciseIndex, {
                                duration_seconds: e.target.value,
                              })
                            }
                          />
                        </>
                      ) : (
                        <Input
                          label="Reps"
                          type="number"
                          min={1}
                          value={exercise.default_reps}
                          onChange={(e) =>
                            updateExercise(activeDay, exerciseIndex, {
                              default_reps: Number(e.target.value),
                            })
                          }
                        />
                      )}
                      {!isTimeMode(exercise.tracking_mode) ? (
                        <Input
                          label="Descanso (s)"
                          type="number"
                          min={0}
                          step={15}
                          value={exercise.rest_seconds}
                          onChange={(e) =>
                            updateExercise(activeDay, exerciseIndex, {
                              rest_seconds: Number(e.target.value),
                            })
                          }
                        />
                      ) : null}
                    </div>
                    {isTimeMode(exercise.tracking_mode) ? (
                      <div className="mt-2">
                        <Input
                          label="Descanso (s)"
                          type="number"
                          min={0}
                          step={15}
                          value={exercise.rest_seconds}
                          onChange={(e) =>
                            updateExercise(activeDay, exerciseIndex, {
                              rest_seconds: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="min-h-11 min-w-11 rounded-xl bg-evo-surface px-3 text-base font-bold disabled:opacity-30"
                        aria-label="Subir ejercicio"
                        disabled={exerciseIndex === 0}
                        onClick={() => moveExercise(activeDay, exerciseIndex, exerciseIndex - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="min-h-11 min-w-11 rounded-xl bg-evo-surface px-3 text-base font-bold disabled:opacity-30"
                        aria-label="Bajar ejercicio"
                        disabled={exerciseIndex === currentDay.exercises.length - 1}
                        onClick={() => moveExercise(activeDay, exerciseIndex, exerciseIndex + 1)}
                      >
                        ↓
                      </button>
                      {currentDay.exercises.length > 1 ? (
                        <button
                          type="button"
                          className="ml-auto min-h-11 rounded-xl px-4 text-sm font-bold text-evo-danger hover:bg-evo-danger/10"
                          onClick={() =>
                            updateDay(activeDay, {
                              exercises: currentDay.exercises.filter((_, i) => i !== exerciseIndex),
                            })
                          }
                        >
                          Quitar
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() =>
                    updateDay(activeDay, { exercises: [...currentDay.exercises, emptyExercise()] })
                  }
                >
                  + Ejercicio
                </Button>
              </div>

              {days.length > 1 ? (
                <CopyDayPicker
                  sourceLabel={`D${currentDay.day_index} · ${currentDay.name}`}
                  disabled={!currentDay.exercises.some((e) => e.name.trim())}
                  options={days
                    .map((day, index) => ({ day, index }))
                    .filter(({ index }) => index !== activeDay)
                    .map(({ day, index }) => ({
                      id: index,
                      label: `D${day.day_index}`,
                      sublabel: day.name,
                    }))}
                  onCopy={(targetIds) => {
                    const source = currentDay.exercises
                      .filter((e) => e.name.trim())
                      .map((e) => ({ ...e }))
                    if (source.length === 0) {
                      setError('Añade al menos un ejercicio antes de copiar.')
                      return
                    }
                    setDays((current) =>
                      current.map((day, index) =>
                        targetIds.includes(index)
                          ? { ...day, exercises: source.map((e) => ({ ...e })) }
                          : day,
                      ),
                    )
                    setError(null)
                  }}
                />
              ) : null}

              <div className="flex gap-2">
                {activeDay > 0 ? (
                  <Button type="button" variant="secondary" fullWidth onClick={() => setActiveDay((d) => d - 1)}>
                    ← Día ant.
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" fullWidth onClick={() => setStep(1)}>
                    ← Atrás
                  </Button>
                )}
                {activeDay < days.length - 1 ? (
                  <Button type="button" fullWidth onClick={() => setActiveDay((d) => d + 1)}>
                    Sig. día →
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm font-semibold text-evo-danger">{error}</p> : null}

          <Button type="submit" size="lg" fullWidth disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear rutina'}
          </Button>
        </form>
      )}
    </div>
  )
}
