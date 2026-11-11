import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { ExercisePickerSheet } from '../components/exercises/ExercisePickerSheet'
import { Icon } from '../components/icons/Icon'
import { CopyDayPicker } from '../components/routines/CopyDayPicker'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Stepper } from '../components/ui/Stepper'
import { TRAINING_TEMPLATES, WEEKDAY_LABELS, api, apiErrorMessage, type CatalogExercise, type Routine } from '../lib/api'
import { invalidateTraining } from '../lib/queryClient'
import { formatDuration, isTimeMode, type TimeDirection, type TrackingMode } from '../lib/tracking'

const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

type DraftExercise = {
  /** Clave local estable para la lista (los ejercicios se reordenan). */
  key: string
  /** Solo al editar: ejercicio ya guardado (conserva su historial). */
  id?: number
  name: string
  catalog_exercise_id: number | null
  target_muscle: string | null
  tracking_mode: TrackingMode
  time_direction: TimeDirection
  default_sets: number
  default_reps: number
  default_duration_seconds: number
  rest_seconds: number
}

type DraftDay = {
  key: string
  id?: number
  weekday: number
  name: string
  focus: string
  exercises: DraftExercise[]
}

let keySeq = 0
const newKey = () => `k${++keySeq}`

function exerciseFromCatalog(item: CatalogExercise): DraftExercise {
  return {
    key: newKey(),
    name: item.name,
    catalog_exercise_id: item.id,
    target_muscle: item.target_muscle ?? null,
    tracking_mode: item.tracking_mode ?? 'weight_reps',
    time_direction: item.time_direction ?? 'faster',
    default_sets: item.default_sets || 3,
    default_reps: item.default_reps || 10,
    default_duration_seconds: item.default_duration_seconds ?? 60,
    rest_seconds: item.rest_seconds ?? 90,
  }
}

