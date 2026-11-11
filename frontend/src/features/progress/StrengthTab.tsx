import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Icon } from '../../components/icons/Icon'
import { formatKg, shortDate, type ProgressOverview, type StrengthExercise } from '../../lib/progress'

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs font-semibold text-evo-muted">1 sesión</span>
  if (pct === 0) return <span className="text-xs font-semibold text-evo-muted">= igual</span>
  const up = pct > 0
  return (
    <span className={['inline-flex items-center gap-0.5 text-sm font-bold tabular-nums', up ? 'text-evo-up' : 'text-evo-down'].join(' ')}>
      <span aria-hidden>{up ? '▲' : '▼'}</span>
      <span className="sr-only">{up ? 'sube' : 'baja'}</span>
      {Math.abs(pct).toLocaleString('es-ES')}%
    </span>
  )
}

/** Mini gráfica de la tendencia (1RM estimado) para la lista. */
function Sparkline({ points }: { points: StrengthExercise['points'] }) {
  if (points.length < 2) return <span className="block h-8 w-20" aria-hidden />
  const values = points.map((p) => p.e1rm)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const path = values.map((v, i) => `${(i / (values.length - 1)) * 76 + 2},${30 - ((v - min) / span) * 26}`).join(' ')
  const last = path.split(' ').pop()!.split(',')
  return (
    <svg viewBox="0 0 80 32" className="h-8 w-20" aria-hidden>
      <polyline points={path} fill="none" stroke="var(--color-evo-chart-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill="var(--color-evo-chart-1)" stroke="var(--color-evo-surface)" strokeWidth={2} />
    </svg>
  )
}

function ExerciseDetail({ exercise }: { exercise: StrengthExercise }) {
  const data = exercise.points.map((p) => ({ ...p, label: shortDate(p.date) }))
  const enough = data.length > 1

  return (
    <section className="rounded-3xl border border-evo-border/60 bg-evo-surface p-4 sm:p-5" aria-label={`Evolución de ${exercise.name}`}>
      <div className="flex items-center gap-3">
        {exercise.image_url ? <img src={exercise.image_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl bg-white object-cover" /> : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-bold leading-tight">{exercise.name}</h2>
          <p className="text-sm text-evo-muted">
            {exercise.sessions} {exercise.sessions === 1 ? 'sesión' : 'sesiones'} en el periodo
          </p>
        </div>
        <Change pct={exercise.change_pct} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-evo-surface-2 px-2 py-2.5">
          <dt className="text-xs font-semibold text-evo-muted">1RM estimado</dt>
          <dd className="font-display text-xl font-bold tabular-nums">{formatKg(exercise.best_e1rm, 0)}</dd>
        </div>
        <div className="rounded-2xl bg-evo-surface-2 px-2 py-2.5">
          <dt className="text-xs font-semibold text-evo-muted">Mejor peso</dt>
          <dd className="font-display text-xl font-bold tabular-nums">{formatKg(exercise.best_weight_kg)}</dd>
        </div>
        <div className="rounded-2xl bg-evo-surface-2 px-2 py-2.5">
          <dt className="text-xs font-semibold text-evo-muted">Récord total</dt>
          <dd className="font-display text-xl font-bold tabular-nums">{formatKg(exercise.all_time_best_kg)}</dd>
        </div>
      </dl>

      {enough ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-evo-muted" aria-hidden>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-evo-chart-1" /> 1RM estimado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-evo-chart-2" /> Peso de la mejor serie
            </span>
          </div>
          <div className="mt-2 h-56 w-full min-w-0" role="img" aria-label={`Gráfica de ${exercise.name}: 1RM estimado y peso de la mejor serie por sesión`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-evo-border)" strokeOpacity={0.35} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-evo-muted)', fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={[(min: number) => Math.max(0, Math.floor((min - 2) / 10) * 10), (max: number) => Math.ceil((max + 2) / 10) * 10]}
                  allowDecimals={false}
                  tick={{ fill: 'var(--color-evo-muted)', fontSize: 11 }}
                  tickFormatter={(v: number) => `${Math.round(v)}`}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--color-evo-surface)', border: '1px solid var(--color-evo-border)', borderRadius: 14, color: 'var(--color-evo-text)' }}
                  labelFormatter={(label) => String(label)}
                  formatter={(value, name, item) =>
                    name === 'e1rm'
                      ? [formatKg(Number(value), 0), '1RM estimado']
                      : [`${formatKg(Number(value))} × ${(item.payload as { reps: number }).reps}`, 'Mejor serie']
                  }
                />
                <Line type="monotone" dataKey="weight_kg" name="weight_kg" stroke="var(--color-evo-chart-2)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: 'var(--color-evo-chart-2)', stroke: 'var(--color-evo-surface)', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="e1rm" name="e1rm" stroke="var(--color-evo-chart-1)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--color-evo-chart-1)', stroke: 'var(--color-evo-surface)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-evo-muted">
            El <strong className="font-semibold text-evo-text">1RM estimado</strong> es el peso que podrías levantar una vez, calculado con tus series. Sirve para comparar días con distintas
            repeticiones.
          </p>
        </>
      ) : (
        <p className="mt-4 rounded-2xl bg-evo-surface-2 px-4 py-3 text-sm text-evo-muted">Entrena este ejercicio otra vez en el periodo para ver su evolución.</p>
      )}

      <Link to={`/exercise-history/${exercise.routine_exercise_id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-evo-accent">
        Ver historial completo <Icon name="chevron" className="h-4 w-4" />
      </Link>
    </section>
  )
}

/** Pestaña Fuerza: cómo evoluciona cada ejercicio. */
export function StrengthTab({ data }: { data: ProgressOverview }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const exercises = data.exercises
  const selected = exercises.find((e) => e.key === selectedKey) ?? exercises[0]

  if (!selected) {
    return (
      <div className="space-y-2 rounded-3xl border-2 border-dashed border-evo-border p-6 text-center">
        <p className="text-4xl" aria-hidden>
          💪
        </p>
        <p className="font-display text-xl font-bold">Sin datos de fuerza en este periodo</p>
        <p className="text-sm text-evo-muted">Apunta kilos y repeticiones en tus entrenos para ver cómo sube tu fuerza.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ExerciseDetail exercise={selected} />

      <section className="rounded-3xl border border-evo-border/60 bg-evo-surface" aria-label="Tus ejercicios">
        <h2 className="px-4 pb-1 pt-4 font-display text-lg font-bold">Tus ejercicios</h2>
        <p className="px-4 text-sm text-evo-muted">Toca uno para ver su gráfica. Cambio del 1RM estimado en el periodo.</p>
        <ul className="mt-2 divide-y divide-evo-border/40">
          {exercises.map((exercise) => {
            const active = exercise.key === selected.key
            return (
              <li key={exercise.key}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedKey(exercise.key)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className={['flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left transition', active ? 'bg-evo-accent/10' : 'active:bg-evo-surface-2'].join(' ')}
                >
                  {exercise.image_url ? (
                    <img src={exercise.image_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl bg-white object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-evo-surface-2 text-evo-muted" aria-hidden>
                      <Icon name="catalog" className="h-5 w-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{exercise.name}</span>
                    <span className="block text-xs text-evo-muted">
                      Mejor {formatKg(exercise.best_weight_kg)} · {exercise.sessions} {exercise.sessions === 1 ? 'sesión' : 'sesiones'}
                    </span>
                  </span>
                  <Sparkline points={exercise.points} />
                  <span className="w-14 shrink-0 text-right">
                    <Change pct={exercise.change_pct} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
