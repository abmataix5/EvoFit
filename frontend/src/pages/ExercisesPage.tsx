import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { ExerciseDetailSheet } from '../components/exercises/ExerciseDetailSheet'
import { ExerciseFilters } from '../components/exercises/ExerciseFilters'
import { ExerciseForm } from '../components/exercises/ExerciseForm'
import { ExerciseListRow } from '../components/exercises/ExerciseListRow'
import { ExercisePickerSheet } from '../components/exercises/ExercisePickerSheet'
import { Icon } from '../components/icons/Icon'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { api, apiErrorMessage, validationErrors, type CatalogExercise, type LibraryExercise } from '../lib/api'
import { addFromLibrary, draftFromCatalog, emptyCatalogDraft, linkToLibrary, saveCatalogExercise, type CatalogDraft } from '../lib/catalog'
import { filterLibrary } from '../lib/exerciseLibrary'
import { EQUIPMENT, MUSCLES, compareMuscleLabels, muscleLabel, normalizeText } from '../lib/muscles'
import { catalogExercisesQuery, libraryQuery } from '../lib/queries'
import { exercisePlanLabel } from '../lib/tracking'

type Tab = 'library' | 'mine'
type Editing = { id?: number; draft: CatalogDraft; libraryId?: number | null }

const muscleKeyOfLabel = (label: string | null | undefined) =>
  MUSCLES.find((m) => normalizeText(m.label) === normalizeText(label))?.key ?? null

