import { useState } from 'react'
import { Button } from '../ui/Button'

export type CopyDayOption = {
  id: string | number
  label: string
  sublabel?: string
}

type Props = {
  sourceLabel: string
  options: CopyDayOption[]
  disabled?: boolean
  busy?: boolean
  onCopy: (targetIds: Array<string | number>) => void | Promise<void>
}

/** Selector compacto: cerrado por defecto, se abre al tocar “Duplicar…”. */
export function CopyDayPicker({ sourceLabel, options, disabled, busy, onCopy }: Props) {
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<Array<string | number>>([])
  const [doneMsg, setDoneMsg] = useState<string | null>(null)

  if (options.length === 0) return null

  function toggle(id: string | number) {
    setTargets((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
    setDoneMsg(null)
  }

  async function apply() {
    if (targets.length === 0) return
    await onCopy(targets)
    const names = options
      .filter((o) => targets.includes(o.id))
      .map((o) => o.label)
      .join(', ')
    setDoneMsg(`Copiado a ${names}`)
    setTargets([])
    setOpen(false)
  }

  return (
    <div className="rounded-2xl border border-evo-border bg-evo-surface-2/80 p-3">
      {!open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(true)
            setDoneMsg(null)
          }}
          className="flex w-full items-center justify-between gap-2 text-left disabled:opacity-45"
        >
          <div>
            <p className="text-sm font-bold">Duplicar este día</p>
            <p className="text-xs text-evo-muted">
              Pega los ejercicios de <span className="font-semibold text-evo-text">{sourceLabel}</span> en
              otro día
            </p>
          </div>
          <span className="shrink-0 rounded-xl bg-evo-accent/15 px-3 py-2 text-xs font-bold text-evo-accent">
            Copiar →
          </span>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold">¿A qué días lo pegas?</p>
              <p className="text-xs text-evo-muted">
                Sustituye los ejercicios del destino. Ideal para repetir D1 en D5.
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-bold text-evo-muted"
              onClick={() => {
                setOpen(false)
                setTargets([])
              }}
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {options.map((option) => {
              const selected = targets.includes(option.id)
              return (
                <button
                  key={String(option.id)}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className={[
                    'rounded-xl border-2 px-3 py-2.5 text-left transition',
                    selected
                      ? 'border-evo-lime bg-evo-lime/15'
                      : 'border-evo-border bg-evo-bg hover:border-evo-accent/50',
                  ].join(' ')}
                >
                  <span className="block text-sm font-bold">{option.label}</span>
                  {option.sublabel ? (
                    <span className="block truncate text-[0.65rem] text-evo-muted">{option.sublabel}</span>
                  ) : null}
                  {selected ? (
                    <span className="mt-1 block text-[0.65rem] font-bold text-evo-lime">Seleccionado</span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <Button
            type="button"
            fullWidth
            disabled={targets.length === 0 || busy}
            onClick={() => void apply()}
          >
            {busy
              ? 'Copiando…'
              : targets.length === 0
                ? 'Elige al menos un día'
                : `Pegar en ${targets.length} día${targets.length > 1 ? 's' : ''}`}
          </Button>
        </div>
      )}

      {doneMsg ? (
        <p className="mt-2 text-xs font-semibold text-evo-lime" role="status">
          ✓ {doneMsg}
        </p>
      ) : null}
    </div>
  )
}
