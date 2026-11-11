import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '../components/ui/Button'
import { formatKg } from '../features/workout/model'
import { api, type ExerciseHistory } from '../lib/api'
import { formatDayLabel, formatShortDate } from '../lib/dates'
import { formatDuration, formatScore, isTimeMode } from '../lib/tracking'

type Metric = 'best' | 'e1rm' | 'volume'

const metricLabels: Record<Metric, string> = {
  best: 'Mejor serie',
  e1rm: '1RM estimado',
  volume: 'Volumen',
}

export function ExerciseHistoryPage() {
  const { routineExerciseId } = useParams()
  const [metric, setMetric] = useState<Metric>('best')

  const query = useQuery({
    queryKey: ['exercise-history', Number(routineExerciseId)],
    enabled: Number.isFinite(Number(routineExerciseId)),
    queryFn: async () => {
      const { data } = await api.get<{ data: ExerciseHistory }>('/exercise-history', {
        params: { routine_exercise_id: routineExerciseId },
      })
      return data.data
    },
  })

  const history = query.data
  const timed = history ? isTimeMode(history.tracking_mode) : false

  const chart = useMemo(() => {
    if (!history) return []
    return history.entries.map((entry) => ({
      fecha: formatShortDate(entry.date),
      value:
        timed
          ? entry.best_duration_seconds
          : metric === 'e1rm'
            ? entry.est_1rm
            : metric === 'volume'
              ? entry.volume_kg
              : entry.best_weight_kg,
    }))
  }, [history, metric, timed])

  const records = useMemo(() => {
    if (!history || history.entries.length === 0) return null
    const entries = history.entries
    const maxBy = (pick: (e: (typeof entries)[number]) => number | null) =>
      entries.reduce<number | null>((best, e) => {
        const v = pick(e)
        return v != null && (best == null || v > best) ? v : best
      }, null)
    const durations = entries.map((e) => e.best_duration_seconds).filter((v): v is number => v != null)
    return {
      weight: maxBy((e) => e.best_weight_kg),
      e1rm: maxBy((e) => e.est_1rm),
      volume: maxBy((e) => e.volume_kg),
      duration:
        durations.length === 0
          ? null
          : history.time_direction === 'longer'
            ? Math.max(...durations)
            : Math.min(...durations),
      sessions: entries.length,
    }
  }, [history])

  return (
    <div className="space-y-4">
      {query.isLoading ? <p className="text-sm text-evo-muted">Cargando historial…</p> : null}

      {query.isError ? (
        <div className="panel space-y-3 p-5">
          <p className="font-bold">No se pudo cargar el historial.</p>
          <Button onClick={() => void query.refetch()}>Reintentar</Button>
        </div>
      ) : null}

      {history ? (
        <>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{history.name}</h1>
            <p className="mt-1 text-evo-muted">
              {records ? `${records.sessions} sesiones registradas` : 'Todavía no hay marcas.'}
            </p>
          </div>

          {records ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {timed ? (
                <RecordTile label="Mejor tiempo" value={formatDuration(records.duration)} />
              ) : (
                <>
                  <RecordTile label="Récord kg" value={formatKg(records.weight)} />
                  <RecordTile label="1RM est." value={formatKg(records.e1rm)} />
                  <RecordTile label="Mayor volumen" value={formatKg(records.volume)} />
                </>
              )}
              <RecordTile label="Sesiones" value={String(records.sessions)} />
            </div>
          ) : null}

          {history.entries.length > 1 ? (
            <div className="panel space-y-3 p-4">
              {!timed ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Qué mostrar">
                  {(Object.keys(metricLabels) as Metric[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={metric === key}
                      onClick={() => setMetric(key)}
                      className={[
                        'min-h-11 rounded-full px-4 text-sm font-bold',
                        metric === key ? 'bg-evo-accent text-[#1a120c]' : 'bg-evo-surface-2 text-evo-text',
                      ].join(' ')}
                    >
                      {metricLabels[key]}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-evo-border)" strokeOpacity={0.6} vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fill: 'var(--color-evo-muted)', fontSize: 12 }} interval="preserveStartEnd" minTickGap={28} />
                    <YAxis
                      tick={{ fill: 'var(--color-evo-muted)', fontSize: 12 }}
                      width={44}
                      domain={['auto', 'auto']}
                      tickFormatter={(v: number) => (timed ? formatDuration(v) : String(v))}
                    />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-evo-surface)', border: '1px solid var(--color-evo-border)', borderRadius: 12, color: 'var(--color-evo-text)' }}
                      formatter={(v) => (timed ? formatDuration(Number(v)) : formatKg(Number(v)))}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={timed ? 'Tiempo' : metricLabels[metric]}
                      stroke="var(--color-evo-accent)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--color-evo-accent)' }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          {history.entries.length > 0 ? (
            <section className="space-y-2">
              <h2 className="font-display text-xl font-bold">Sesiones</h2>
              <ul className="space-y-2">
                {[...history.entries].reverse().map((entry) => (
                  <li key={entry.session_id} className="panel p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-bold capitalize">{formatDayLabel(entry.date)}</p>
                      <p className="text-sm font-semibold text-evo-accent">
                        {formatScore({
                          mode: history.tracking_mode,
                          weight: entry.best_weight_kg,
                          reps: entry.best_reps,
                          duration: entry.best_duration_seconds,
                        })}
                      </p>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {entry.sets.map((set) => (
                        <li key={set.set_number} className="rounded-full bg-evo-surface-2 px-3 py-1 text-sm font-semibold">
                          S{set.set_number}{' '}
                          {formatScore({
                            mode: history.tracking_mode,
                            weight: set.weight_kg,
                            reps: set.reps,
                            duration: set.duration_seconds,
                          })}
                          {set.rpe != null ? <span className="text-evo-muted"> · RPE {set.rpe}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function RecordTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
