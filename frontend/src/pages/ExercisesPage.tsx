import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { TrackingModePicker } from '../components/exercises/TrackingModePicker'
import { api, type CatalogExercise } from '../lib/api'
import {
  exercisePlanLabel,
  isTimeMode,
  joinDuration,
  splitDuration,
  type TimeDirection,
  type TrackingMode,
} from '../lib/tracking'

type Draft = {
  name: string
  target_muscle: string
  tracking_mode: TrackingMode
  time_direction: TimeDirection
  default_sets: number
  default_reps: number
  duration_minutes: string
  duration_seconds: string
  rest_seconds: number
}

const emptyDraft = (): Draft => ({
  name: '',
  target_muscle: '',
  tracking_mode: 'weight_reps',
  time_direction: 'faster',
  default_sets: 3,
  default_reps: 10,
  duration_minutes: '',
  duration_seconds: '',
  rest_seconds: 90,
})

export function ExercisesPage() {
  const queryClient = useQueryClient()
  const { confirm, notify } = useUiFeedback()
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['catalog-exercises'],
    queryFn: async () => {
      const { data: response } = await api.get<{ data: CatalogExercise[] }>('/catalog-exercises')
      return response.data
    },
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data ?? []
    return (data ?? []).filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.target_muscle ?? '').toLowerCase().includes(q),
    )
  }, [data, search])

  const save = useMutation({
    mutationFn: async () => {
      const timed = isTimeMode(draft.tracking_mode)
      const payload = {
        name: draft.name.trim(),
        target_muscle: draft.target_muscle.trim() || null,
        tracking_mode: draft.tracking_mode,
        time_direction: timed ? draft.time_direction : 'faster',
        default_sets: draft.default_sets,
        default_reps: draft.default_reps,
        default_duration_seconds: timed
          ? joinDuration(draft.duration_minutes, draft.duration_seconds)
          : null,
        rest_seconds: draft.rest_seconds,
      }
      if (editingId) {
        const { data: response } = await api.patch<{ data?: CatalogExercise; exercise?: CatalogExercise }>(
          `/catalog-exercises/${editingId}`,
          payload,
        )
        return response.exercise ?? response.data
      }
      const { data: response } = await api.post<{ exercise: CatalogExercise }>('/catalog-exercises', payload)
      return response.exercise
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalog-exercises'] })
      await queryClient.invalidateQueries({ queryKey: ['progress-insights'] })
      notify(editingId ? 'Ejercicio actualizado' : 'Ejercicio añadido al catálogo', 'success')
      setDraft(emptyDraft())
      setEditingId(null)
      setFormOpen(false)
      setError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
          ?.response?.data?.errors?.name?.[0] ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo guardar el ejercicio'
      setError(message)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/catalog-exercises/${id}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalog-exercises'] })
      notify('Ejercicio eliminado del catálogo', 'success')
    },
  })

  function startEdit(item: CatalogExercise) {
    setEditingId(item.id)
    const duration = splitDuration(item.default_duration_seconds)
    setDraft({
      name: item.name,
      target_muscle: item.target_muscle ?? '',
      tracking_mode: item.tracking_mode ?? 'weight_reps',
      time_direction: item.time_direction ?? 'faster',
      default_sets: item.default_sets,
      default_reps: item.default_reps,
      duration_minutes: duration.minutes,
      duration_seconds: duration.seconds,
      rest_seconds: item.rest_seconds,
    })
    setError(null)
    setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeForm() {
    setEditingId(null)
    setDraft(emptyDraft())
    setError(null)
    setFormOpen(false)
  }

  async function confirmDelete(item: CatalogExercise) {
    const ok = await confirm({
      title: `¿Quitar "${item.name}"?`,
      message:
        'Se elimina del catálogo. Las rutinas y series ya registradas se mantienen; el progreso puede pasar a agruparse por nombre.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (ok) remove.mutate(item.id)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) {
      setError('Pon un nombre al ejercicio')
      return
    }
    save.mutate()
  }

  const catalogEmpty = !isLoading && !data?.length
  const showForm = catalogEmpty || formOpen || editingId !== null

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">Catálogo</h1>
        <p className="text-base text-evo-muted">
          {data?.length
            ? `${data.length} ${data.length === 1 ? 'ejercicio' : 'ejercicios'} para tus rutinas.`
            : 'Los ejercicios que guardes aquí se reutilizan en cada rutina.'}
        </p>
      </div>

      {showForm ? (
        <form onSubmit={onSubmit} className="panel space-y-4 p-5">
          <p className="font-display text-2xl font-bold">
            {editingId ? 'Editar ejercicio' : 'Nuevo ejercicio'}
          </p>
          <Input
            label="Nombre"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Press banca, dominadas…"
            error={error ?? undefined}
          />
          <Input
            label="Músculo"
            value={draft.target_muscle}
            onChange={(e) => setDraft((d) => ({ ...d, target_muscle: e.target.value }))}
            placeholder="Pecho, espalda, pierna…"
          />
          <TrackingModePicker
            mode={draft.tracking_mode}
            direction={draft.time_direction}
            onMode={(tracking_mode) => setDraft((d) => ({ ...d, tracking_mode }))}
            onDirection={(time_direction) => setDraft((d) => ({ ...d, time_direction }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Series"
              type="number"
              min={1}
              value={draft.default_sets}
              onChange={(e) => setDraft((d) => ({ ...d, default_sets: Number(e.target.value) }))}
            />
            {isTimeMode(draft.tracking_mode) ? (
              <>
                <Input
                  label="Objetivo min"
                  inputMode="numeric"
                  value={draft.duration_minutes}
                  placeholder="1"
                  onChange={(e) => setDraft((d) => ({ ...d, duration_minutes: e.target.value }))}
                />
                <Input
                  label="Objetivo seg"
                  inputMode="numeric"
                  value={draft.duration_seconds}
                  placeholder="30"
                  onChange={(e) => setDraft((d) => ({ ...d, duration_seconds: e.target.value }))}
                />
              </>
            ) : (
              <Input
                label="Reps"
                type="number"
                min={1}
                value={draft.default_reps}
                onChange={(e) => setDraft((d) => ({ ...d, default_reps: Number(e.target.value) }))}
              />
            )}
            <Input
              label="Pausa (seg)"
              type="number"
              min={0}
              value={draft.rest_seconds}
              onChange={(e) => setDraft((d) => ({ ...d, rest_seconds: Number(e.target.value) }))}
            />
          </div>
          <Button type="submit" size="lg" fullWidth disabled={save.isPending}>
            {editingId ? 'Guardar cambios' : 'Añadir al catálogo'}
          </Button>
          {!catalogEmpty ? (
            <Button type="button" variant="secondary" fullWidth onClick={closeForm}>
              Cancelar
            </Button>
          ) : null}
        </form>
      ) : (
        <Button type="button" size="lg" fullWidth onClick={() => setFormOpen(true)}>
          Añadir ejercicio
        </Button>
      )}

      {!catalogEmpty ? (
        <Input
          label="Buscar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nombre o músculo"
        />
      ) : null}

      {isLoading ? (
        <p className="text-base text-evo-muted">Cargando catálogo…</p>
      ) : catalogEmpty ? null : !filtered.length ? (
        <p className="rounded-3xl bg-evo-surface px-4 py-6 text-center text-base text-evo-muted">
          Ningún ejercicio coincide con esa búsqueda.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <li key={item.id} className="panel space-y-3 p-4">
              <div>
                <p className="font-display text-xl font-bold">{item.name}</p>
                <p className="mt-1 text-base text-evo-muted">
                  {item.target_muscle ? `${item.target_muscle} · ` : ''}
                  {exercisePlanLabel(item)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" onClick={() => startEdit(item)}>
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => void confirmDelete(item)}
                  disabled={remove.isPending}
                >
                  Borrar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link to="/routines/new" className="block text-center text-base font-bold text-evo-accent">
        Usar en una rutina nueva
      </Link>
    </div>
  )
}
