import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatShortDate } from '../../lib/dates'

type MuscleRow = {
  name: string
  sets: number
  volume: number
  avg_sets_per_week: number
  prev_avg_sets_per_week: number | null
  weekly_sets: Array<{ week: string; sets: number }>
}

type MuscleData = { from: string; to: string; weeks: string[]; muscles: MuscleRow[] }

/** Referencia habitual de hipertrofia: ~10–20 series semanales por grupo muscular. */
const LOW = 6
const TARGET_MIN = 10
const TARGET_MAX = 20

function level(avg: number) {
  if (avg < LOW) return { label: 'Poco trabajo', tone: 'text-evo-warn' }
  if (avg < TARGET_MIN) return { label: 'Mantenimiento', tone: 'text-evo-muted' }
  if (avg <= TARGET_MAX) return { label: 'En rango', tone: 'text-evo-lime' }
  return { label: 'Mucho volumen', tone: 'text-evo-accent' }
}

function trend(row: MuscleRow) {
  if (row.prev_avg_sets_per_week == null) return null
  const diff = Math.round((row.avg_sets_per_week - row.prev_avg_sets_per_week) * 10) / 10
  if (Math.abs(diff) < 1) return { text: 'estable', sign: '=' }
  return { text: `${diff > 0 ? '+' : ''}${diff.toLocaleString('es-ES')} vs 4 sem. antes`, sign: diff > 0 ? '↑' : '↓' }
}

export function MuscleBalance() {
  const query = useQuery({
    queryKey: ['progress-muscles', 8],
    queryFn: async () => {
      const { data } = await api.get<MuscleData>('/progress/muscles', { params: { weeks: 8 } })
      return data
    },
  })

  const muscles = query.data?.muscles ?? []
  const scaleMax = Math.max(TARGET_MAX, ...muscles.map((m) => m.avg_sets_per_week))
  const weekMax = Math.max(1, ...muscles.flatMap((m) => m.weekly_sets.map((w) => w.sets)))
  const ungrouped = muscles.some((m) => m.name === 'Sin grupo')
  // Desequilibrio: grupos con menos de la mitad de series que el más trabajado.
  const grouped = muscles.filter((m) => m.name !== 'Sin grupo')
  const top = grouped[0] ? grouped.reduce((a, b) => (b.avg_sets_per_week > a.avg_sets_per_week ? b : a)) : null
  const weak = top && top.avg_sets_per_week >= 4 ? grouped.filter((m) => m.avg_sets_per_week < top.avg_sets_per_week / 2) : []
  const list = (names: string[]) =>
    names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`

  return (
    <div className="min-w-0 space-y-3">
      <div>
        <h3 className="font-display text-lg font-bold">Reparto por grupo muscular</h3>
        <p className="text-sm text-evo-muted">
          Series por semana (media de las últimas 4). La franja marca 10–20 series, lo habitual para ganar músculo.
        </p>
      </div>

      {query.isLoading ? (
        <div className="panel h-40 animate-pulse" aria-label="Cargando" />
      ) : muscles.length === 0 ? (
        <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-evo-border px-4 py-6 text-center text-sm text-evo-muted">
          Cuando registres series aparecerá aquí cuánto trabajas cada grupo muscular.
        </div>
      ) : (
        <div className="panel space-y-1 p-4">
          {weak.length > 0 ? (
            <p className="mb-3 rounded-2xl bg-evo-warn/10 px-3 py-2.5 text-sm font-semibold text-evo-warn">
              ⚖ {list(weak.map((m) => m.name))} {weak.length === 1 ? 'recibe' : 'reciben'} menos de la mitad de series que{' '}
              {top?.name.toLowerCase()}. Si no es a propósito, compensa en tu rutina.
            </p>
          ) : null}

          <ul className="divide-y divide-evo-border/40">
            {muscles.map((row) => {
              const lvl = level(row.avg_sets_per_week)
              const tr = trend(row)
              const width = Math.max(row.avg_sets_per_week > 0 ? 2 : 0, (row.avg_sets_per_week / scaleMax) * 100)
              return (
                <li key={row.name} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={['min-w-0 truncate font-bold', row.name === 'Sin grupo' ? 'text-evo-muted' : ''].join(' ')}>
                      {row.name}
                    </p>
                    <p className="shrink-0 text-sm tabular-nums">
                      <span className="font-display text-lg font-bold">{row.avg_sets_per_week.toLocaleString('es-ES')}</span>
                      <span className="text-evo-muted"> series/sem</span>
                    </p>
                  </div>

                  <div
                    className="relative mt-1.5 h-2.5 rounded-full bg-evo-surface-2"
                    role="img"
                    aria-label={`${row.name}: ${row.avg_sets_per_week} series por semana, ${lvl.label.toLowerCase()}`}
                  >
                    <div
                      className="absolute inset-y-0 rounded-full border-x border-dashed border-evo-muted/50 bg-evo-lime/15"
                      style={{ left: `${(TARGET_MIN / scaleMax) * 100}%`, width: `${((TARGET_MAX - TARGET_MIN) / scaleMax) * 100}%` }}
                      aria-hidden
                    />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-evo-accent" style={{ width: `${width}%` }} aria-hidden />
                  </div>

                  <div className="mt-2 flex items-end justify-between gap-3">
                    <p className="text-xs">
                      <span className={`font-bold ${lvl.tone}`}>{lvl.label}</span>
                      {tr ? <span className="text-evo-muted"> · {tr.sign} {tr.text}</span> : null}
                    </p>
                    <div className="flex h-6 shrink-0 items-end gap-[2px]" aria-hidden>
                      {row.weekly_sets.map((w) => (
                        <span
                          key={w.week}
                          title={`Semana del ${formatShortDate(w.week)}: ${w.sets} series`}
                          className={['w-2 rounded-t-[2px]', w.sets > 0 ? 'bg-evo-accent/70' : 'bg-evo-border/50'].join(' ')}
                          style={{ height: `${w.sets > 0 ? Math.max(15, (w.sets / weekMax) * 100) : 8}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <p className="pt-2 text-xs text-evo-muted">
            Las barritas de la derecha son las últimas 8 semanas.
            {ungrouped ? (
              <>
                {' '}
                «Sin grupo» son ejercicios sin músculo asignado:{' '}
                <Link to="/exercises" className="font-bold text-evo-accent">
                  asígnalo en Ejercicios
                </Link>
                .
              </>
            ) : null}
          </p>
        </div>
      )}
    </div>
  )
}
