import type { TimeDirection, TrackingMode } from '../../lib/tracking'

const modes: Array<{ id: TrackingMode; title: string; text: string }> = [
  { id: 'weight_reps', title: 'Kilos y reps', text: 'Fuerza clásica' },
  { id: 'time', title: 'Solo tiempo', text: 'WOD y for time' },
  { id: 'weight_time', title: 'Tiempo y kilos', text: 'Carga con cronómetro' },
]

type Props = {
  mode: TrackingMode
  direction: TimeDirection
  onMode: (mode: TrackingMode) => void
  onDirection: (direction: TimeDirection) => void
}

export function TrackingModePicker({ mode, direction, onMode, onDirection }: Props) {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-semibold text-evo-text">Cómo se mide</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {modes.map((item) => {
          const selected = mode === item.id
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onMode(item.id)}
              className={[
                'min-h-16 rounded-2xl border-2 px-3 py-3 text-left transition',
                selected
                  ? 'border-evo-accent bg-evo-accent/15'
                  : 'border-evo-border bg-evo-surface-2 hover:border-evo-accent/50',
              ].join(' ')}
            >
              <span className="block text-base font-bold">{item.title}</span>
              <span className="mt-0.5 block text-sm text-evo-muted">{item.text}</span>
            </button>
          )
        })}
      </div>
      {mode !== 'weight_reps' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={direction === 'faster'}
            onClick={() => onDirection('faster')}
            className={[
              'min-h-14 rounded-2xl border-2 px-3 py-3 text-left',
              direction === 'faster'
                ? 'border-evo-accent bg-evo-accent/15'
                : 'border-evo-border bg-evo-surface-2',
            ].join(' ')}
          >
            <span className="block text-base font-bold">Menos tiempo es mejor</span>
            <span className="mt-0.5 block text-sm text-evo-muted">For time, WOD, carreras</span>
          </button>
          <button
            type="button"
            aria-pressed={direction === 'longer'}
            onClick={() => onDirection('longer')}
            className={[
              'min-h-14 rounded-2xl border-2 px-3 py-3 text-left',
              direction === 'longer'
                ? 'border-evo-accent bg-evo-accent/15'
                : 'border-evo-border bg-evo-surface-2',
            ].join(' ')}
          >
            <span className="block text-base font-bold">Más tiempo es mejor</span>
            <span className="mt-0.5 block text-sm text-evo-muted">Plancha, aguante, isométricos</span>
          </button>
        </div>
      ) : null}
    </fieldset>
  )
}
