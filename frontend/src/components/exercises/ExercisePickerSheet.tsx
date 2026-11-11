import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { apiErrorMessage, validationErrors, type CatalogExercise, type LibraryExercise } from '../../lib/api'
import { addFromLibrary, emptyCatalogDraft, saveCatalogExercise, type CatalogDraft } from '../../lib/catalog'
import { filterLibrary } from '../../lib/exerciseLibrary'
import { EQUIPMENT, MUSCLES, normalizeText } from '../../lib/muscles'
import { catalogExercisesQuery, libraryQuery } from '../../lib/queries'
import { exercisePlanLabel } from '../../lib/tracking'
import { useUiFeedback } from '../feedback/UiFeedback'
import { Icon } from '../icons/Icon'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import { ExerciseFilters } from './ExerciseFilters'
import { ExerciseForm } from './ExerciseForm'
import { ExerciseListRow } from './ExerciseListRow'

type Common = {
  title: string
  onClose: () => void
  busy?: boolean
}

type Props = Common &
  (
    | {
        /** Elegir de "Mis ejercicios" o de la biblioteca (que se añade a los tuyos al elegirlo). */
        source?: 'all'
        /** "single": tocar un ejercicio lo elige. "multiple": se marcan varios y se confirma. */
        mode: 'single' | 'multiple'
        onConfirm: (exercises: CatalogExercise[]) => void | Promise<void>
        /** Ejercicios de "Mis ejercicios" que ya están (se indica en la lista). */
        usedIds?: number[]
        confirmLabel?: (count: number) => string
        onConfirmLibrary?: never
      }
    | {
        /** Solo la biblioteca (p. ej. para vincular un ejercicio propio). */
        source: 'library'
        mode: 'single'
        onConfirmLibrary: (exercise: LibraryExercise) => void
        onConfirm?: never
        usedIds?: never
        confirmLabel?: never
      }
  )

type Pick = { kind: 'mine'; item: CatalogExercise } | { kind: 'library'; item: LibraryExercise }
const pickKey = (pick: Pick) => `${pick.kind}:${pick.item.id}`

const muscleKeyOfLabel = (label: string | null | undefined) =>
  MUSCLES.find((m) => normalizeText(m.label) === normalizeText(label))?.key ?? null

