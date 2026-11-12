import { Segmented } from '../components/ui/Segmented'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { BodyTab } from '../features/progress/BodyTab'
import { ProgressSummary } from '../features/progress/ProgressSummary'
import { StrengthTab } from '../features/progress/StrengthTab'
import { overviewQuery, RANGE_OPTIONS, type ProgressRange } from '../lib/progress'

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'fuerza', label: 'Fuerza' },
  { id: 'cuerpo', label: 'Cuerpo' },
] as const
type TabId = (typeof TABS)[number]['id']

function isRange(value: number): value is ProgressRange {
  return RANGE_OPTIONS.some((o) => o.weeks === value)
}

/** Progreso: resumen del periodo, fuerza por ejercicio y cuerpo. Pestaña y rango viven en la URL. */
export function ProgressPage() {
  const [params, setParams] = useSearchParams()
  const tab: TabId = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'resumen'
  const rawWeeks = Number(params.get('semanas'))
  const weeks: ProgressRange = isRange(rawWeeks) ? rawWeeks : 12
  const range = RANGE_OPTIONS.find((o) => o.weeks === weeks)!
  const overview = useQuery({ ...overviewQuery(weeks), enabled: tab !== 'cuerpo' })

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      <h1 className="sr-only">Progreso</h1>

      <Segmented label="Secciones de progreso" value={tab} onChange={(id) => setParam('tab', id)} options={TABS} controlsPanels />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-4">
        {tab !== 'cuerpo' ? (
          <>
            <div className="flex items-center gap-2" role="group" aria-label="Periodo">
              {RANGE_OPTIONS.map((o) => {
                const active = o.weeks === weeks
                return (
                  <button
                    key={o.weeks}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setParam('semanas', String(o.weeks))}
                    className={[
                      'min-h-10 rounded-full border px-4 text-sm font-semibold transition',
                      active ? 'border-evo-text bg-evo-text text-evo-bg' : 'border-evo-border text-evo-muted active:bg-evo-surface-2',
                    ].join(' ')}
                  >
                    {o.label}
                  </button>
                )
              })}
              {overview.isFetching && overview.data ? (
                <span className="ml-auto text-xs text-evo-muted" aria-live="polite">
                  Actualizando…
                </span>
              ) : null}
            </div>

            {overview.isError ? (
              <div className="rounded-3xl border border-evo-danger/40 bg-evo-danger/10 p-5 text-center">
                <p className="font-bold">No se ha podido cargar tu progreso.</p>
                <button type="button" onClick={() => void overview.refetch()} className="mt-2 text-sm font-bold text-evo-accent">
                  Reintentar
                </button>
              </div>
            ) : !overview.data ? (
              <div className="space-y-4" aria-busy aria-label="Cargando progreso">
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-3xl bg-evo-surface" />
                  ))}
                </div>
                <div className="h-64 animate-pulse rounded-3xl bg-evo-surface" />
              </div>
            ) : tab === 'resumen' ? (
              <ProgressSummary data={overview.data} previousLabel={range.previous} />
            ) : (
              <StrengthTab data={overview.data} />
            )}
          </>
        ) : (
          <BodyTab />
        )}
      </div>
    </div>
  )
}
