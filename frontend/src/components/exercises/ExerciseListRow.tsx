import type { ReactNode } from 'react'
import { ExerciseImage } from './ExerciseImage'

type Props = {
  name: string
  subtitle: string
  imageUrls: [string, string] | null | undefined
  onClick: () => void
  /** Lo que va a la derecha (flecha, check de selección, "Añadido"…). */
  trailing?: ReactNode
  selected?: boolean
  disabled?: boolean
  pressed?: boolean
}

/** Fila de ejercicio con foto: la misma en la biblioteca, en "Mis ejercicios" y en el selector. */
export function ExerciseListRow({ name, subtitle, imageUrls, onClick, trailing, selected, disabled, pressed }: Props) {
  return (
    <li className="border-b border-evo-border/40 last:border-b-0">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={pressed}
        className={[
          'flex min-h-[4.5rem] w-full items-center gap-3 px-3 py-2 text-left transition active:bg-evo-surface-2 disabled:opacity-50',
          selected ? 'bg-evo-accent/10' : '',
        ].join(' ')}
      >
        <ExerciseImage urls={imageUrls} name={name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{name}</span>
          <span className="block truncate text-sm text-evo-muted">{subtitle}</span>
        </span>
        {trailing}
      </button>
    </li>
  )
}
