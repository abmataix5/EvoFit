import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/icons/Icon'
import { BARS, formatPlateKg, loadPlates, roundTo, warmupSets } from './plates'

const BAR_KEY = 'evofit:bar-kg'

/** Colores de competición (IWF) para reconocer cada disco de un vistazo. */
const PLATE_STYLE: Record<number, { bg: string; fg: string; h: number }> = {
  25: { bg: '#d6303a', fg: '#fff', h: 100 },
  20: { bg: '#2563eb', fg: '#fff', h: 100 },
  15: { bg: '#eab308', fg: '#1a1400', h: 88 },
  10: { bg: '#16a34a', fg: '#fff', h: 76 },
  5: { bg: '#f1f5f9', fg: '#111', h: 60 },
  2.5: { bg: '#334155', fg: '#fff', h: 48 },
  1.25: { bg: '#94a3b8', fg: '#111', h: 40 },
}

function readBar(): number {
  try {
    const value = Number(localStorage.getItem(BAR_KEY))
    return BARS.some((bar) => bar.kg === value) && localStorage.getItem(BAR_KEY) !== null ? value : 20
  } catch {
    return 20
  }
}

function PlateStack({ plates, compact }: { plates: number[]; compact?: boolean }) {
  const height = compact ? 36 : 96
  return (
    <div className="flex items-center" aria-hidden style={{ height }}>
      <span className="h-2.5 w-6 rounded-l-sm bg-evo-muted/60" />
      <span className="h-5 w-1.5 rounded-sm bg-evo-muted" />
      {plates.map((plate, index) => {
        const style = PLATE_STYLE[plate] ?? { bg: '#888', fg: '#fff', h: 50 }
        return (
          <span
            key={`${plate}-${index}`}
            className="ml-[2px] flex items-center justify-center rounded-[3px] text-[0.6rem] font-bold leading-none ring-1 ring-black/20"
            style={{
              background: style.bg,
              color: style.fg,
              height: `${style.h}%`,
              width: compact ? 7 : plate >= 10 ? 18 : 13,
            }}
          >
            {!compact && plate >= 5 ? <span className="-rotate-90">{formatPlateKg(plate)}</span> : null}
          </span>
        )
      })}
      <span className="ml-[2px] h-2.5 w-4 rounded-r-sm bg-evo-muted/60" />
    </div>
  )
}

/**
 * Calculadora de discos y series de calentamiento para un peso objetivo.
 */
