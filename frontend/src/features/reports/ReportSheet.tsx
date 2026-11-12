import { useEffect, useMemo, useRef, useState } from 'react'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Icon } from '../../components/icons/Icon'
import { Button } from '../../components/ui/Button'
import { addDays, localDateKey, parseDateKey, startOfWeek } from '../../lib/dates'
import { downloadRangeReport } from '../../lib/reports'

export type ReportPeriod = 'day' | 'week' | 'month' | 'custom'

const PERIODS: Array<{ id: ReportPeriod; label: string }> = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'custom', label: 'Fechas' },
]

const CONTENTS = [
  'Resumen con sesiones, series, repeticiones y volumen',
  'Cada ejercicio serie a serie: peso, reps, tiempo y RPE',
  'Mejor marca y 1RM estimado por ejercicio',
  'Notas de la sesión y comparación con el periodo anterior',
]

function rangeFor(period: ReportPeriod, anchor: Date, customFrom: string, customTo: string) {
  if (period === 'day') {
    const key = localDateKey(anchor)
    return { from: key, to: key }
  }
  if (period === 'week') {
    const start = startOfWeek(anchor)
    return { from: localDateKey(start), to: localDateKey(addDays(start, 6)) }
  }
  if (period === 'month') {
    return {
      from: localDateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
      to: localDateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
    }
  }
  return { from: customFrom, to: customTo }
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function periodTitle(period: ReportPeriod, from: string, to: string): string {
  const a = parseDateKey(from)
  const b = parseDateKey(to)
  if (period === 'day') {
    return capitalize(a.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))
  }
  if (period === 'month') {
    return capitalize(a.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))
  }
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const left = sameMonth ? String(a.getDate()) : a.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const right = b.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${left} – ${right}`.replace(/\./g, '')
}

/**
 * Hoja para elegir el periodo del informe PDF (día, semana, mes o fechas a medida) y descargarlo.
 */
export function ReportSheet({
  initialPeriod = 'week',
  initialDate,
  onClose,
}: {
  initialPeriod?: ReportPeriod
  initialDate?: string | null
  onClose: () => void
}) {
  const { notify } = useUiFeedback()
  const today = localDateKey()
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod)
  const [anchor, setAnchor] = useState<Date>(() => parseDateKey(initialDate ?? today))
  const [customFrom, setCustomFrom] = useState(() => localDateKey(addDays(parseDateKey(today), -29)))
  const [customTo, setCustomTo] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  const range = useMemo(() => rangeFor(period, anchor, customFrom, customTo), [period, anchor, customFrom, customTo])

  const customInvalid =
    period === 'custom' &&
    (!customFrom || !customTo || customFrom > customTo || parseDateKey(customTo).getTime() - parseDateKey(customFrom).getTime() > 366 * 86_400_000)

  const atPresent = range.to >= today

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
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

  function shift(delta: number) {
    setError(null)
    setAnchor((current) => {
      if (period === 'day') return addDays(current, delta)
      if (period === 'week') return addDays(current, delta * 7)
      return new Date(current.getFullYear(), current.getMonth() + delta, 1)
    })
  }

  async function submit() {
    if (customInvalid || busy) return
    setBusy(true)
    setError(null)
    const result = await downloadRangeReport(range.from, range.to)
    setBusy(false)
    if (result.ok) {
      notify('Informe descargado', 'success')
      onClose()
    } else {
      setError(result.message)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="safe-bottom max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[1.6rem] border-2 border-evo-border bg-evo-surface p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-evo-border sm:hidden" aria-hidden />

        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-evo-accent/15 text-evo-accent">
            <Icon name="file" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="report-title" className="font-display text-xl font-bold">
              Informe de entrenamiento
            </h2>
            <p className="text-sm text-evo-muted">Descárgalo en PDF para guardarlo o compartirlo.</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            disabled={busy}
            onClick={onClose}
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-evo-muted hover:bg-evo-surface-2 hover:text-evo-text"
          >
            <Icon name="close" />
          </button>
        </div>

        <div
          role="radiogroup"
          aria-label="Periodo del informe"
          className="mt-5 grid grid-cols-4 gap-1 rounded-2xl border border-evo-border bg-evo-surface-2 p-1"
        >
          {PERIODS.map((item) => {
            const active = period === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => {
                  setPeriod(item.id)
                  setError(null)
                }}
                className={[
                  'min-h-11 rounded-xl text-sm font-bold transition',
                  active ? 'bg-evo-accent text-[#111]' : 'text-evo-muted hover:text-evo-text',
                ].join(' ')}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          {period === 'custom' ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-evo-muted">
                <span>Desde</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || today}
                  onChange={(event) => {
                    setCustomFrom(event.target.value)
                    setError(null)
                  }}
                  className="block min-h-12 w-full rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-3 text-base font-semibold normal-case tracking-normal text-evo-text focus:border-evo-accent focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-evo-muted">
                <span>Hasta</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(event) => {
                    setCustomTo(event.target.value)
                    setError(null)
                  }}
                  className="block min-h-12 w-full rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-3 text-base font-semibold normal-case tracking-normal text-evo-text focus:border-evo-accent focus:outline-none"
                />
              </label>
              {customInvalid ? (
                <p className="col-span-2 text-sm text-evo-warn">
                  Elige un rango válido (como máximo un año).
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border-2 border-evo-border bg-evo-bg/40 p-1.5">
              <button
                type="button"
                aria-label="Periodo anterior"
                onClick={() => shift(-1)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-evo-surface-2 text-lg font-bold"
              >
                ←
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="truncate font-display text-base font-bold" aria-live="polite">
                  {periodTitle(period, range.from, range.to)}
                </p>
                {period === 'day' ? (
                  <label className="relative mt-0.5 inline-flex min-h-8 cursor-pointer items-center text-xs font-bold text-evo-accent">
                    Elegir fecha
                    <input
                      type="date"
                      value={range.from}
                      max={today}
                      aria-label="Elegir fecha"
                      onChange={(event) => {
                        if (event.target.value) setAnchor(parseDateKey(event.target.value))
                        setError(null)
                      }}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                ) : (
                  <p className="text-xs text-evo-muted">
                    {period === 'week' ? 'Lunes a domingo' : 'Mes completo'}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Periodo siguiente"
                disabled={atPresent}
                onClick={() => shift(1)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-evo-surface-2 text-lg font-bold disabled:opacity-35"
              >
                →
              </button>
            </div>
          )}
        </div>

        <ul className="mt-4 space-y-2 rounded-2xl bg-evo-bg/40 p-4 text-sm">
          {CONTENTS.map((line) => (
            <li key={line} className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-evo-lime" aria-hidden />
              <span className="text-evo-muted">{line}</span>
            </li>
          ))}
        </ul>

        {error ? (
          <p role="alert" className="mt-4 rounded-2xl border border-evo-warn/40 bg-evo-warn/10 px-4 py-3 text-sm font-semibold text-evo-warn">
            {error}
          </p>
        ) : null}

        <Button size="lg" fullWidth className="mt-5" disabled={busy || customInvalid} onClick={() => void submit()}>
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
              Generando PDF…
            </>
          ) : (
            <>
              <Icon name="download" />
              Descargar PDF
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
