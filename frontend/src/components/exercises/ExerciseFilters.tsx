import { EQUIPMENT_FILTERS, MUSCLES } from '../../lib/muscles'
import { Icon } from '../icons/Icon'

type Props = {
  search: string
  onSearch: (value: string) => void
  muscle: string | null
  onMuscle: (value: string | null) => void
  /** Sin onEquipment no se muestra el filtro de material. */
  equipment?: string | null
  onEquipment?: (value: string | null) => void
  /** Solo se ofrecen los músculos que tienen ejercicios. */
  availableMuscles?: Set<string>
  placeholder?: string
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'min-h-9 shrink-0 rounded-full px-3.5 text-sm font-bold transition',
        active ? 'bg-evo-text text-evo-bg' : 'bg-evo-surface-2 text-evo-muted hover:text-evo-text',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** Buscador + filtros por músculo y material (filas que se desplazan en horizontal). */
export function ExerciseFilters({
  search,
  onSearch,
  muscle,
  onMuscle,
  equipment = null,
  onEquipment,
  availableMuscles,
  placeholder = 'Buscar ejercicio',
}: Props) {
  const muscles = availableMuscles ? MUSCLES.filter((m) => availableMuscles.has(m.key)) : MUSCLES

  return (
    <div className="space-y-2">
      <label className="relative block">
        <span className="sr-only">{placeholder}</span>
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-evo-muted" />
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="box-border w-full rounded-full border-2 border-evo-border bg-evo-surface-2 py-3 pl-11 pr-4 text-base text-evo-text placeholder:text-evo-muted/80 focus:border-evo-accent focus:outline-none"
        />
      </label>
      <div role="group" aria-label="Filtrar por músculo" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <Chip active={muscle === null} onClick={() => onMuscle(null)}>
          Todos
        </Chip>
        {muscles.map((m) => (
          <Chip key={m.key} active={muscle === m.key} onClick={() => onMuscle(muscle === m.key ? null : m.key)}>
            {m.label}
          </Chip>
        ))}
      </div>
      {onEquipment ? (
        <div role="group" aria-label="Filtrar por material" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {EQUIPMENT_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={equipment === f.id}
              onClick={() => onEquipment(equipment === f.id ? null : f.id)}
              className={[
                'min-h-8 shrink-0 rounded-full border px-3 text-xs font-bold transition',
                equipment === f.id ? 'border-evo-accent bg-evo-accent/15 text-evo-text' : 'border-evo-border text-evo-muted',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
