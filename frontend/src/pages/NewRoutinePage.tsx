import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { FOCUS_LABELS, TRAINING_TEMPLATES, WEEKDAY_LABELS, api, defaultWeekdays } from '../lib/api'

type DraftExercise = {
  name: string
  default_sets: number
  default_reps: number
  rest_seconds: number
  target_muscle: string
}

type DraftDay = {
  day_index: number
  weekday: number
  name: string
  focus: string
  exercises: DraftExercise[]
}

function emptyExercise(): DraftExercise {
  return { name: '', default_sets: 3, default_reps: 10, rest_seconds: 90, target_muscle: '' }
}

function buildDaysFromTemplate(count: number): DraftDay[] {
  const template = TRAINING_TEMPLATES[count] ?? TRAINING_TEMPLATES[3]
  const weekdays = defaultWeekdays(count)
  return template.days.slice(0, count).map((day, index) => ({
    day_index: index + 1,
    weekday: weekdays[index] ?? index + 1,
    name: day.name,
    focus: day.focus,
    exercises: [emptyExercise()],
  }))
}

export function NewRoutinePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [sessionsPerWeek, setSessionsPerWeek] = useState(4)
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [activeDay, setActiveDay] = useState(0)
  const [days, setDays] = useState<DraftDay[]>(() => buildDaysFromTemplate(4))
  const [copyTargets, setCopyTargets] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const template = TRAINING_TEMPLATES[sessionsPerWeek] ?? TRAINING_TEMPLATES[3]

  useEffect(() => {
    setDays(buildDaysFromTemplate(sessionsPerWeek))
    setActiveDay(0)
    setCopyTargets([])
  }, [sessionsPerWeek])

  const currentDay = days[activeDay]

  const otherDayIndexes = useMemo(
    () => days.map((_, index) => index).filter((index) => index !== activeDay),
    [days, activeDay],
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        sessions_per_week: sessionsPerWeek,
        is_active: isActive,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
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
              target_muscle: exercise.target_muscle || null,
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
    onError: () => setError('No se pudo guardar la rutina. Revisa que cada día tenga nombre.'),
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

  function copyCurrentDayToTargets() {
    if (!currentDay || copyTargets.length === 0) return
    const sourceExercises = currentDay.exercises
      .filter((exercise) => exercise.name.trim())
      .map((exercise) => ({ ...exercise }))

    if (sourceExercises.length === 0) {
      setError('Añade al menos un ejercicio en este día antes de copiar.')
      return
    }

    setDays((current) =>
      current.map((day, index) =>
        copyTargets.includes(index)
          ? { ...day, exercises: sourceExercises.map((exercise) => ({ ...exercise })) }
          : day,
      ),
    )
    setCopyTargets([])
    setError(null)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const emptyDays = days.filter((day) => !day.exercises.some((e) => e.name.trim()))
    if (emptyDays.length > 0) {
      setError(
        `Faltan ejercicios en: ${emptyDays.map((d) => d.name).join(', ')}. Si un día es descanso, quita un día de la rutina.`,
      )
      return
    }
    setError(null)
    mutation.mutate()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Nueva rutina</h2>
        <p className="text-sm text-evo-muted">
          Cada día del plan se asigna a un día de la semana y aparece solo en el calendario.
        </p>
      </div>

      <Input label="Nombre de la rutina" value={name} onChange={(e) => setName(e.target.value)} required />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Fecha de inicio (opcional)"
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
        />
        <Input
          label="Fecha de fin (opcional)"
          type="date"
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
        />
      </div>
      <p className="text-xs text-evo-muted">
        Si dejas las fechas vacías, la rutina es indefinida. Puedes tener varias activas a la vez.
      </p>

      <label className="panel flex items-center justify-between gap-3 px-4 py-3">
        <span>
          <span className="block text-sm font-semibold">Activar al crear</span>
          <span className="block text-xs text-evo-muted">Si está activa, rellena el calendario automáticamente</span>
        </span>
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-5 w-5 accent-evo-accent"
        />
      </label>

      <div className="space-y-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-evo-muted">Días de entrenamiento / semana</span>
          <select
            className="w-full rounded-xl border border-evo-border bg-evo-surface px-3 py-3 text-evo-text"
            value={sessionsPerWeek}
            onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} día{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-xl border border-evo-accent/30 bg-evo-accent/10 px-3 py-2 text-sm">
          <p className="font-semibold text-evo-accent">{template.label}</p>
          <p className="mt-1 text-evo-muted">{template.tip}</p>
          <p className="mt-2 text-xs text-evo-text">
            Calendario: {days.map((d) => WEEKDAY_LABELS[d.weekday - 1]).join(' · ')}
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((day, index) => {
          const filled = day.exercises.some((e) => e.name.trim())
          return (
            <button
              key={day.day_index}
              type="button"
              onClick={() => setActiveDay(index)}
              className={[
                'min-w-[4.5rem] rounded-xl border px-3 py-2 text-left text-xs transition',
                index === activeDay
                  ? 'border-evo-accent bg-evo-accent/15 text-evo-accent'
                  : 'border-evo-border bg-evo-surface text-evo-muted',
              ].join(' ')}
            >
              <span className="block font-semibold">D{day.day_index}</span>
              <span className="block truncate">{day.name}</span>
              <span className="mt-1 block text-[0.65rem]">
                {WEEKDAY_LABELS[day.weekday - 1]?.slice(0, 3)} · {filled ? '✓' : 'vacío'}
              </span>
            </button>
          )
        })}
      </div>

      {currentDay ? (
        <div className="space-y-3 rounded-2xl border border-evo-border bg-evo-surface p-4">
          <Input
            label="Nombre del día"
            value={currentDay.name}
            onChange={(e) => updateDay(activeDay, { name: e.target.value })}
            required
          />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-evo-muted">Día de la semana en el calendario</span>
            <select
              className="w-full rounded-xl border border-evo-border bg-evo-bg px-3 py-3 text-evo-text"
              value={currentDay.weekday}
              onChange={(e) => {
                const weekday = Number(e.target.value)
                const taken = days.some((day, i) => i !== activeDay && day.weekday === weekday)
                if (taken) {
                  setError('Ese día de la semana ya está asignado a otro entrenamiento.')
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

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-evo-muted">Enfoque</span>
            <select
              className="w-full rounded-xl border border-evo-border bg-evo-bg px-3 py-3 text-evo-text"
              value={currentDay.focus}
              onChange={(e) => updateDay(activeDay, { focus: e.target.value })}
            >
              {Object.entries(FOCUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <p className="text-sm font-medium text-evo-muted">Ejercicios del día</p>
            {currentDay.exercises.map((exercise, exerciseIndex) => (
              <div
                key={exerciseIndex}
                className="space-y-2 rounded-xl border border-evo-border bg-evo-bg p-3"
              >
                <Input
                  label={`Ejercicio ${exerciseIndex + 1}`}
                  value={exercise.name}
                  onChange={(e) => updateExercise(activeDay, exerciseIndex, { name: e.target.value })}
                  placeholder="Ej. Press banca, Sentadilla…"
                />
                <div className="grid grid-cols-3 gap-2">
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
                <Input
                  label="Músculo / patrón (opcional)"
                  value={exercise.target_muscle}
                  onChange={(e) =>
                    updateExercise(activeDay, exerciseIndex, { target_muscle: e.target.value })
                  }
                  placeholder="Pecho, espalda, cuádriceps…"
                />
                {currentDay.exercises.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs text-evo-danger"
                    onClick={() =>
                      updateDay(activeDay, {
                        exercises: currentDay.exercises.filter((_, i) => i !== exerciseIndex),
                      })
                    }
                  >
                    Quitar ejercicio
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
              + Añadir ejercicio
            </Button>
          </div>

          {otherDayIndexes.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-dashed border-evo-border p-3">
              <p className="text-sm font-semibold">Copiar este día a…</p>
              <p className="text-xs text-evo-muted">
                Útil para Push A → Push B o Full body A → B. Sustituye los ejercicios del día destino.
              </p>
              <div className="flex flex-wrap gap-2">
                {otherDayIndexes.map((index) => {
                  const selected = copyTargets.includes(index)
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() =>
                        setCopyTargets((current) =>
                          selected ? current.filter((i) => i !== index) : [...current, index],
                        )
                      }
                      className={[
                        'rounded-lg border px-2 py-1 text-xs',
                        selected
                          ? 'border-evo-lime bg-evo-lime/15 text-evo-lime'
                          : 'border-evo-border text-evo-muted',
                      ].join(' ')}
                    >
                      {days[index].name}
                    </button>
                  )
                })}
              </div>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={copyTargets.length === 0}
                onClick={copyCurrentDayToTargets}
              >
                Copiar ejercicios
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-evo-danger">{error}</p> : null}

      <Button type="submit" fullWidth disabled={mutation.isPending}>
        {mutation.isPending ? 'Guardando…' : 'Guardar rutina'}
      </Button>
    </form>
  )
}