export function ExercisesPage() {
  const queryClient = useQueryClient()
  const { confirm, notify } = useUiFeedback()
  const [params, setParams] = useSearchParams()
  const library = useQuery(libraryQuery)
  const catalog = useQuery(catalogExercisesQuery)
  const mine = useMemo(() => catalog.data ?? [], [catalog.data])
  const libraryItems = useMemo(() => library.data ?? [], [library.data])

  const tab: Tab = params.get('tab') === 'mine' ? 'mine' : 'library'
  const detailSlug = params.get('ex')
  const detail = libraryItems.find((item) => item.slug === detailSlug) ?? null

  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [nameError, setNameError] = useState<string | undefined>()
  const [linking, setLinking] = useState<CatalogExercise | null>(null)

  const mineByLibrary = useMemo(
    () => new Map(mine.filter((m) => m.exercise_id).map((m) => [m.exercise_id as number, m])),
    [mine],
  )

  function setParam(key: string, value: string | null) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: key !== 'ex' },
    )
  }

  function switchTab(next: Tab) {
    setSearch('')
    setMuscle(null)
    setEquipment(null)
    setParam('tab', next === 'library' ? null : 'mine')
  }

  // ── Biblioteca ──
  const libraryFiltered = useMemo(
    () => filterLibrary(libraryItems, { term: search, muscle, equipment }),
    [libraryItems, search, muscle, equipment],
  )
  const libraryGroups = useMemo(() => {
    if (search.trim() || muscle) return [{ label: null as string | null, items: libraryFiltered }]
    return MUSCLES.map((m) => ({ label: m.label as string | null, items: libraryFiltered.filter((i) => i.muscle === m.key) })).filter(
      (g) => g.items.length > 0,
    )
  }, [libraryFiltered, search, muscle])

  // ── Mis ejercicios ──
  const mineGroups = useMemo(() => {
    const term = normalizeText(search)
    const map = new Map<string, CatalogExercise[]>()
    for (const item of mine) {
      if (muscle && muscleKeyOfLabel(item.target_muscle) !== muscle) continue
      if (term && !normalizeText(`${item.name} ${item.target_muscle ?? ''}`).includes(term)) continue
      const key = muscleLabel(item.target_muscle)
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.entries()].sort(([a], [b]) => compareMuscleLabels(a, b))
  }, [mine, muscle, search])
  const mineMuscles = useMemo(
    () => new Set(mine.map((m) => muscleKeyOfLabel(m.target_muscle)).filter((k): k is string => k !== null)),
    [mine],
  )

  const add = useMutation({
    mutationFn: (exercise: LibraryExercise) => addFromLibrary(exercise.id),
    onSuccess: (_, exercise) => notify(`${exercise.name} añadido a tus ejercicios`, 'success'),
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido añadir.'), 'error'),
  })

  const save = useMutation({
    mutationFn: ({ id, draft }: Editing) => saveCatalogExercise(draft, id),
    onSuccess: (_, { id }) => {
      notify(id ? 'Ejercicio actualizado' : 'Ejercicio creado', 'success')
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
      notify('Quitado de tus ejercicios', 'success')
      setEditing(null)
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido quitar.'), 'error'),
  })

  const link = useMutation({
    mutationFn: ({ id, exerciseId }: { id: number; exerciseId: number | null }) => linkToLibrary(id, exerciseId),
    onSuccess: (_, { exerciseId }) => {
      notify(exerciseId ? 'Vinculado con la biblioteca' : 'Desvinculado de la biblioteca', 'success')
      setLinking(null)
      setEditing(null)
    },
    onError: (error) =>
      notify(validationErrors(error).exercise_id ?? apiErrorMessage(error, 'No se ha podido vincular.'), 'error'),
  })

  function openEditor(next: Editing) {
    setNameError(undefined)
    setEditing(next)
  }

  async function confirmRemove(id: number, name: string) {
    const ok = await confirm({
      title: `¿Quitar «${name}» de tus ejercicios?`,
      message: 'Las rutinas y las series que ya apuntaste se conservan.',
      confirmLabel: 'Quitar',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (ok) remove.mutate(id)
  }

  const loading = tab === 'library' ? library.isLoading : catalog.isLoading

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="sr-only">Ejercicios</h1>

      <div role="tablist" aria-label="Ejercicios" className="grid grid-cols-2 gap-1 rounded-2xl bg-evo-surface-2 p-1">
        {(
          [
            { id: 'library', label: 'Biblioteca', count: libraryItems.length },
            { id: 'mine', label: 'Mis ejercicios', count: mine.length },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => switchTab(item.id)}
            className={[
              'min-h-11 rounded-xl text-sm font-bold transition',
              tab === item.id ? 'bg-evo-surface text-evo-text shadow' : 'text-evo-muted',
            ].join(' ')}
          >
            {item.label}
            {item.count ? <span className="ml-1.5 font-semibold text-evo-muted tabular-nums">{item.count}</span> : null}
          </button>
        ))}
      </div>

      <p className="px-1 text-sm text-evo-muted">
        {tab === 'library'
          ? 'Todos los ejercicios de EvoFit, con foto y claves de técnica. Toca uno para verlo.'
          : 'Los que usas en tus rutinas, con tus series, repeticiones y descansos por defecto.'}
      </p>

      <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 -mx-4 bg-evo-bg/90 px-4 pb-2 pt-1 backdrop-blur-xl lg:top-16">
        <ExerciseFilters
          search={search}
          onSearch={setSearch}
          muscle={muscle}
          onMuscle={setMuscle}
          equipment={tab === 'library' ? equipment : undefined}
          onEquipment={tab === 'library' ? setEquipment : undefined}
          availableMuscles={tab === 'mine' ? mineMuscles : undefined}
          placeholder={tab === 'library' ? 'Buscar: press, sentadilla, polea…' : 'Buscar en tus ejercicios'}
        />
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-evo-muted">Cargando…</p>
      ) : tab === 'library' ? (
        libraryFiltered.length === 0 ? (
          <div className="space-y-3 rounded-3xl bg-evo-surface px-4 py-6 text-center">
            <p className="text-evo-muted">No hay ejercicios con esos filtros.</p>
            {search.trim() ? (
              <Button variant="secondary" onClick={() => openEditor({ draft: emptyCatalogDraft(search.trim()) })}>
                Crear «{search.trim()}» como propio
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            {libraryGroups.map((group) => (
              <section key={group.label ?? 'results'}>
                <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-xs font-semibold uppercase tracking-wide text-evo-muted">
                  {group.label ?? `${group.items.length} ejercicios`}
                  {group.label ? <span className="tabular-nums">{group.items.length}</span> : null}
                </h2>
                <ul className="overflow-hidden rounded-2xl border border-evo-border/60 bg-evo-surface">
                  {group.items.map((item) => (
                    <ExerciseListRow
                      key={item.id}
                      name={item.name}
                      subtitle={`${item.muscle_label} · ${EQUIPMENT[item.equipment] ?? item.equipment}`}
                      imageUrls={item.image_urls}
                      onClick={() => setParam('ex', item.slug)}
                      trailing={
                        mineByLibrary.has(item.id) ? (
                          <span className="shrink-0 rounded-full bg-evo-lime/15 px-2.5 py-1 text-xs font-bold text-evo-lime">✓ Tuyo</span>
                        ) : (
                          <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
                        )
                      }
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : mine.length === 0 ? (
        <section className="panel space-y-4 p-6 text-center">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-bold">Aún no tienes ejercicios</h2>
            <p className="text-evo-muted">
              Añádelos desde la biblioteca o al crear una rutina. Si haces algo que no está, créalo como propio.
            </p>
          </div>
          <Button size="lg" fullWidth onClick={() => switchTab('library')}>
            Explorar la biblioteca
          </Button>
          <Button variant="secondary" fullWidth onClick={() => openEditor({ draft: emptyCatalogDraft() })}>
            Crear ejercicio propio
          </Button>
        </section>
      ) : (
        <div className="space-y-5">
          <Button variant="secondary" fullWidth onClick={() => openEditor({ draft: emptyCatalogDraft(search.trim()) })}>
            + Crear ejercicio propio
          </Button>
          {mineGroups.length === 0 ? (
            <p className="rounded-3xl bg-evo-surface px-4 py-6 text-center text-evo-muted">Nada coincide con esa búsqueda.</p>
          ) : (
            mineGroups.map(([label, items]) => (
              <section key={label}>
                <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-xs font-semibold uppercase tracking-wide text-evo-muted">
                  {label}
                  <span className="tabular-nums">{items.length}</span>
                </h2>
                <ul className="overflow-hidden rounded-2xl border border-evo-border/60 bg-evo-surface">
                  {items.map((item) => (
                    <ExerciseListRow
                      key={item.id}
                      name={item.name}
                      subtitle={`${exercisePlanLabel(item)}${item.exercise_id ? '' : ' · propio'}`}
                      imageUrls={item.image_urls}
                      onClick={() => openEditor({ id: item.id, draft: draftFromCatalog(item), libraryId: item.exercise_id ?? null })}
                      trailing={<Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}

      {detail ? (
        <ExerciseDetailSheet
          exercise={detail}
          onClose={() => setParam('ex', null)}
          action={
            mineByLibrary.has(detail.id) ? (
              <p className="flex min-h-14 items-center justify-center gap-2 font-bold text-evo-lime">✓ Está en tus ejercicios</p>
            ) : (
              <Button size="lg" fullWidth disabled={add.isPending} onClick={() => add.mutate(detail)}>
                {add.isPending ? 'Añadiendo…' : '+ Añadir a mis ejercicios'}
              </Button>
            )
          }
        />
      ) : null}

      {editing ? (
        <Sheet
          title={editing.id ? 'Tu ejercicio' : 'Nuevo ejercicio propio'}
          onClose={() => setEditing(null)}
          footer={
            <div className="flex gap-2">
              {editing.id ? (
                <Button variant="danger" size="lg" disabled={remove.isPending} onClick={() => void confirmRemove(editing.id!, editing.draft.name)}>
                  Quitar
                </Button>
              ) : null}
              <Button
                size="lg"
                fullWidth
                disabled={save.isPending}
                onClick={() => {
                  if (!editing.draft.name.trim()) {
                    setNameError('Pon un nombre al ejercicio.')
                    return
                  }
                  save.mutate(editing)
                }}
              >
                {save.isPending ? 'Guardando…' : editing.id ? 'Guardar cambios' : 'Crear ejercicio'}
              </Button>
            </div>
          }
        >
          {editing.id ? (
            <LibraryLinkBox
              linked={libraryItems.find((item) => item.id === editing.libraryId) ?? null}
              busy={link.isPending}
              onShow={(item) => {
                setEditing(null)
                setParam('ex', item.slug)
              }}
              onLink={() => {
                const entry = mine.find((m) => m.id === editing.id)
                if (entry) setLinking(entry)
              }}
              onUnlink={() => link.mutate({ id: editing.id!, exerciseId: null })}
            />
          ) : null}
          <ExerciseForm
            value={editing.draft}
            onChange={(draft) => setEditing((current) => (current ? { ...current, draft } : current))}
            nameError={nameError}
            autoFocusName={!editing.id}
          />
        </Sheet>
      ) : null}

      {linking ? (
        <ExercisePickerSheet
          title={`Vincular «${linking.name}»`}
          mode="single"
          source="library"
          busy={link.isPending}
          onClose={() => setLinking(null)}
          onConfirmLibrary={(item) => link.mutate({ id: linking.id, exerciseId: item.id })}
        />
      ) : null}
    </div>
  )
}

/** En "Tu ejercicio": de qué ejercicio de la biblioteca es, o la opción de vincularlo. */
function LibraryLinkBox({
  linked,
  busy,
  onShow,
  onLink,
  onUnlink,
}: {
  linked: LibraryExercise | null
  busy: boolean
  onShow: (item: LibraryExercise) => void
  onLink: () => void
  onUnlink: () => void
}) {
  if (linked) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-evo-surface-2 p-3">
        <button type="button" onClick={() => onShow(linked)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {linked.image_urls ? <img src={linked.image_urls[0]} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-white object-cover" /> : null}
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-evo-muted">De la biblioteca</span>
            <span className="block truncate font-bold">{linked.name}</span>
            <span className="block text-xs font-bold text-evo-accent">Ver técnica →</span>
          </span>
        </button>
        <button type="button" disabled={busy} onClick={onUnlink} className="shrink-0 rounded-xl px-2 py-2 text-xs font-bold text-evo-muted hover:text-evo-text">
          Desvincular
        </button>
      </div>
    )
  }

  return (
    <div className="mb-5 rounded-2xl border-2 border-dashed border-evo-border p-3">
      <p className="font-bold">Ejercicio propio</p>
      <p className="mt-0.5 text-sm text-evo-muted">
        Si es uno de la biblioteca, vincúlalo: verás su foto y técnica, y contará para comparativas y rankings.
      </p>
      <Button variant="secondary" fullWidth className="mt-3" disabled={busy} onClick={onLink}>
        Vincular con la biblioteca
      </Button>
    </div>
  )
}
