import { useMemo, useState } from 'react'
import type { CatalogExercise } from '../../lib/api'
import { modeLabel, type TimeDirection, type TrackingMode } from '../../lib/tracking'
import { Input } from '../ui/Input'

type Props = {
  label: string
  name: string
  catalogId: number | null
  catalog: CatalogExercise[]
  onChange: (next: {
    name: string
    catalog_exercise_id: number | null
    tracking_mode?: TrackingMode
    time_direction?: TimeDirection
    default_sets?: number
    default_reps?: number
    default_duration_seconds?: number | null
    rest_seconds?: number
  }) => void
}

export function ExerciseCatalogPicker({ label, name, catalogId, catalog, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const query = name.trim().toLowerCase()

  const suggestions = useMemo(() => {
    if (!query) return catalog.slice(0, 8)
    return catalog
      .filter((item) => item.name.toLowerCase().includes(query))
      .slice(0, 8)
  }, [catalog, query])

  const exactMatch = catalog.find((item) => item.name.toLowerCase() === query)

  return (
    <div className="relative">
      <Input
        label={label}
        value={name}
        autoComplete="off"
        placeholder="Escribe o elige de tu catálogo…"
        hint={
          catalogId
            ? 'Vinculado a tu catálogo'
            : name.trim()
              ? 'Se añadirá al catálogo al guardar la rutina'
              : 'Usa tu catálogo para medir progreso con precisión'
        }
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so click on suggestion registers.
          window.setTimeout(() => setOpen(false), 120)
        }}
        onChange={(e) => {
          const value = e.target.value
          const match = catalog.find((item) => item.name.toLowerCase() === value.trim().toLowerCase())
          onChange({
            name: value,
            catalog_exercise_id: match?.id ?? null,
            ...(match
              ? {
                  tracking_mode: match.tracking_mode ?? 'weight_reps',
                  time_direction: match.time_direction ?? 'faster',
                  default_sets: match.default_sets,
                  default_reps: match.default_reps,
                  default_duration_seconds: match.default_duration_seconds ?? null,
                  rest_seconds: match.rest_seconds,
                }
              : {}),
          })
          setOpen(true)
        }}
      />

      {open && (suggestions.length > 0 || (query && !exactMatch)) ? (
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-evo-border bg-evo-surface shadow-lg">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-evo-surface-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({
                    name: item.name,
                    catalog_exercise_id: item.id,
                    tracking_mode: item.tracking_mode ?? 'weight_reps',
                    time_direction: item.time_direction ?? 'faster',
                    default_sets: item.default_sets,
                    default_reps: item.default_reps,
                    default_duration_seconds: item.default_duration_seconds ?? null,
                    rest_seconds: item.rest_seconds,
                  })
                  setOpen(false)
                }}
              >
                <span className="font-semibold">{item.name}</span>
                <span className="text-xs text-evo-muted">
                  {modeLabel(item.tracking_mode ?? 'weight_reps')}
                  {item.target_muscle ? ` · ${item.target_muscle}` : ''}
                </span>
              </button>
            </li>
          ))}
          {query && !exactMatch ? (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-sm font-semibold text-evo-accent hover:bg-evo-surface-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ name: name.trim(), catalog_exercise_id: null })
                  setOpen(false)
                }}
              >
                + Crear “{name.trim()}” en catálogo
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
