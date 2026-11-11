import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { apiErrorMessage, validationErrors, type CatalogExercise } from '../../lib/api'
import { emptyCatalogDraft, saveCatalogExercise, type CatalogDraft } from '../../lib/catalog'
import { muscleLabel, normalizeText } from '../../lib/muscles'
import { catalogExercisesQuery } from '../../lib/queries'
import { exercisePlanLabel } from '../../lib/tracking'
import { Icon } from '../icons/Icon'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import { ExerciseForm } from './ExerciseForm'

type Props = {
  title: string
  onClose: () => void
  /** "single": tocar un ejercicio lo elige. "multiple": se marcan varios y se confirma. */
  mode: 'single' | 'multiple'
  onConfirm: (exercises: CatalogExercise[]) => void | Promise<void>
  /** Ejercicios del catálogo que ya están (se marcan como tal). */
  usedIds?: number[]
  confirmLabel?: (count: number) => string
  busy?: boolean
}

/** Buscar en el catálogo (o crear uno nuevo) y elegir ejercicios. */
export function ExercisePickerSheet({ title, onClose, mode, onConfirm, usedIds = [], confirmLabel, busy }: Props) {
  const { data: catalog = [], isLoading } = useQuery(catalogExercisesQuery)
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [selected, setSelected] = useState<CatalogExercise[]>([])
  const [creating, setCreating] = useState<CatalogDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | undefined>()

  const term = normalizeText(search)
  const muscles = useMemo(
    () => [...new Set(catalog.map((item) => muscleLabel(item.target_muscle)))].sort((a, b) => a.localeCompare(b, 'es')),
    [catalog],
  )

  const visible = useMemo(
    () =>
      catalog.filter((item) => {
        if (muscle && muscleLabel(item.target_muscle) !== muscle) return false
        if (!term) return true
        return normalizeText(`${item.name} ${item.target_muscle ?? ''}`).includes(term)
      }),
    [catalog, muscle, term],
  )

  // Sin buscar, agrupado por músculo; buscando, lista plana por relevancia (empieza por… primero).
  const groups = useMemo(() => {
    if (term) {
      const sorted = [...visible].sort(
        (a, b) => Number(!normalizeText(a.name).startsWith(term)) - Number(!normalizeText(b.name).startsWith(term)),
      )
      return [{ label: null as string | null, items: sorted }]
    }
    const map = new Map<string, CatalogExercise[]>()
    for (const item of visible) {
      const key = muscleLabel(item.target_muscle)
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === 'Sin grupo' ? 1 : b === 'Sin grupo' ? -1 : a.localeCompare(b, 'es')))
      .map(([label, items]) => ({ label: label as string | null, items }))
  }, [visible, term])

  const exact = catalog.some((item) => normalizeText(item.name) === term)

  function toggle(item: CatalogExercise) {
    if (mode === 'single') {
      void onConfirm([item])
      return
    }
    setSelected((current) => (current.some((s) => s.id === item.id) ? current.filter((s) => s.id !== item.id) : [...current, item]))
  }

  async function createExercise() {
    if (!creating) return
    if (!creating.name.trim()) {
      setCreateError('Pon un nombre al ejercicio.')
      return
    }
    setSaving(true)
    try {
      const created = await saveCatalogExercise(creating)
      setCreating(null)
      setSearch('')
      setCreateError(undefined)
      if (mode === 'single') await onConfirm([created])
      else setSelected((current) => [...current, created])
    } catch (error) {
      setCreateError(validationErrors(error).name ?? apiErrorMessage(error, 'No se ha podido crear el ejercicio.'))
    } finally {
      setSaving(false)
    }
  }

  if (creating) {
    return (
      <Sheet
        title="Nuevo ejercicio"
        onClose={onClose}
        onBack={() => setCreating(null)}
        footer={
          <Button size="lg" fullWidth disabled={saving} onClick={() => void createExercise()}>
            {saving ? 'Guardando…' : mode === 'single' ? 'Crear y elegir' : 'Crear y añadir'}
          </Button>
        }
      >
        <ExerciseForm value={creating} onChange={setCreating} nameError={createError} autoFocusName={!creating.name} />
        <p className="mt-4 text-xs text-evo-muted">Se guarda en tu catálogo para usarlo en cualquier rutina.</p>
      </Sheet>
    )
  }

  const count = selected.length

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        mode === 'multiple' ? (
          <Button size="lg" fullWidth disabled={count === 0 || busy} onClick={() => void onConfirm(selected)}>
            {confirmLabel ? confirmLabel(count) : count === 0 ? 'Elige ejercicios' : `Añadir ${count}`}
          </Button>
        ) : undefined
      }
    >
      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-evo-surface px-4 pb-3">
        <label className="relative block">
          <span className="sr-only">Buscar ejercicio</span>
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-evo-muted" />
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Buscar o crear ejercicio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="box-border w-full rounded-full border-2 border-evo-border bg-evo-surface-2 py-3 pl-11 pr-4 text-base text-evo-text placeholder:text-evo-muted/80 focus:border-evo-accent focus:outline-none"
          />
        </label>
        {muscles.length > 1 ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
            {[null, ...muscles].map((m) => {
              const active = muscle === m
              return (
                <button
                  key={m ?? 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMuscle(m)}
                  className={[
                    'min-h-9 shrink-0 rounded-full px-3.5 text-sm font-bold transition',
                    active ? 'bg-evo-text text-evo-bg' : 'bg-evo-surface-2 text-evo-muted',
                  ].join(' ')}
                >
                  {m ?? 'Todos'}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {term && !exact ? (
        <button
          type="button"
          onClick={() => setCreating(emptyCatalogDraft(search.trim()))}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-evo-accent/60 px-4 py-3 text-left font-bold text-evo-accent transition active:scale-[0.99]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-evo-accent/15 text-lg" aria-hidden>
            +
          </span>
          <span className="min-w-0 truncate">Crear «{search.trim()}»</span>
        </button>
      ) : null}

      {isLoading ? (
        <p className="py-6 text-center text-sm text-evo-muted">Cargando tu catálogo…</p>
      ) : catalog.length === 0 ? (
        <div className="space-y-3 py-6 text-center">
          <p className="font-bold">Tu catálogo está vacío</p>
          <p className="text-sm text-evo-muted">Escribe el nombre arriba o crea tu primer ejercicio.</p>
          <Button variant="secondary" onClick={() => setCreating(emptyCatalogDraft(search.trim()))}>
            Crear ejercicio
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-evo-muted">Nada con ese nombre en tu catálogo.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.label ?? 'results'}>
              {group.label ? (
                <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-evo-muted">{group.label}</h3>
              ) : null}
              <ul className="overflow-hidden rounded-2xl border border-evo-border/60">
                {group.items.map((item) => {
                  const isSelected = selected.some((s) => s.id === item.id)
                  const used = usedIds.includes(item.id)
                  return (
                    <li key={item.id} className="border-b border-evo-border/40 last:border-b-0">
                      <button
                        type="button"
                        aria-pressed={mode === 'multiple' ? isSelected : undefined}
                        disabled={busy}
                        onClick={() => toggle(item)}
                        className={[
                          'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition active:bg-evo-surface-2',
                          isSelected ? 'bg-evo-accent/10' : '',
                        ].join(' ')}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{item.name}</span>
                          <span className="block truncate text-sm text-evo-muted">
                            {used ? 'Ya está · ' : ''}
                            {exercisePlanLabel(item)}
                          </span>
                        </span>
                        {mode === 'multiple' ? (
                          <span
                            aria-hidden
                            className={[
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold',
                              isSelected ? 'border-evo-accent bg-evo-accent text-[#1a120c]' : 'border-evo-border',
                            ].join(' ')}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                        ) : (
                          <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  )
}
