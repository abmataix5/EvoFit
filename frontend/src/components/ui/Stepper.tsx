import { useId } from 'react'

type Props = {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Cómo se muestra el valor (p. ej. 90 → "1:30"). */
  format?: (value: number) => string
  /** Unidad pequeña bajo el número. */
  unit?: string
}

/** Número con botones − / + grandes: más rápido y fiable que un input numérico en el móvil. */
export function Stepper({ label, value, onChange, min = 0, max = 999, step = 1, format, unit }: Props) {
  const id = useId()
  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  return (
    <div role="group" aria-labelledby={id} className="min-w-0">
      <p id={id} className="mb-1 text-center text-xs font-semibold text-evo-muted">
        {label}
      </p>
      <div className="flex items-center rounded-2xl border-2 border-evo-border bg-evo-surface-2">
        <button
          type="button"
          aria-label={`Menos ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}
          className="flex h-11 w-8 shrink-0 items-center justify-center text-xl font-bold text-evo-muted transition active:scale-90 disabled:opacity-30"
        >
          −
        </button>
        <output aria-live="polite" className="min-w-0 flex-1 overflow-hidden text-center leading-tight">
          <span className="block whitespace-nowrap text-[0.95rem] font-bold tabular-nums">{format ? format(value) : value}</span>
          {unit ? <span className="block text-[0.65rem] font-semibold text-evo-muted">{unit}</span> : null}
        </output>
        <button
          type="button"
          aria-label={`Más ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}
          className="flex h-11 w-8 shrink-0 items-center justify-center text-xl font-bold text-evo-muted transition active:scale-90 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  )
}