/** Buscar y elegir ejercicios: de los tuyos, de la biblioteca o uno nuevo. */
export function ExercisePickerSheet(props: Props) {
  const { title, onClose, busy } = props
  const libraryOnly = props.source === 'library'
  const { notify } = useUiFeedback()
  const library = useQuery(libraryQuery)
  const catalog = useQuery({ ...catalogExercisesQuery, enabled: !libraryOnly })
  const mine = useMemo(() => catalog.data ?? [], [catalog.data])
  const libraryItems = useMemo(() => library.data ?? [], [library.data])

  const [chosenTab, setTab] = useState<'mine' | 'library' | null>(null)
  const tab = libraryOnly ? 'library' : (chosenTab ?? (mine.length > 0 ? 'mine' : 'library'))
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [selected, setSelected] = useState<Pick[]>([])
  const [creating, setCreating] = useState<CatalogDraft | null>(null)
  const [working, setWorking] = useState(false)
  const [createError, setCreateError] = useState<string | undefined>()

  const mineByLibrary = useMemo(
    () => new Map(mine.filter((m) => m.exercise_id).map((m) => [m.exercise_id as number, m])),
    [mine],
  )
  const usedIds = props.usedIds ?? []

  const libraryResults = useMemo(
    () => filterLibrary(libraryItems, { term: search, muscle, equipment: null }),
    [libraryItems, search, muscle],
  )
  const mineResults = useMemo(() => {
    const term = normalizeText(search)
    return mine
      .filter((item) => !muscle || muscleKeyOfLabel(item.target_muscle) === muscle)
      .filter((item) => !term || normalizeText(`${item.name} ${item.target_muscle ?? ''}`).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [mine, muscle, search])
  const mineMuscles = useMemo(
    () => new Set(mine.map((m) => muscleKeyOfLabel(m.target_muscle)).filter((k): k is string => k !== null)),
    [mine],
  )

  const term = search.trim()
  const exactExists =
    mine.some((m) => normalizeText(m.name) === normalizeText(term)) ||
    libraryItems.some((l) => normalizeText(l.name) === normalizeText(term))

  /** Convierte lo elegido en ejercicios de "Mis ejercicios" (añadiendo los de la biblioteca). */
  async function toCatalog(picks: Pick[]): Promise<CatalogExercise[]> {
    const result: CatalogExercise[] = []
    for (const pick of picks) {
      if (pick.kind === 'mine') result.push(pick.item)
      else result.push(mineByLibrary.get(pick.item.id) ?? (await addFromLibrary(pick.item.id)))
    }
    return result
  }

  async function confirm(picks: Pick[]) {
    if (props.source === 'library') {
      const first = picks[0]
      if (first?.kind === 'library') props.onConfirmLibrary(first.item)
      return
    }
    setWorking(true)
    try {
      await props.onConfirm(await toCatalog(picks))
    } catch (error) {
      notify(apiErrorMessage(error, 'No se ha podido añadir el ejercicio.'), 'error')
    } finally {
      setWorking(false)
    }
  }

  function toggle(pick: Pick) {
    if (props.mode === 'single') {
      void confirm([pick])
      return
    }
    const key = pickKey(pick)
    setSelected((current) => (current.some((p) => pickKey(p) === key) ? current.filter((p) => pickKey(p) !== key) : [...current, pick]))
  }

  async function createExercise() {
    if (!creating) return
    if (!creating.name.trim()) {
      setCreateError('Pon un nombre al ejercicio.')
      return
    }
    setWorking(true)
    try {
      const created = await saveCatalogExercise(creating)
      setCreating(null)
      setSearch('')
      setCreateError(undefined)
      if (props.mode === 'single' && props.source !== 'library') await props.onConfirm([created])
      else setSelected((current) => [...current, { kind: 'mine', item: created }])
      setTab('mine')
    } catch (error) {
      setCreateError(validationErrors(error).name ?? apiErrorMessage(error, 'No se ha podido crear el ejercicio.'))
    } finally {
      setWorking(false)
    }
  }

  const disabled = busy || working

  if (creating) {
    return (
      <Sheet
        title="Nuevo ejercicio propio"
        onClose={onClose}
        onBack={() => setCreating(null)}
        footer={
          <Button size="lg" fullWidth disabled={disabled} onClick={() => void createExercise()}>
            {working ? 'Guardando…' : props.mode === 'single' ? 'Crear y elegir' : 'Crear y añadir'}
          </Button>
        }
      >
        <ExerciseForm value={creating} onChange={setCreating} nameError={createError} autoFocusName={!creating.name} />
        <p className="mt-4 text-xs text-evo-muted">Se guarda en «Mis ejercicios» para usarlo en cualquier rutina.</p>
      </Sheet>
    )
  }

  const isSelected = (pick: Pick) => selected.some((p) => pickKey(p) === pickKey(pick))
  const trailing = (pick: Pick) =>
    props.mode === 'multiple' ? (
      <span
        aria-hidden
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold',
          isSelected(pick) ? 'border-evo-accent bg-evo-accent text-[#1a120c]' : 'border-evo-border',
        ].join(' ')}
      >
        {isSelected(pick) ? '✓' : ''}
      </span>
    ) : (
      <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
    )

  const count = selected.length
  const loading = tab === 'library' ? library.isLoading : catalog.isLoading

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        props.mode === 'multiple' ? (
          <Button size="lg" fullWidth disabled={count === 0 || disabled} onClick={() => void confirm(selected)}>
            {working ? 'Añadiendo…' : props.confirmLabel ? props.confirmLabel(count) : count === 0 ? 'Elige ejercicios' : `Añadir ${count}`}
          </Button>
        ) : undefined
      }
    >
      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-evo-surface px-4 pb-3">
        {!libraryOnly ? (
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-evo-surface-2 p-1">
            {(
              [
                { id: 'mine', label: 'Mis ejercicios' },
                { id: 'library', label: 'Biblioteca' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => {
                  setTab(item.id)
                  setMuscle(null)
                }}
                className={[
                  'min-h-10 rounded-xl text-sm font-bold transition',
                  tab === item.id ? 'bg-evo-surface text-evo-text shadow' : 'text-evo-muted',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
        <ExerciseFilters
          search={search}
          onSearch={setSearch}
          muscle={muscle}
          onMuscle={setMuscle}
          availableMuscles={tab === 'mine' ? mineMuscles : undefined}
          placeholder={tab === 'library' ? 'Buscar en la biblioteca' : 'Buscar en tus ejercicios'}
        />
      </div>

      {term && !exactExists && !libraryOnly ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCreating(emptyCatalogDraft(term))}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-evo-accent/60 px-4 py-3 text-left font-bold text-evo-accent transition active:scale-[0.99]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-evo-accent/15 text-lg" aria-hidden>
            +
          </span>
          <span className="min-w-0 truncate">Crear «{term}» como propio</span>
        </button>
      ) : null}

      {loading ? (
        <p className="py-6 text-center text-sm text-evo-muted">Cargando…</p>
      ) : tab === 'mine' ? (
        mineResults.length === 0 ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-evo-muted">{mine.length === 0 ? 'Aún no tienes ejercicios guardados.' : 'Nada con ese nombre en tus ejercicios.'}</p>
            <Button variant="secondary" onClick={() => setTab('library')}>
              {term ? `Buscar «${term}» en la biblioteca` : 'Ver la biblioteca'}
            </Button>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-evo-border/60">
            {mineResults.map((item) => {
              const pick: Pick = { kind: 'mine', item }
              return (
                <ExerciseListRow
                  key={item.id}
                  name={item.name}
                  subtitle={`${usedIds.includes(item.id) ? 'Ya está · ' : ''}${exercisePlanLabel(item)}`}
                  imageUrls={item.image_urls}
                  onClick={() => toggle(pick)}
                  selected={isSelected(pick)}
                  pressed={props.mode === 'multiple' ? isSelected(pick) : undefined}
                  disabled={disabled}
                  trailing={trailing(pick)}
                />
              )
            })}
          </ul>
        )
      ) : libraryResults.length === 0 ? (
        <p className="py-6 text-center text-sm text-evo-muted">Nada con ese nombre en la biblioteca.</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-evo-border/60">
          {libraryResults.map((item) => {
            const pick: Pick = { kind: 'library', item }
            const own = mineByLibrary.get(item.id)
            return (
              <ExerciseListRow
                key={item.id}
                name={item.name}
                subtitle={`${own && usedIds.includes(own.id) ? 'Ya está · ' : own ? 'Tuyo · ' : ''}${item.muscle_label} · ${EQUIPMENT[item.equipment] ?? item.equipment}`}
                imageUrls={item.image_urls}
                onClick={() => toggle(pick)}
                selected={isSelected(pick)}
                pressed={props.mode === 'multiple' ? isSelected(pick) : undefined}
                disabled={disabled}
                trailing={trailing(pick)}
              />
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