export function PlatesSheet({
  exerciseName,
  initialWeight,
  onClose,
}: {
  exerciseName: string
  initialWeight: number | null
  onClose: () => void
}) {
  const [bar, setBar] = useState<number>(readBar)
  const [text, setText] = useState(() => (initialWeight != null && initialWeight > 0 ? formatPlateKg(initialWeight) : ''))
  const closeRef = useRef(onClose)
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true })
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [])

  const target = Number(text.replace(',', '.'))
  const valid = text.trim() !== '' && Number.isFinite(target) && target > 0 && target <= 600
  const load = valid ? loadPlates(target, bar) : null
  const warmups = valid ? warmupSets(target, bar) : []
  const belowBar = valid && bar > 0 && target < bar

  function chooseBar(kg: number) {
    setBar(kg)
    try {
      localStorage.setItem(BAR_KEY, String(kg))
    } catch {
      // sin almacenamiento: vale para esta vez
    }
  }

  function step(delta: number) {
    const base = valid ? target : bar || 0
    const next = Math.max(0, roundTo(base + delta))
    setText(formatPlateKg(next))
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plates-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="safe-bottom max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-2 border-evo-border bg-evo-surface p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-evo-border sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-evo-accent">Discos y calentamiento</p>
            <h2 id="plates-title" className="truncate font-display text-xl font-bold">
              {exerciseName}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-evo-muted hover:bg-evo-surface-2 hover:text-evo-text"
          >
            <Icon name="close" />
          </button>
        </div>

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-evo-muted" htmlFor="plates-target">
          Peso objetivo
        </label>
        <div className="mt-1 grid grid-cols-[3.25rem_1fr_3.25rem] gap-2">
          <button
            type="button"
            aria-label="Restar 2,5 kg"
            onClick={() => step(-2.5)}
            className="h-14 rounded-2xl bg-evo-surface-2 text-xl font-bold"
          >
            −
          </button>
          <div className="relative">
            <input
              id="plates-target"
              inputMode="decimal"
              value={text}
              placeholder="0"
              onChange={(event) => setText(event.target.value)}
              className="h-14 w-full rounded-2xl border-2 border-evo-border bg-evo-bg/60 pr-10 text-center font-display text-3xl font-bold tabular-nums text-evo-text focus:border-evo-accent focus:outline-none"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-evo-muted">kg</span>
          </div>
          <button
            type="button"
            aria-label="Sumar 2,5 kg"
            onClick={() => step(2.5)}
            className="h-14 rounded-2xl bg-evo-surface-2 text-xl font-bold"
          >
            +
          </button>
        </div>

        <div role="radiogroup" aria-label="Barra" className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {BARS.map((option) => (
            <button
              key={option.kg}
              type="button"
              role="radio"
              aria-checked={bar === option.kg}
              onClick={() => chooseBar(option.kg)}
              className={[
                'min-h-10 shrink-0 rounded-full px-3.5 text-sm font-bold transition',
                bar === option.kg ? 'bg-evo-accent text-[#1a120c]' : 'bg-evo-surface-2 text-evo-muted',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-evo-bg/40 p-4">
          {!valid ? (
            <p className="text-center text-sm text-evo-muted">Escribe el peso para ver qué discos poner.</p>
          ) : bar === 0 ? (
            <p className="text-center text-sm text-evo-muted">
              Sin barra no hay discos que calcular: usa {formatPlateKg(target)} kg en la máquina o mancuernas.
            </p>
          ) : belowBar ? (
            <p className="text-center text-sm text-evo-warn">El peso es menor que la barra ({bar} kg).</p>
          ) : load ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">En cada lado</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="font-display text-xl font-bold leading-snug">
                  {load.perSide.length === 0 ? 'Barra sola' : load.perSide.map(formatPlateKg).join(' + ')}
                </p>
                <PlateStack plates={load.perSide} />
              </div>
              {!load.exact ? (
                <p className="mt-2 text-sm font-semibold text-evo-warn">
                  Con discos normales no sale exacto: lo más cercano es {formatPlateKg(load.achieved)} kg.
                </p>
              ) : (
                <p className="mt-1 text-xs text-evo-muted">
                  Barra {bar} kg + {formatPlateKg((load.achieved - bar) / 2)} kg por lado = {formatPlateKg(load.achieved)} kg
                </p>
              )}
            </>
          ) : null}
        </div>

        {warmups.length > 0 ? (
          <div className="mt-4">
            <h3 className="font-display text-base font-bold">Calentamiento sugerido</h3>
            <p className="text-xs text-evo-muted">Descansa 1 min entre series. No cuentan como series de trabajo.</p>
            <ol className="mt-2 space-y-1.5">
              {warmups.map((set, index) => {
                const plates = bar > 0 ? loadPlates(set.weight, bar) : null
                return (
                  <li key={set.weight} className="flex items-center gap-3 rounded-2xl bg-evo-surface-2 px-3 py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-evo-bg/60 text-sm font-bold text-evo-muted">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold tabular-nums">
                        {formatPlateKg(set.weight)} kg × {set.reps}
                        <span className="ml-1.5 text-xs font-semibold text-evo-muted">{set.label}</span>
                      </p>
                      {plates ? (
                        <p className="truncate text-xs text-evo-muted">
                          {plates.perSide.length === 0 ? 'Sin discos' : `Por lado: ${plates.perSide.map(formatPlateKg).join(' + ')}`}
                        </p>
                      ) : null}
                    </div>
                    {plates && plates.perSide.length > 0 ? <PlateStack plates={plates.perSide} compact /> : null}
                  </li>
                )
              })}
              <li className="flex items-center gap-3 rounded-2xl border-2 border-evo-accent/50 px-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-evo-accent text-sm font-bold text-[#1a120c]">
                  ▶
                </span>
                <p className="font-bold tabular-nums">
                  {formatPlateKg(target)} kg <span className="text-xs font-semibold text-evo-muted">series de trabajo</span>
                </p>
              </li>
            </ol>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
