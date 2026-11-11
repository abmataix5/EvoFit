import type { TimeDirection, TrackingMode } from '../../lib/tracking'

const modes: Array<{ id: TrackingMode; title: string; text: string }> = [
  { id: 'weight_reps', title: 'Kilos y reps', text: 'Fuerza' },
  { id: 'time', title: 'Tiempo', text: 'WOD, cardio' },
  { id: 'weight_time', title: 'Kilos y tiempo', text: 'Carga + crono' },
]

const directions: Array<{ id: TimeDirection; title: string; text: string }> = [
  { id: 'faster', title: 'Menos es mejor', text: 'For time, carreras' },
  { id: 'longer', title: 'Más es mejor', text: 'Plancha, aguante' },
]

type Props = {
  mode: TrackingMode
  direction: TimeDirection
  onMode: (mode: TrackingMode) => void
  onDirection: (direction: TimeDirection) => void
}

function Option({ selected, title, text, onClick }: { selected: boolean; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={[
        'min-h-16 min-w-0 rounded-2xl border-2 px-2.5 py-2.5 text-left transition active:scale-[0.98]',
        selected ? 'border-evo-accent bg-evo-accent/15' : 'border-evo-border bg-evo-surface-2 hover:border-evo-accent/50',
      ].join(' ')}
    >
      <span className="block text-sm font-bold leading-tight">{title}</span>
      <span className="mt-0.5 block truncate text-xs text-evo-muted">{text}</span>
    </button>
  )
}

export function TrackingModePicker({ mode, direction, onMode, onDirection }: Props) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-sm font-semibold text-evo-text">Cómo se mide</legend>
      <div role="radiogroup" aria-label="Cómo se mide" className="grid grid-cols-3 gap-2">
        {modes.map((item) => (
          <Option key={item.id} selected={mode === item.id} title={item.title} text={item.text} onClick={() => onMode(item.id)} />
        ))}
      </div>
      {mode !== 'weight_reps' ? (
        <div role="radiogroup" aria-label="Qué tiempo es mejor" className="grid grid-cols-2 gap-2">
          {directions.map((item) => (
            <Option
              key={item.id}
              selected={direction === item.id}
              title={item.title}
              text={item.text}
              onClick={() => onDirection(item.id)}
            />
          ))}
        </div>
      ) : null}
    </fieldset>
  )
}
