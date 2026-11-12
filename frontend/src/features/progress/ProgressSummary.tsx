import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Icon } from '../../components/icons/Icon'
import { relativeDayLabel } from '../../lib/dates'
import {
  changePct,
  formatKg,
  formatMinutes,
  formatVolume,
  shortDate,
  type ProgressKpis,
  type ProgressOverview,
} from '../../lib/progress'
import { routinesQuery } from '../../lib/queries'
import { MuscleBalance } from './MuscleBalance'

function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-evo-border/60 bg-evo-surface p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-evo-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Cambio frente al periodo anterior: flecha + texto (nunca solo color). */
function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs font-semibold text-evo-muted">nuevo</span>
  if (pct === 0) return <span className="text-xs font-semibold text-evo-muted">= igual</span>
  const up = pct > 0
  return (
    <span className={['inline-flex items-center gap-0.5 text-xs font-bold', up ? 'text-evo-up' : 'text-evo-down'].join(' ')}>
      <span aria-hidden>{up ? '▲' : '▼'}</span>
      <span className="sr-only">{up ? 'sube' : 'baja'}</span>
      {Math.abs(pct)}%
    </span>
  )
}

function KpiGrid({ current, previous, previousLabel }: { current: ProgressKpis; previous: ProgressKpis; previousLabel: string }) {
  const tiles = [
    { icon: '🏋️', label: 'Entrenos', value: String(current.workouts), pct: changePct(current.workouts, previous.workouts) },
    { icon: '⚖️', label: 'Volumen', value: formatVolume(current.volume_kg), pct: changePct(current.volume_kg, previous.volume_kg) },
    { icon: '⏱️', label: 'Tiempo', value: current.minutes > 0 ? formatMinutes(current.minutes) : '—', pct: current.minutes > 0 ? changePct(current.minutes, previous.minutes) : 0 },
    { icon: '🏆', label: 'Récords', value: String(current.records), pct: changePct(current.records, previous.records) },
  ]
  return (
    <section aria-label="Resumen del periodo">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-3xl border border-evo-border/60 bg-evo-surface p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-evo-muted">
              <span aria-hidden>{tile.icon}</span>
              {tile.label}
            </p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums leading-tight">{tile.value}</p>
            <Delta pct={tile.pct} />
          </div>
        ))}
      </div>
      <p className="mt-2 px-1 text-xs text-evo-muted">Comparado con {previousLabel}.</p>
    </section>
  )
}

type WeeklyMetric = 'workouts' | 'volume_kg'

