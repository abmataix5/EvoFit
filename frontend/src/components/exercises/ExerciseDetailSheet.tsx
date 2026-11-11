import type { ReactNode } from 'react'
import type { LibraryExercise } from '../../lib/api'
import { MECHANIC_LABELS } from '../../lib/exerciseLibrary'
import { EQUIPMENT, muscleKeyLabel } from '../../lib/muscles'
import { exercisePlanLabel } from '../../lib/tracking'
import { Sheet } from '../ui/Sheet'
import { ExerciseImage } from './ExerciseImage'

type Props = {
  exercise: LibraryExercise
  onClose: () => void
  /** Botón principal (añadir, elegir…). */
  action?: ReactNode
}

/** Ficha de un ejercicio de la biblioteca: foto, músculos, material, pauta y técnica. */
export function ExerciseDetailSheet({ exercise, onClose, action }: Props) {
  return (
    <Sheet title={exercise.name} onClose={onClose} footer={action}>
      <div className="space-y-5">
        <ExerciseImage urls={exercise.image_urls} name={exercise.name} variant="hero" />

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-evo-accent/15 px-3 py-1.5 text-sm font-bold text-evo-accent">{exercise.muscle_label}</span>
          {exercise.secondary_muscles.map((muscle) => (
            <span key={muscle} className="rounded-full bg-evo-surface-2 px-3 py-1.5 text-sm font-semibold text-evo-muted">
              {muscleKeyLabel(muscle)}
            </span>
          ))}
        </div>

        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-evo-surface-2 px-3 py-2.5">
            <dt className="text-xs font-semibold text-evo-muted">Material</dt>
            <dd className="font-bold">{EQUIPMENT[exercise.equipment] ?? exercise.equipment}</dd>
          </div>
          <div className="rounded-2xl bg-evo-surface-2 px-3 py-2.5">
            <dt className="text-xs font-semibold text-evo-muted">Tipo</dt>
            <dd className="font-bold">{MECHANIC_LABELS[exercise.mechanic]}</dd>
          </div>
          <div className="col-span-2 rounded-2xl bg-evo-surface-2 px-3 py-2.5">
            <dt className="text-xs font-semibold text-evo-muted">Pauta recomendada</dt>
            <dd className="font-bold">{exercisePlanLabel(exercise)}</dd>
          </div>
        </dl>

        {exercise.cues.length > 0 ? (
          <section>
            <h3 className="mb-2 text-sm font-bold">Claves de técnica</h3>
            <ol className="space-y-2">
              {exercise.cues.map((cue, index) => (
                <li key={cue} className="flex gap-3 text-[0.95rem] leading-snug">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-evo-lime/20 text-xs font-bold text-evo-lime" aria-hidden>
                    {index + 1}
                  </span>
                  {cue}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </Sheet>
  )
}
