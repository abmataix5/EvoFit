import type { CatalogDraft } from '../../lib/catalog'
import { MUSCLE_GROUPS, normalizeText } from '../../lib/muscles'
import { formatDuration, isTimeMode } from '../../lib/tracking'
import { Input } from '../ui/Input'
import { Stepper } from '../ui/Stepper'
import { TrackingModePicker } from './TrackingModePicker'

type Props = {
  value: CatalogDraft
  onChange: (next: CatalogDraft) => void
  nameError?: string
  autoFocusName?: boolean
}

/** Campos de un ejercicio del catálogo: nombre, músculo, cómo se mide y valores por defecto. */
export function ExerciseForm({ value, onChange, nameError, autoFocusName }: Props) {
  const set = <K extends keyof CatalogDraft>(field: K, next: CatalogDraft[K]) => onChange({ ...value, [field]: next })
  const timed = isTimeMode(value.tracking_mode)
  const muscleKey = normalizeText(value.target_muscle)
  const customMuscle = muscleKey !== '' && !MUSCLE_GROUPS.some((m) => normalizeText(m) === muscleKey)

  return (
    <div className="space-y-5">
      <Input
        label="Nombre"
        value={value.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Press banca, dominadas…"
        maxLength={120}
        autoFocus={autoFocusName}
        error={nameError}
        required
      />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Grupo muscular</legend>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((muscle) => {
            const active = normalizeText(muscle) === muscleKey
            return (
              <button
                key={muscle}
                type="button"
                aria-pressed={active}
                onClick={() => set('target_muscle', active ? '' : muscle)}
                className={[
                  'min-h-10 rounded-full border-2 px-3.5 text-sm font-bold transition active:scale-95',
                  active ? 'border-evo-accent bg-evo-accent/15 text-evo-text' : 'border-evo-border bg-evo-surface-2 text-evo-muted',
                ].join(' ')}
              >
                {muscle}
              </button>
            )
          })}
        </div>
        {customMuscle ? (
          <p className="mt-2 text-xs text-evo-muted">
            Ahora mismo: <span className="font-semibold text-evo-text">{value.target_muscle}</span>
          </p>
        ) : null}
      </fieldset>

      <TrackingModePicker
        mode={value.tracking_mode}
        direction={value.time_direction}
        onMode={(mode) => set('tracking_mode', mode)}
        onDirection={(direction) => set('time_direction', direction)}
      />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Por defecto en las rutinas</legend>
        <div className="grid grid-cols-3 gap-2">
          <Stepper label="Series" value={value.default_sets} min={1} max={10} onChange={(n) => set('default_sets', n)} />
          {timed ? (
            <Stepper
              label="Objetivo"
              value={value.default_duration_seconds}
              min={5}
              max={3600}
              step={value.default_duration_seconds >= 120 ? 30 : 5}
              format={formatDuration}
              unit="min:seg"
              onChange={(n) => set('default_duration_seconds', n)}
            />
          ) : (
            <Stepper label="Reps" value={value.default_reps} min={1} max={50} onChange={(n) => set('default_reps', n)} />
          )}
          <Stepper
            label="Descanso"
            value={value.rest_seconds}
            min={0}
            max={600}
            step={15}
            format={formatDuration}
            unit="min:seg"
            onChange={(n) => set('rest_seconds', n)}
          />
        </div>
      </fieldset>
    </div>
  )
}