function draftsFromRoutine(routine: Routine): DraftDay[] {
  return [...(routine.days ?? [])]
    .sort((a, b) => (a.weekday ?? a.day_index) - (b.weekday ?? b.day_index))
    .map((day, index) => ({
      key: newKey(),
      id: day.id,
      weekday: day.weekday ?? index + 1,
      name: day.name,
      focus: day.focus ?? '',
      exercises: [...(day.exercises ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((exercise) => ({
          key: newKey(),
          id: exercise.id,
          name: exercise.name,
          catalog_exercise_id: exercise.catalog_exercise_id ?? null,
          target_muscle: exercise.target_muscle ?? null,
          tracking_mode: exercise.tracking_mode ?? 'weight_reps',
          time_direction: exercise.time_direction ?? 'faster',
          default_sets: exercise.default_sets,
          default_reps: exercise.default_reps,
          default_duration_seconds: exercise.default_duration_seconds ?? 60,
          rest_seconds: exercise.rest_seconds ?? 90,
        })),
    }))
}

function templateFor(count: number) {
  return (TRAINING_TEMPLATES[count] ?? TRAINING_TEMPLATES[3])!
}

/** Nombres y enfoques de la plantilla según el número de días (solo si aún no hay nada escrito). */
function applyTemplateNames(days: DraftDay[]): DraftDay[] {
  const template = templateFor(days.length)
  return days.map((day, index) => ({
    ...day,
    name: template.days[index]?.name ?? `Día ${index + 1}`,
    focus: template.days[index]?.focus ?? '',
  }))
}

const byWeekday = (a: DraftDay, b: DraftDay) => a.weekday - b.weekday

function defaultDays(): DraftDay[] {
  return applyTemplateNames(
    [1, 2, 4, 5].map((weekday) => ({ key: newKey(), weekday, name: '', focus: '', exercises: [] })),
  )
}

const hasExercises = (day: DraftDay) => day.exercises.length > 0

export function NewRoutinePage() {
  const { id } = useParams()
  const editingId = id ? Number(id) : null
  const isEditing = editingId != null && Number.isFinite(editingId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirm } = useUiFeedback()
  const loadedRef = useRef(false)
  const [step, setStep] = useState<1 | 2>(isEditing ? 2 : 1)
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [days, setDays] = useState<DraftDay[]>(defaultDays)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [picker, setPicker] = useState<{ replaceKey?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | undefined>()
  const [dates, setDates] = useState<{ starts_on: string | null; ends_on: string | null }>({ starts_on: null, ends_on: null })

  const routineQuery = useQuery({
    queryKey: ['routine', editingId],
    enabled: isEditing,
    queryFn: async () => (await api.get<{ data: Routine }>(`/routines/${editingId}`)).data.data,
  })

  // Al editar, el formulario se rellena una sola vez con la rutina guardada.
  useEffect(() => {
    const routine = routineQuery.data
    if (!routine || loadedRef.current) return
    loadedRef.current = true
    const loaded = draftsFromRoutine(routine)
    setName(routine.name)
    setIsActive(routine.is_active)
    if (loaded.length > 0) setDays(loaded)
    setDates({ starts_on: routine.starts_on ?? null, ends_on: routine.ends_on ?? null })
  }, [routineQuery.data])

  const currentDay = days.find((day) => day.key === activeKey) ?? days[0]
  const template = templateFor(days.length)
  const anyContent = days.some(hasExercises)

  async function toggleWeekday(weekday: number) {
    const existing = days.find((day) => day.weekday === weekday)
    if (existing) {
      if (days.length === 1) return
      if (hasExercises(existing)) {
        const ok = await confirm({
          title: `¿Quitar el ${WEEKDAY_LABELS[weekday - 1]?.toLowerCase()}?`,
          message: `«${existing.name}» tiene ${existing.exercises.length} ejercicios y se quitarán de la rutina.`,
          confirmLabel: 'Quitar día',
          cancelLabel: 'Cancelar',
          danger: true,
        })
        if (!ok) return
      }
      const next = days.filter((day) => day.key !== existing.key)
      setDays(anyContent || isEditing ? next : applyTemplateNames(next))
      return
    }
    const next = [...days, { key: newKey(), weekday, name: `Día ${days.length + 1}`, focus: '', exercises: [] }].sort(byWeekday)
    setDays(anyContent || isEditing ? next : applyTemplateNames(next))
  }

  function updateDay(key: string, patch: Partial<DraftDay>) {
    setDays((current) => current.map((day) => (day.key === key ? { ...day, ...patch } : day)))
  }

  function updateExercise(dayKey: string, exerciseKey: string, patch: Partial<DraftExercise>) {
    setDays((current) =>
      current.map((day) =>
        day.key !== dayKey
          ? day
          : { ...day, exercises: day.exercises.map((e) => (e.key === exerciseKey ? { ...e, ...patch } : e)) },
      ),
    )
  }

  function moveExercise(dayKey: string, from: number, to: number) {
    setDays((current) =>
      current.map((day) => {
        if (day.key !== dayKey || to < 0 || to >= day.exercises.length) return day
        const exercises = [...day.exercises]
        const [moved] = exercises.splice(from, 1)
        if (moved) exercises.splice(to, 0, moved)
        return { ...day, exercises }
      }),
    )
  }

  function removeExercise(dayKey: string, exerciseKey: string) {
    setDays((current) =>
      current.map((day) => (day.key === dayKey ? { ...day, exercises: day.exercises.filter((e) => e.key !== exerciseKey) } : day)),
    )
  }

  function handlePicked(picked: CatalogExercise[]) {
    if (!currentDay) return
    const replaceKey = picker?.replaceKey
    if (replaceKey) {
      const item = picked[0]
      if (item) {
        // Cambiar el ejercicio conserva series, reps y descanso si se mide igual.
        const old = currentDay.exercises.find((e) => e.key === replaceKey)
        const fresh = exerciseFromCatalog(item)
        const keepPlan = old && old.tracking_mode === fresh.tracking_mode
        updateDay(currentDay.key, {
          exercises: currentDay.exercises.map((e) =>
            e.key === replaceKey
              ? {
                  ...fresh,
                  key: e.key,
                  ...(keepPlan
                    ? { default_sets: e.default_sets, default_reps: e.default_reps, rest_seconds: e.rest_seconds, default_duration_seconds: e.default_duration_seconds }
                    : {}),
                }
              : e,
          ),
        })
      }
    } else {
      updateDay(currentDay.key, { exercises: [...currentDay.exercises, ...picked.map(exerciseFromCatalog)] })
    }
    setPicker(null)
    setError(null)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        sessions_per_week: days.length,
        is_active: isActive,
        starts_on: dates.starts_on,
        ends_on: dates.ends_on,
        days: days.map((day, dayPosition) => ({
          ...(day.id ? { id: day.id } : {}),
          day_index: dayPosition + 1,
          weekday: day.weekday,
          name: day.name.trim() || `Día ${dayPosition + 1}`,
          focus: day.focus || null,
          exercises: day.exercises.map((exercise, index) => ({
            ...(exercise.id ? { id: exercise.id } : {}),
            name: exercise.name.trim(),
            catalog_exercise_id: exercise.catalog_exercise_id,
            sort_order: index,
            tracking_mode: exercise.tracking_mode,
            time_direction: exercise.time_direction,
            default_sets: exercise.default_sets,
            default_reps: exercise.default_reps,
            default_duration_seconds: isTimeMode(exercise.tracking_mode) ? exercise.default_duration_seconds : null,
            rest_seconds: exercise.rest_seconds,
            target_muscle: exercise.target_muscle,
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
      navigate(`/routines/${routineId}`, { replace: true })
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'No se ha podido guardar. Revisa la conexión.')),
  })

  function goToExercises(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setNameError('Pon un nombre a la rutina.')
      return
    }
    setNameError(undefined)
    setStep(2)
    window.scrollTo({ top: 0 })
  }

  function save() {
    if (!name.trim()) {
      setStep(1)
      setNameError('Pon un nombre a la rutina.')
      return
    }
    const empty = days.find((day) => !hasExercises(day))
    if (empty) {
      setActiveKey(empty.key)
      setError(`Añade al menos un ejercicio a «${empty.name || WEEKDAY_LABELS[empty.weekday - 1]}».`)
      return
    }
    setError(null)
    mutation.mutate()
  }

  if (isEditing && routineQuery.isLoading) return <p className="text-sm text-evo-muted">Cargando rutina…</p>
  if (isEditing && routineQuery.isError) return <p className="text-sm font-semibold text-evo-danger">No se ha podido cargar la rutina.</p>

  return (
    <div className="no-x-scroll mx-auto max-w-2xl space-y-4">
      <ol className="grid grid-cols-2 gap-2" aria-label="Pasos">
        {[
          { n: 1 as const, label: 'Lo básico' },
          { n: 2 as const, label: 'Ejercicios' },
        ].map((item) => (
          <li key={item.n}>
            <button
              type="button"
              aria-current={step === item.n ? 'step' : undefined}
              onClick={() => (item.n === 1 ? setStep(1) : name.trim() ? setStep(2) : setNameError('Pon un nombre a la rutina.'))}
              className="w-full text-left"
            >
              <span className={['block h-1.5 rounded-full', step >= item.n ? 'bg-evo-accent' : 'bg-evo-border/60'].join(' ')} />
              <span className={['mt-1.5 block text-xs font-bold', step === item.n ? 'text-evo-text' : 'text-evo-muted'].join(' ')}>
                {item.n}. {item.label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <form onSubmit={goToExercises} className="space-y-4">
          <section className="panel space-y-5 p-4 sm:p-5">
            <Input
              label="Nombre de la rutina"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Torso / Pierna, Hipertrofia…"
              maxLength={120}
              error={nameError}
              autoFocus={!isEditing}
            />

            <fieldset>
              <legend className="mb-2 text-sm font-semibold">¿Qué días entrenas?</legend>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_SHORT.map((letter, index) => {
                  const weekday = index + 1
                  const on = days.some((day) => day.weekday === weekday)
                  return (
                    <button
                      key={letter}
                      type="button"
                      aria-pressed={on}
                      aria-label={WEEKDAY_LABELS[index]}
                      onClick={() => void toggleWeekday(weekday)}
                      className={[
                        'aspect-square min-h-11 rounded-full text-base font-bold transition active:scale-90',
                        on ? 'bg-evo-accent text-[#1a120c] shadow-[0_6px_18px_rgba(255,138,76,0.3)]' : 'bg-evo-surface-2 text-evo-muted',
                      ].join(' ')}
                    >
                      {letter}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 rounded-2xl bg-evo-surface-2 px-4 py-3">
                <p className="text-sm font-bold">
                  {days.length} {days.length === 1 ? 'día' : 'días'} por semana
                  {!anyContent ? <span className="text-evo-accent"> · {template.label}</span> : null}
                </p>
                <p className="mt-0.5 text-sm text-evo-muted">
                  {anyContent ? days.map((day) => day.name).join(' · ') : template.tip}
                </p>
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-evo-surface-2 px-4 py-3">
              <span>
                <span className="block font-bold">Activa en la agenda</span>
                <span className="block text-sm text-evo-muted">Los entrenos aparecen solos en tu semana.</span>
              </span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-6 w-6 shrink-0 accent-evo-accent"
              />
            </label>
          </section>

          <Button type="submit" size="lg" fullWidth>
            Siguiente: ejercicios
          </Button>
        </form>
      ) : (
        <div className="space-y-4 pb-24">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Días">
            {days.map((day) => {
              const selected = day.key === currentDay?.key
              const empty = !hasExercises(day)
              return (
                <button
                  key={day.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveKey(day.key)}
                  className={[
                    'min-w-[7.5rem] shrink-0 rounded-2xl border-2 px-3 py-2 text-left transition',
                    selected ? 'border-evo-accent bg-evo-accent/10' : 'border-evo-border/70 bg-evo-surface',
                  ].join(' ')}
                >
                  <span className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-evo-muted">
                    {WEEKDAY_LABELS[day.weekday - 1]?.slice(0, 3)}
                    {empty ? (
                      <span className="h-2 w-2 rounded-full bg-evo-warn" aria-label="Sin ejercicios" />
                    ) : (
                      <span className="tabular-nums">{day.exercises.length}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block max-w-[9rem] truncate text-sm font-bold">{day.name || 'Sin nombre'}</span>
                </button>
              )
            })}
          </div>

          {currentDay ? (
            <section className="space-y-3" aria-label={`Ejercicios de ${currentDay.name}`}>
              <Input
                label={`Nombre del ${WEEKDAY_LABELS[currentDay.weekday - 1]?.toLowerCase()}`}
                value={currentDay.name}
                maxLength={80}
                onChange={(e) => updateDay(currentDay.key, { name: e.target.value })}
                placeholder="Torso, Pierna, Empuje…"
              />

              {currentDay.exercises.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setPicker({})}
                  className="flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-evo-border px-4 py-8 text-center transition active:scale-[0.99]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-evo-accent/15 text-2xl font-bold text-evo-accent" aria-hidden>
                    +
                  </span>
                  <span className="font-bold">Añade los ejercicios de este día</span>
                  <span className="text-sm text-evo-muted">De tu catálogo o nuevos, varios a la vez.</span>
                </button>
              ) : (
                <ol className="space-y-2">
                  {currentDay.exercises.map((exercise, index) => (
                    <ExerciseRow
                      key={exercise.key}
                      exercise={exercise}
                      index={index}
                      isLast={index === currentDay.exercises.length - 1}
                      onChange={(patch) => updateExercise(currentDay.key, exercise.key, patch)}
                      onMove={(to) => moveExercise(currentDay.key, index, to)}
                      onRemove={() => removeExercise(currentDay.key, exercise.key)}
                      onReplace={() => setPicker({ replaceKey: exercise.key })}
                    />
                  ))}
                </ol>
              )}

              {currentDay.exercises.length > 0 ? (
                <Button type="button" variant="secondary" fullWidth onClick={() => setPicker({})}>
                  + Añadir ejercicios
                </Button>
              ) : null}

              {days.length > 1 ? (
                <CopyDayPicker
                  sourceLabel={currentDay.name || WEEKDAY_LABELS[currentDay.weekday - 1] || ''}
                  disabled={!hasExercises(currentDay)}
                  options={days
                    .filter((day) => day.key !== currentDay.key)
                    .map((day) => ({ id: day.key, label: WEEKDAY_LABELS[day.weekday - 1]?.slice(0, 3) ?? '', sublabel: day.name }))}
                  onCopy={(targetKeys) => {
                    const source = currentDay.exercises
                    setDays((current) =>
                      current.map((day) =>
                        targetKeys.includes(day.key)
                          ? { ...day, exercises: source.map((e) => ({ ...e, id: undefined, key: newKey() })) }
                          : day,
                      ),
                    )
                    setError(null)
                  }}
                />
              ) : null}
            </section>
          ) : null}

          <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-evo-border/40 bg-evo-bg/95 px-4 pt-3 backdrop-blur-xl lg:left-[260px]">
            <div className="mx-auto max-w-2xl space-y-2">
              {error ? (
                <p role="alert" className="text-center text-sm font-semibold text-evo-danger">
                  {error}
                </p>
              ) : null}
              <Button type="button" size="lg" fullWidth disabled={mutation.isPending} onClick={save}>
                {mutation.isPending ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear rutina'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {picker && currentDay ? (
        <ExercisePickerSheet
          title={picker.replaceKey ? 'Cambiar ejercicio' : `Añadir a ${currentDay.name || 'este día'}`}
          mode={picker.replaceKey ? 'single' : 'multiple'}
          usedIds={currentDay.exercises.map((e) => e.catalog_exercise_id).filter((v): v is number => v != null)}
          onClose={() => setPicker(null)}
          onConfirm={handlePicked}
        />
      ) : null}
    </div>
  )
}

function ExerciseRow({
  exercise,
  index,
  isLast,
  onChange,
  onMove,
  onRemove,
  onReplace,
}: {
  exercise: DraftExercise
  index: number
  isLast: boolean
  onChange: (patch: Partial<DraftExercise>) => void
  onMove: (to: number) => void
  onRemove: () => void
  onReplace: () => void
}) {
  const timed = isTimeMode(exercise.tracking_mode)
  const iconBtn =
    'flex h-10 w-10 items-center justify-center rounded-full text-evo-muted transition hover:bg-evo-surface-2 active:scale-90 disabled:opacity-25'

  return (
    <li className="rounded-3xl border border-evo-border/60 bg-evo-surface p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-evo-accent/15 text-sm font-bold text-evo-accent" aria-hidden>
          {index + 1}
        </span>
        <button type="button" onClick={onReplace} className="min-w-0 flex-1 text-left" aria-label={`Cambiar ${exercise.name}`}>
          <span className="block truncate font-bold">{exercise.name}</span>
          <span className="block truncate text-xs text-evo-muted">
            {exercise.target_muscle ? `${exercise.target_muscle} · ` : ''}Toca para cambiar
          </span>
        </button>
        <button type="button" className={iconBtn} aria-label="Subir" disabled={index === 0} onClick={() => onMove(index - 1)}>
          <Icon name="back" className="h-5 w-5 rotate-90" />
        </button>
        <button type="button" className={iconBtn} aria-label="Bajar" disabled={isLast} onClick={() => onMove(index + 1)}>
          <Icon name="back" className="h-5 w-5 -rotate-90" />
        </button>
        <button type="button" className={`${iconBtn} hover:text-evo-danger`} aria-label={`Quitar ${exercise.name}`} onClick={onRemove}>
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stepper label="Series" value={exercise.default_sets} min={1} max={10} onChange={(n) => onChange({ default_sets: n })} />
        {timed ? (
          <Stepper
            label="Objetivo"
            value={exercise.default_duration_seconds}
            min={5}
            max={3600}
            step={exercise.default_duration_seconds >= 120 ? 30 : 5}
            format={formatDuration}
            onChange={(n) => onChange({ default_duration_seconds: n })}
          />
        ) : (
          <Stepper label="Reps" value={exercise.default_reps} min={1} max={50} onChange={(n) => onChange({ default_reps: n })} />
        )}
        <Stepper
          label="Descanso"
          value={exercise.rest_seconds}
          min={0}
          max={600}
          step={15}
          format={formatDuration}
          onChange={(n) => onChange({ rest_seconds: n })}
        />
      </div>
    </li>
  )
}
