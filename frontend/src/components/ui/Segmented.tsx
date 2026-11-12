import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export type SegmentedOption<T extends string> = {
  id: T
  label: ReactNode
  /** Contador junto al texto; con `highlight` se pinta en naranja (algo pendiente). */
  count?: number
  highlight?: boolean
}

type Props<T extends string> = {
  /** Nombre del grupo para lectores de pantalla. */
  label: string
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<SegmentedOption<T>>
  className?: string
  /** Si los paneles tienen id `panel-<id>`, se enlazan con su pestaña. */
  controlsPanels?: boolean
}

/**
 * Selector de vistas de EvoFit: una pastilla naranja que se desliza hasta la opción elegida.
 * Pestañas accesibles: flechas para moverse, Inicio/Fin para ir a los extremos.
 */
export function Segmented<T extends string>({ label, value, onChange, options, className = '', controlsPanels = false }: Props<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const index = Math.max(0, options.findIndex((o) => o.id === value))

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = options.length - 1
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : -1
    if (next < 0) return
    event.preventDefault()
    onChange(options[next]!.id)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={['relative grid rounded-2xl bg-evo-surface-2 p-1', className].join(' ')}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-[0.75rem_0.3rem] bg-evo-accent shadow-[0_4px_14px_rgba(255,122,54,0.3)] transition-transform duration-300 ease-(--ease-evo)"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option, i) => {
        const active = i === index
        return (
          <button
            key={option.id}
            ref={(node) => {
              refs.current[i] = node
            }}
            type="button"
            role="tab"
            id={controlsPanels ? `tab-${option.id}` : undefined}
            aria-selected={active}
            aria-controls={controlsPanels ? `panel-${option.id}` : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.id)}
            className={[
              'relative z-10 flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-bold transition-colors duration-200',
              active ? 'text-[#1a120c]' : 'text-evo-muted',
            ].join(' ')}
          >
            <span className="truncate">{option.label}</span>
            {option.count ? (
              <span
                className={[
                  'shrink-0 rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                  active ? 'bg-[#1a120c]/15' : option.highlight ? 'bg-evo-accent text-[#1a120c]' : 'bg-evo-surface',
                ].join(' ')}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