function WeeklyChart({ weekly, goal }: { weekly: ProgressOverview['weekly']; goal: number }) {
  const [metric, setMetric] = useState<WeeklyMetric>('workouts')
  const data = weekly.map((w) => ({ ...w, label: shortDate(w.week_start) }))
  const avg = weekly.length ? weekly.reduce((s, w) => s + w.workouts, 0) / weekly.length : 0
  const isWorkouts = metric === 'workouts'

  return (
    <Card
      title={isWorkouts ? 'Entrenos por semana' : 'Volumen por semana'}
      subtitle={isWorkouts ? `Media: ${avg.toLocaleString('es-ES', { maximumFractionDigits: 1 })} por semana${goal ? ` · objetivo ${goal}` : ''}` : 'Kilos totales movidos (peso × repeticiones)'}
      action={
        <div role="radiogroup" aria-label="Qué mostrar" className="flex shrink-0 rounded-full bg-evo-surface-2 p-0.5 text-xs font-bold">
          {(
            [
              ['workouts', 'Entrenos'],
              ['volume_kg', 'Volumen'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={metric === id}
              onClick={() => setMetric(id)}
              className={['min-h-8 rounded-full px-3 transition', metric === id ? 'bg-evo-surface text-evo-text shadow' : 'text-evo-muted'].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div className="h-52 w-full min-w-0" role="img" aria-label={`Gráfica de ${isWorkouts ? 'entrenos' : 'volumen'} por semana`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--color-evo-border)" strokeOpacity={0.35} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-evo-muted)', fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={isWorkouts ? 28 : 44}
              tick={{ fill: 'var(--color-evo-muted)', fontSize: 11 }}
              tickFormatter={(v: number) =>
                isWorkouts ? String(v) : v >= 1000 ? `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: v < 10000 ? 1 : 0 })}t` : String(v)
              }
            />
            <Tooltip
              cursor={{ fill: 'var(--color-evo-surface-2)', opacity: 0.6 }}
              contentStyle={{ background: 'var(--color-evo-surface)', border: '1px solid var(--color-evo-border)', borderRadius: 14, color: 'var(--color-evo-text)' }}
              labelFormatter={(label) => `Semana del ${label}`}
              formatter={(value) => (isWorkouts ? [`${value} entrenos`, ''] : [formatVolume(Number(value)), ''])}
              separator=""
            />
            {isWorkouts && goal > 0 ? (
              <ReferenceLine
                y={goal}
                stroke="var(--color-evo-muted)"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            ) : null}
            <Bar dataKey={metric} fill="var(--color-evo-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {isWorkouts && goal > 0 ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-evo-muted">
          <span className="w-4 border-t-2 border-dashed border-evo-muted" aria-hidden /> Tu objetivo: {goal} por semana
        </p>
      ) : null}
    </Card>
  )
}

const DAY_LABELS = ['L', '', 'X', '', 'V', '', 'D']

/** Intensidad del día por series hechas (un solo tono, de claro a intenso). */
function heatLevel(sets: number) {
  if (sets <= 0) return 0
  if (sets < 8) return 1
  if (sets < 16) return 2
  if (sets < 24) return 3
  return 4
}

const HEAT_STYLE = [
  'bg-evo-surface-2',
  'bg-[color-mix(in_oklab,var(--color-evo-chart-1)_35%,var(--color-evo-surface-2))]',
  'bg-[color-mix(in_oklab,var(--color-evo-chart-1)_60%,var(--color-evo-surface-2))]',
  'bg-[color-mix(in_oklab,var(--color-evo-chart-1)_82%,var(--color-evo-surface-2))]',
  'bg-evo-chart-1',
]

/** Mapa de constancia: cada cuadrado es un día de las últimas 26 semanas. */
function ConsistencyHeatmap({ calendar }: { calendar: ProgressOverview['calendar'] }) {
  const { weeks, months, trainedDays } = useMemo(() => {
    const start = new Date(`${calendar.from}T12:00:00`)
    const end = calendar.to
    const cols: Array<Array<{ date: string; sets: number; future: boolean }>> = []
    const monthLabels: Array<{ col: number; label: string }> = []
    let lastMonth = -1
    for (let w = 0; w < 26; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start)
        date.setDate(start.getDate() + w * 7 + d)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        col.push({ date: key, sets: calendar.days[key] ?? 0, future: key > end })
        if (d === 0 && date.getMonth() !== lastMonth) {
          // Si la etiqueta anterior queda muy cerca (mes cortado al inicio), se sustituye.
          const prev = monthLabels.at(-1)
          if (prev && w - prev.col < 3) monthLabels.pop()
          monthLabels.push({ col: w, label: date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') })
          lastMonth = date.getMonth()
        }
      }
      cols.push(col)
    }
    return { weeks: cols, months: monthLabels, trainedDays: Object.keys(calendar.days).length }
  }, [calendar])

  return (
    <Card title="Constancia" subtitle={`${trainedDays} ${trainedDays === 1 ? 'día entrenado' : 'días entrenados'} en los últimos 6 meses`}>
      <div className="overflow-x-auto pb-1 [scrollbar-width:none]">
        <div className="min-w-[19rem]">
          <div className="relative mb-1 ml-5 h-4 text-[0.65rem] font-semibold capitalize text-evo-muted" aria-hidden>
            {months.map((m) => (
              <span key={m.col} className="absolute" style={{ left: `${(m.col / 26) * 100}%` }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <div className="grid grid-rows-7 gap-[3px] text-[0.6rem] font-semibold leading-none text-evo-muted" aria-hidden>
              {DAY_LABELS.map((d, i) => (
                <span key={i} className="flex h-full w-4 items-center">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid flex-1 grid-flow-col grid-cols-[repeat(26,minmax(0,1fr))] grid-rows-7 gap-[3px]" role="img" aria-label={`Mapa de constancia: ${trainedDays} días entrenados en 26 semanas`}>
              {weeks.flatMap((col) =>
                col.map((cell) => (
                  <span
                    key={cell.date}
                    title={cell.future ? undefined : `${shortDate(cell.date)}: ${cell.sets ? `${cell.sets} series` : 'descanso'}`}
                    className={['aspect-square rounded-[3px]', cell.future ? 'opacity-0' : HEAT_STYLE[heatLevel(cell.sets)]].join(' ')}
                  />
                )),
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-evo-muted" aria-hidden>
        Menos
        {HEAT_STYLE.map((style, i) => (
          <span key={i} className={['h-3 w-3 rounded-[3px]', style].join(' ')} />
        ))}
        Más
      </div>
    </Card>
  )
}

function RecentRecords({ records }: { records: ProgressOverview['records'] }) {
  return (
    <Card title="Récords del periodo" subtitle={records.length ? 'Cada vez que superaste tu mejor peso' : undefined}>
      {records.length === 0 ? (
        <p className="py-2 text-sm text-evo-muted">Aún ninguno en este periodo. Sube un poco el peso cuando completes todas las repeticiones.</p>
      ) : (
        <ul className="-mx-1 divide-y divide-evo-border/40">
          {records.map((record) => (
            <li key={`${record.routine_exercise_id}-${record.date}`}>
              <Link to={`/exercise-history/${record.routine_exercise_id}`} className="flex items-center gap-3 rounded-xl px-1 py-2.5 transition active:bg-evo-surface-2">
                {record.image_url ? (
                  <img src={record.image_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl bg-white object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-evo-surface-2 text-xl" aria-hidden>
                    🏆
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{record.exercise}</span>
                  <span className="block text-sm text-evo-muted">{relativeDayLabel(record.date)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-lg font-bold tabular-nums">
                    {formatKg(record.weight_kg)}
                    {record.reps ? <span className="text-sm font-semibold text-evo-muted"> × {record.reps}</span> : null}
                  </span>
                  <span className="block text-xs font-bold text-evo-up">
                    <span aria-hidden>▲</span> +{formatKg(Math.round((record.weight_kg - record.previous_kg) * 10) / 10)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Pestaña Resumen: lo esencial del periodo en un vistazo. */
export function ProgressSummary({ data, previousLabel }: { data: ProgressOverview; previousLabel: string }) {
  const routines = useQuery(routinesQuery)
  const goal = (routines.data ?? []).filter((r) => r.is_active).reduce((sum, r) => sum + (r.sessions_per_week || 0), 0)
  const nothing = data.kpis.current.workouts === 0 && data.kpis.previous.workouts === 0

  if (nothing) {
    return (
      <div className="space-y-3 rounded-3xl border-2 border-dashed border-evo-border p-6 text-center">
        <p className="text-4xl" aria-hidden>
          📈
        </p>
        <p className="font-display text-xl font-bold">Tu progreso empieza con el primer entreno</p>
        <p className="text-sm text-evo-muted">Apunta tus series y aquí verás tu constancia, tus récords y cómo sube tu fuerza.</p>
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-bold text-evo-accent">
          Ir a entrenar <Icon name="chevron" className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <KpiGrid current={data.kpis.current} previous={data.kpis.previous} previousLabel={previousLabel} />
      <WeeklyChart weekly={data.weekly} goal={goal} />
      <ConsistencyHeatmap calendar={data.calendar} />
      <RecentRecords records={data.records} />
      <MuscleBalance />
    </div>
  )
}
