import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CopyDayPicker } from '../components/routines/CopyDayPicker'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { TRAINING_TEMPLATES, WEEKDAY_LABELS, api, defaultWeekdays } from '../lib/api'

type DraftExercise = {
  name: string
  default_sets: number
  default_reps: number
  rest_seconds: number
}

type DraftDay = {
  day_index: number
  weekday: number
  name: string
  focus: string
  exercises: DraftExercise[]
}

function emptyExercise(): DraftExercise {
  return { name: '', default_sets: 3, default_reps: 10, rest_seconds: 90 }
}

function buildDaysFromTemplate(count: number): DraftDay[] {
  const template = TRAINING_TEMPLATES[count] ?? TRAINING_TEMPLATES[3]
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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [sessionsPerWeek, setSessionsPerWeek] = useState(4)
  const [isActive, setIsActive] = useState(true)
  const [activeDay, setActiveDay] = useState(0)
  const [days, setDays] = useState<DraftDay[]>(() => buildDaysFromTemplate(4))
  const [error, setError] = useState<string | null>(null)

  const template = TRAINING_TEMPLATES[sessionsPerWeek] ?? TRAINING_TEMPLATES[3]
  const currentDay = days[activeDay]

  useEffect(() => {
    setDays(buildDaysFromTemplate(sessionsPerWeek))
    setActiveDay(0)
  }, [sessionsPerWeek])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        sessions_per_week: sessionsPerWeek,
        is_active: isActive,
        starts_on: null,
        ends_on: null,
        days: days.map((day) => ({
          day_index: day.day_index,
          weekday: day.weekday,
          name: day.name,
          focus: day.focus || null,
          exercises: day.exercises
            .filter((exercise) => exercise.name.trim())
            .map((exercise, index) => ({
              name: exercise.name.trim(),
              sort_order: index,
              default_sets: exercise.default_sets,
              default_reps: exercise.default_reps,
              rest_seconds: exercise.rest_seconds,
              target_muscle: null,
            })),
        })),
      }
      const { data } = await api.post<{ routine: { id: number } }>('/routines', payload)
      return data.routine.id
    },
    onSuccess: async (routineId) => {
      await queryClient.invalidateQueries({ queryKey: ['routines'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      navigate(`/routines/${routineId}`)
    },
    onError: () => setError('No se pudo guardar. Revisa nombre y ejercicios.'),
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

  const dayProgress = days.map((day) => day.exercises.some((e) => e.name.trim()))

  return (
    <div className="no-x-scroll mx-auto max-w-xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/routines" className="text-sm font-semibold text-evo-accent">
            ← Rutinas
          </Link>
          <h2 className="mt-1 font-display text-2xl font-bold">Nueva rutina</h2>
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
                    onClick={() => setSessionsPerWeek(n)}
                    className={[
                      'rounded-xl border-2 py-3 text-center text-sm font-bold transition',
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
                  'rounded-xl border-2 px-2 py-2.5 text-left transition',
                  index === activeDay
                    ? 'border-evo-accent bg-evo-accent/10'
                    : 'border-evo-border bg-evo-surface',
                ].join(' ')}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold">D{day.day_index}</span>
                  <span className="text-[0.65rem]">{dayProgress[index] ? '✓' : '·'}</span>
                </span>
                <span className="mt-0.5 block truncate text-[0.7rem] font-semibold">{day.name}</span>
                <span className="block text-[0.65rem] text-evo-muted">
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
                <p className="text-sm font-semibold">Ejercicios</p>
                {currentDay.exercises.map((exercise, exerciseIndex) => (
                  <div
                    key={exerciseIndex}
                    className="rounded-xl border border-evo-border bg-evo-surface-2 p-3"
                  >
                    <Input
                      label={`#${exerciseIndex + 1}`}
                      value={exercise.name}
                      onChange={(e) =>
                        updateExercise(activeDay, exerciseIndex, { name: e.target.value })
                      }
                      placeholder="Press banca, Sentadilla…"
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
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
                    </div>
                    {currentDay.exercises.length > 1 ? (
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-evo-danger"
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
            {mutation.isPending ? 'Guardando…' : 'Crear rutina'}
          </Button>
        </form>
      )}
    </div>
  )
}
