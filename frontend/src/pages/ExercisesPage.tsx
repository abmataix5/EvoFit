import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { api, type CatalogExercise } from '../lib/api'

type Draft = {
  name: string
  target_muscle: string
  default_sets: number
  default_reps: number
  rest_seconds: number
}

const emptyDraft = (): Draft => ({
  name: '',
  target_muscle: '',
  default_sets: 3,
  default_reps: 10,
  rest_seconds: 90,
})

export function ExercisesPage() {
  const queryClient = useQueryClient()
  const { confirm, notify } = useUiFeedback()
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<number | null>(null)
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
      const payload = {
        name: draft.name.trim(),
        target_muscle: draft.target_muscle.trim() || null,
        default_sets: draft.default_sets,
        default_reps: draft.default_reps,
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
    setDraft({
      name: item.name,
      target_muscle: item.target_muscle ?? '',
      default_sets: item.default_sets,
      default_reps: item.default_reps,
      rest_seconds: item.rest_seconds,
    })
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="max-w-xl text-sm text-evo-muted">
            Tu biblioteca personal. Cada ejercicio tiene un ID estable para medir progreso aunque cambies el
            nombre en una rutina.
          </p>
        </div>
        <Link to="/routines/new" className="text-sm font-semibold text-evo-accent">
          Usar en nueva rutina →
        </Link>
      </div>

      <form onSubmit={onSubmit} className="panel space-y-3 p-4">
        <p className="font-display text-lg font-bold">
          {editingId ? 'Editar ejercicio' : 'Añadir ejercicio'}
        </p>
        <Input
          label="Nombre"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Press banca, Dominadas…"
          error={error ?? undefined}
        />
        <Input
          label="Grupo muscular (opcional)"
          value={draft.target_muscle}
          onChange={(e) => setDraft((d) => ({ ...d, target_muscle: e.target.value }))}
          placeholder="Pecho, Pierna…"
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            label="Series"
            type="number"
            min={1}
            value={draft.default_sets}
            onChange={(e) => setDraft((d) => ({ ...d, default_sets: Number(e.target.value) }))}
          />
          <Input
            label="Reps"
            type="number"
            min={1}
            value={draft.default_reps}
            onChange={(e) => setDraft((d) => ({ ...d, default_reps: Number(e.target.value) }))}
          />
          <Input
            label="Descanso s"
            type="number"
            min={0}
            value={draft.rest_seconds}
            onChange={(e) => setDraft((d) => ({ ...d, rest_seconds: Number(e.target.value) }))}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending}>
            {editingId ? 'Guardar cambios' : 'Añadir al catálogo'}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingId(null)
                setDraft(emptyDraft())
                setError(null)
              }}
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>

      <div className="space-y-3">
        <Input
          label="Buscar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por nombre o músculo…"
        />

        {isLoading ? (
          <p className="text-sm text-evo-muted">Cargando catálogo…</p>
        ) : !filtered.length ? (
          <div className="panel border-dashed p-6 text-center">
            <p className="font-display text-xl font-bold">
              {data?.length ? 'Sin resultados' : 'Catálogo vacío'}
            </p>
            <p className="mt-2 text-sm text-evo-muted">
              {data?.length
                ? 'Prueba otra búsqueda.'
                : 'Añade tus ejercicios favoritos o créalos al montar una rutina.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-evo-border bg-evo-surface-2 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-evo-muted">
                    {item.target_muscle ? `${item.target_muscle} · ` : ''}
                    {item.default_sets}×{item.default_reps} · {item.rest_seconds}s
                  </p>
                </div>
                <div className="flex gap-2">
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
      </div>
    </div>
  )
}
