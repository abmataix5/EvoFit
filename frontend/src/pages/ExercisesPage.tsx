import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { ExerciseForm } from '../components/exercises/ExerciseForm'
import { Icon } from '../components/icons/Icon'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { api, apiErrorMessage, validationErrors, type CatalogExercise } from '../lib/api'
import { draftFromCatalog, emptyCatalogDraft, saveCatalogExercise, type CatalogDraft } from '../lib/catalog'
import { muscleLabel, normalizeText } from '../lib/muscles'
import { catalogExercisesQuery } from '../lib/queries'
import { exercisePlanLabel } from '../lib/tracking'

type Editing = { id?: number; draft: CatalogDraft }

export function ExercisesPage() {
  const queryClient = useQueryClient()
  const { confirm, notify } = useUiFeedback()
  const { data = [], isLoading } = useQuery(catalogExercisesQuery)
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [nameError, setNameError] = useState<string | undefined>()

  const term = normalizeText(search)
  const muscles = useMemo(
    () => [...new Set(data.map((item) => muscleLabel(item.target_muscle)))].sort((a, b) => a.localeCompare(b, 'es')),
    [data],
  )

  const groups = useMemo(() => {
    const map = new Map<string, CatalogExercise[]>()
    for (const item of data) {
      const key = muscleLabel(item.target_muscle)
      if (muscle && key !== muscle) continue
      if (term && !normalizeText(`${item.name} ${item.target_muscle ?? ''}`).includes(term)) continue
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === 'Sin grupo' ? 1 : b === 'Sin grupo' ? -1 : a.localeCompare(b, 'es'),
    )
  }, [data, muscle, term])

  const save = useMutation({
    mutationFn: ({ id, draft }: Editing) => saveCatalogExercise(draft, id),
    onSuccess: (_, { id }) => {
      notify(id ? 'Ejercicio actualizado' : 'Ejercicio añadido al catálogo', 'success')
      void queryClient.invalidateQueries({ queryKey: ['progress-insights'] })
      setEditing(null)
    },
    onError: (error) => {
      const message = validationErrors(error).name
      setNameError(message)
      if (!message) notify(apiErrorMessage(error, 'No se ha podido guardar el ejercicio.'), 'error')
    },
  })

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/catalog-exercises/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalog-exercises'] })
      notify('Ejercicio eliminado del catálogo', 'success')
      setEditing(null)
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido eliminar.'), 'error'),
  })

  function open(next: Editing) {
    setNameError(undefined)
    setEditing(next)
  }

  function submit() {
    if (!editing) return
    if (!editing.draft.name.trim()) {
      setNameError('Pon un nombre al ejercicio.')
      return
    }
    save.mutate(editing)
  }

  async function confirmDelete(id: number, name: string) {
    const ok = await confirm({
      title: `¿Eliminar «${name}»?`,
      message: 'Sale de tu catálogo. Las rutinas y las series que ya apuntaste se conservan.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (ok) remove.mutate(id)
  }

  const empty = !isLoading && data.length === 0

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="sr-only">Catálogo de ejercicios</h1>

      {empty ? (
        <section className="panel space-y-4 p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-evo-accent/15 text-evo-accent">
            <Icon name="catalog" className="h-7 w-7" />
          </span>
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-bold">Tu catálogo de ejercicios</h2>
            <p className="text-evo-muted">
              Guarda aquí tus ejercicios una vez y reutilízalos en todas tus rutinas. Así tu progreso se mide siempre igual.
            </p>
          </div>
          <Button size="lg" fullWidth onClick={() => open({ draft: emptyCatalogDraft() })}>
            Crear mi primer ejercicio
          </Button>
          <p className="text-xs text-evo-muted">También se añaden solos al crear una rutina.</p>
        </section>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-evo-muted">
              {isLoading ? 'Cargando…' : `${data.length} ${data.length === 1 ? 'ejercicio' : 'ejercicios'}`}
            </p>
            <Button className="!min-h-11" onClick={() => open({ draft: emptyCatalogDraft() })}>
              + Nuevo
            </Button>
          </div>

          <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 -mx-4 space-y-2 bg-evo-bg/90 px-4 pb-2 pt-1 backdrop-blur-xl lg:top-16">
            <label className="relative block">
              <span className="sr-only">Buscar en el catálogo</span>
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-evo-muted" />
              <input
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Buscar por nombre o músculo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="box-border w-full rounded-full border-2 border-evo-border bg-evo-surface-2 py-3 pl-11 pr-4 text-base text-evo-text placeholder:text-evo-muted/80 focus:border-evo-accent focus:outline-none"
              />
            </label>
            {muscles.length > 1 ? (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
                {[null, ...muscles].map((m) => (
                  <button
                    key={m ?? 'all'}
                    type="button"
                    aria-pressed={muscle === m}
                    onClick={() => setMuscle(m)}
                    className={[
                      'min-h-9 shrink-0 rounded-full px-3.5 text-sm font-bold transition',
                      muscle === m ? 'bg-evo-text text-evo-bg' : 'bg-evo-surface-2 text-evo-muted',
                    ].join(' ')}
                  >
                    {m ?? 'Todos'}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {groups.length === 0 && !isLoading ? (
            <div className="space-y-3 rounded-3xl bg-evo-surface px-4 py-6 text-center">
              <p className="text-evo-muted">Nada coincide con «{search.trim()}».</p>
              {search.trim() ? (
                <Button variant="secondary" onClick={() => open({ draft: emptyCatalogDraft(search.trim()) })}>
                  Crear «{search.trim()}»
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map(([label, items]) => (
                <section key={label}>
                  <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-xs font-semibold uppercase tracking-wide text-evo-muted">
                    {label}
                    <span className="tabular-nums">{items.length}</span>
                  </h2>
                  <ul className="overflow-hidden rounded-2xl border border-evo-border/60 bg-evo-surface">
                    {items.map((item) => (
                      <li key={item.id} className="border-b border-evo-border/40 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => open({ id: item.id, draft: draftFromCatalog(item) })}
                          className="flex min-h-15 w-full items-center gap-3 px-4 py-3 text-left transition active:bg-evo-surface-2"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">{item.name}</span>
                            <span className="block truncate text-sm text-evo-muted">
                              {exercisePlanLabel(item)}
                            </span>
                          </span>
                          <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {editing ? (
        <Sheet
          title={editing.id ? 'Editar ejercicio' : 'Nuevo ejercicio'}
          onClose={() => setEditing(null)}
          footer={
            <div className="flex gap-2">
              {editing.id ? (
                <Button
                  variant="danger"
                  size="lg"
                  disabled={remove.isPending}
                  onClick={() => void confirmDelete(editing.id!, editing.draft.name)}
                  aria-label="Eliminar ejercicio"
                >
                  Eliminar
                </Button>
              ) : null}
              <Button size="lg" fullWidth disabled={save.isPending} onClick={submit}>
                {save.isPending ? 'Guardando…' : editing.id ? 'Guardar cambios' : 'Añadir al catálogo'}
              </Button>
            </div>
          }
        >
          <ExerciseForm
            value={editing.draft}
            onChange={(draft) => setEditing((current) => (current ? { ...current, draft } : current))}
            nameError={nameError}
            autoFocusName={!editing.id}
          />
          {editing.id ? (
            <p className="mt-4 text-xs text-evo-muted">
              El nombre, el músculo y cómo se mide se actualizan también en las rutinas que lo usan.
            </p>
          ) : null}
        </Sheet>
      ) : null}
    </div>
  )
}
