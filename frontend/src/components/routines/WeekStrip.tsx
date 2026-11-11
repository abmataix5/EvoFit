import { WEEKDAY_LABELS } from '../../lib/api'

const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Semana de lunes a domingo con los días de entreno resaltados. */
export function WeekStrip({ weekdays, size = 'md' }: { weekdays: Array<number | null | undefined>; size?: 'sm' | 'md' }) {
  const on = new Set(weekdays)
  const label = WEEKDAY_LABELS.filter((_, index) => on.has(index + 1)).join(', ')

  return (
    <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={label ? `Entrena: ${label}` : 'Sin días fijos'}>
      {LETTERS.map((letter, index) => (
        <span
          key={letter}
          aria-hidden
          className={[
            'flex items-center justify-center rounded-full font-bold',
            size === 'sm' ? 'h-7 text-xs' : 'h-9 text-sm',
            on.has(index + 1) ? 'bg-evo-accent text-[#1a120c]' : 'bg-evo-surface-2 text-evo-muted/70',
          ].join(' ')}
        >
          {letter}
        </span>
      ))}
    </div>
  )
}
