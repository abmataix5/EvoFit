import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { useAuth } from '../features/auth/AuthContext'
import { PhotoCheckIn } from '../components/progress/PhotoCheckIn'
import {
  api,
  type BodyWeightEntry,
  type ProgressExerciseRow,
  type ProgressInsight,
  type ProgressPhoto,
} from '../lib/api'
import { localDateKey, helloLine } from '../lib/motivation'
import { formatDuration } from '../lib/tracking'
import { prepareProgressPhoto } from '../lib/preparePhoto'
import axios from 'axios'

const moodUi = {
  green: {
    title: 'Vas de subida',
    ring: 'border-evo-lime/50',
    badge: 'bg-evo-lime text-[#102000]',
  },
  orange: {
    title: 'Semana estable',
    ring: 'border-evo-warn/50',
    badge: 'bg-evo-warn text-[#1a1400]',
  },
  red: {
    title: 'Hay que ajustar',
    ring: 'border-evo-danger/50',
    badge: 'bg-evo-danger text-[#1a120c]',
  },
} as const

const statusUi = {
  improved: { label: 'Subió', className: 'bg-evo-lime/20 text-evo-lime' },
  maintained: { label: 'Igual', className: 'bg-evo-warn/20 text-evo-warn' },
  declined: { label: 'Bajó', className: 'bg-evo-danger/20 text-evo-danger' },
  new: { label: 'Nuevo', className: 'bg-evo-accent/20 text-evo-accent-soft' },
} as const

function formatShortDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function formatKg(value: number | null | undefined) {
  if (value == null) return '—'
  return `${Number(value).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`
}

function formatMark(row: ProgressExerciseRow, which: 'current' | 'previous') {
  if (row.metric === 'time') {
    return formatDuration(which === 'current' ? row.current_best_seconds : row.previous_best_seconds)
  }
  return formatKg(which === 'current' ? row.current_best_kg : row.previous_best_kg)
}

function formatDelta(row: ProgressExerciseRow) {
  if (row.metric === 'time' && row.delta_seconds != null) {
    const sign = row.delta_seconds > 0 ? '+' : ''
    return `${sign}${row.delta_seconds} s`
  }
  if (row.delta_kg != null) {
    return `${row.delta_kg > 0 ? '+' : ''}${row.delta_kg} kg`
  }
  return statusLabel(row)
}

function statusLabel(row: ProgressExerciseRow) {
  if (row.metric === 'time' && row.status === 'improved') {
    return row.time_direction === 'longer' ? 'Más tiempo' : 'Más rápido'
  }
  if (row.metric === 'time' && row.status === 'declined') {
    return row.time_direction === 'longer' ? 'Menos tiempo' : 'Más lento'
  }
  return statusUi[row.status].label
}

export function ProgressPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { notify } = useUiFeedback()
  const today = localDateKey()
  const [weightOn, setWeightOn] = useState(today)
  const [photoOn, setPhotoOn] = useState(today)
  const [weightKg, setWeightKg] = useState('')
  const [caption, setCaption] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [filter, setFilter] = useState<'all' | 'improved' | 'declined' | 'maintained' | 'new'>('all')

  const insightsQuery = useQuery({
    queryKey: ['progress-insights'],
    queryFn: async () => {
      const { data } = await api.get<ProgressInsight>('/progress/insights')
      return data
    },
  })

  const weightsQuery = useQuery({
    queryKey: ['body-weights'],
    queryFn: async () => {
      const { data } = await api.get<{ data: BodyWeightEntry[] }>('/progress/body-weight')
      return data.data
    },
  })

  const photosQuery = useQuery({
    queryKey: ['progress-photos'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ProgressPhoto[] }>('/progress/photos')
      return data.data
    },
  })

  const weightChart = useMemo(() => {
    return [...(weightsQuery.data ?? [])]
      .reverse()
      .slice(-12)
      .map((entry) => ({
        fecha: formatShortDate(entry.recorded_on),
        kg: Number(entry.weight_kg),
      }))
  }, [weightsQuery.data])

  const saveWeight = useMutation({
    mutationFn: async () => {
      await api.post('/progress/body-weight', {
        recorded_on: weightOn,
        weight_kg: Number(weightKg),
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['body-weights'] }),
        queryClient.invalidateQueries({ queryKey: ['progress-insights'] }),
      ])
      setWeightKg('')
      notify('Peso guardado', 'success')
    },
    onError: () => notify('No se pudo guardar el peso', 'error'),
  })

  const uploadPhoto = useMutation({
    mutationFn: async () => {
      if (!photoFile) return
      const ready = await prepareProgressPhoto(photoFile)
      const formData = new FormData()
      formData.append('recorded_on', photoOn)
      formData.append('photo', ready)
      if (caption.trim()) formData.append('caption', caption.trim())
      await api.post('/progress/photos', formData)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['progress-photos'] })
      setPhotoFile(null)
      setCaption('')
      notify('Foto subida', 'success')
    },
    onError: (error: unknown) => {
      if (error instanceof Error && (error.message === 'decode' || error.message === 'blob' || error.message === 'canvas')) {
        notify('No pude leer esa foto. Elige otra de la galería, mejor en JPEG.', 'error')
        return
      }
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined
        const field = data?.errors ? Object.values(data.errors).flat()[0] : undefined
        if (error.response?.status === 413) {
          notify('La foto pesa demasiado. Prueba con otra más ligera.', 'error')
          return
        }
        notify(field || data?.message || 'No se pudo subir la foto', 'error')
        return
      }
      notify('No se pudo subir la foto', 'error')
    },
  })

  const data = insightsQuery.data
  const summary = data?.summary
  const training = data?.training
  const coach = data?.coach
  const body = data?.body
  const mood = summary ? moodUi[summary.mood] : null

  const filteredExercises = useMemo(() => {
    const rows = data?.exercises ?? []
    if (filter === 'all') return rows
    return rows.filter((row) => row.status === filter)
  }, [data?.exercises, filter])

  return (
    <div className="min-w-0 space-y-10">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold tracking-tight">{helloLine(user?.name)}</h1>
        <p className="mt-1 text-base text-evo-muted">Semana, peso y fotos, cada cosa en su sitio.</p>
      </div>

      <section className="min-w-0 space-y-4">
        <SectionHeading kicker="1" title="Esta semana" text="Cómo vas de fuerza y de constancia." />
      {mood && summary && coach ? (
        <section className={`panel space-y-4 border-2 p-5 ${mood.ring}`}>
          <div className="flex flex-wrap items-start gap-4">
            <span className="font-display text-4xl font-bold leading-none text-evo-accent" aria-hidden>
              {summary.mood === 'green' ? '▲' : summary.mood === 'red' ? '▼' : '●'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold sm:text-2xl">{mood.title}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${mood.badge}`}>
                  {coach.focus}
                </span>
              </div>
              <p className="mt-1 text-sm text-evo-text/90 sm:text-base">{summary.label}</p>
              <p className="mt-3 rounded-2xl border border-evo-border/60 bg-evo-bg/40 px-3 py-2.5 text-sm font-medium leading-snug">
                <span className="text-evo-accent">Tip del coach · </span>
                {coach.tip}
              </p>
              <p className="mt-2 text-xs text-evo-muted">
                Semana {formatShortDate(summary.current_week.from)} – {formatShortDate(summary.current_week.to)} · vs{' '}
                {formatShortDate(summary.previous_week.from)} – {formatShortDate(summary.previous_week.to)}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="panel space-y-2 p-5">
          <h2 className="font-display text-xl font-bold">Panel del coach</h2>
          <p className="text-sm text-evo-muted">
            Completa una sesión con kilos, repeticiones o tiempo para activar el informe semanal.
          </p>
        </section>
      )}

      <section className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Adherencia"
          value={training ? `${training.adherence_pct}%` : '—'}
          hint={
            training
              ? `${training.sessions_completed}/${training.sessions_planned || '—'} sesiones`
              : 'Sin plan esta semana'
          }
        />
        <KpiCard
          label="Volumen"
          value={training ? `${Math.round(training.volume_this_week / 1000)}k` : '—'}
          hint={
            training?.volume_delta_pct != null
              ? `${training.volume_delta_pct > 0 ? '+' : ''}${training.volume_delta_pct}% vs ant.`
              : 'kg × reps (semana)'
          }
        />
        <KpiCard
          label="Fuerza"
          value={summary ? `${summary.improved}↑` : '—'}
          hint={summary ? `${summary.maintained} igual · ${summary.declined}↓` : 'Comparativa semanal'}
        />
        <KpiCard
          label="Peso corporal"
          value={body?.latest_kg != null ? `${body.latest_kg}` : '—'}
          hint={
            body?.delta_kg != null
              ? `${body.delta_kg > 0 ? '+' : ''}${body.delta_kg} kg vs anterior`
              : 'Registra check-in abajo'
          }
        />
      </section>

      <div className="min-w-0 space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold">Fuerza · semana a semana</h3>
          <p className="text-sm text-evo-muted">
            La gráfica compara kilos. Los ejercicios por tiempo salen en la lista, con su mejor marca.
          </p>
        </div>

        <div className="panel min-w-0 overflow-hidden p-4 lg:p-5">
          <div className="h-56 w-full min-w-0 sm:h-64">
            {(data?.chart.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.chart} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3d4c60" />
                  <XAxis dataKey="name" tick={{ fill: '#c5d0de', fontSize: 11 }} interval={0} height={48} />
                  <YAxis tick={{ fill: '#c5d0de', fontSize: 12 }} unit="kg" width={48} />
                  <Tooltip
                    contentStyle={{ background: '#161e29', border: '1px solid #4a5a70', borderRadius: 12, color: '#f6f8fb' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="semana_anterior" name="Anterior" fill="#7d8da3" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="esta_semana" name="Esta" fill="#ff8a4c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyBlock text="Sin datos de fuerza aún. Entrena y guarda kilos." />
            )}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <HighlightList
            title="Lo que está subiendo"
            empty="Todavía no hay subidas claras esta semana."
            rows={coach?.wins ?? []}
            tone="win"
          />
          <HighlightList
            title="Lo que hay que vigilar"
            empty="Nada preocupante. Buen signo."
            rows={coach?.watch ?? []}
            tone="watch"
          />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-display text-base font-bold">Detalle por ejercicio</h4>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['all', 'Todos'],
                  ['improved', 'Subió'],
                  ['maintained', 'Igual'],
                  ['declined', 'Bajó'],
                  ['new', 'Nuevo'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={[
                    'rounded-lg px-2.5 py-1.5 text-[0.7rem] font-bold transition',
                    filter === key ? 'bg-evo-accent text-[#1a120c]' : 'bg-evo-surface-2 text-evo-muted',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredExercises.length === 0 ? (
            <EmptyBlock text="No hay ejercicios en este filtro." />
          ) : (
            <ul className="space-y-2">
              {filteredExercises.map((row) => (
                <ExerciseRow key={row.name} row={row} />
              ))}
            </ul>
          )}
        </div>
      </div>
      </section>

      <section className="min-w-0 space-y-4">
        <SectionHeading
          kicker="2"
          title="Peso corporal"
          text="Anótalo aparte de las fotos. Mejor siempre a la misma hora."
        />

        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              saveWeight.mutate()
            }}
            className="panel min-w-0 space-y-4 p-4"
          >
            <p className="font-display text-xl font-bold">Registrar peso</p>
            <Input
              label="Fecha"
              type="date"
              value={weightOn}
              onChange={(e) => setWeightOn(e.target.value)}
              required
            />
            <Input
              label="Peso (kg)"
              inputMode="decimal"
              placeholder="ej. 78.5"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              required
            />
            <Button type="submit" fullWidth disabled={saveWeight.isPending}>
              {saveWeight.isPending ? 'Guardando…' : 'Guardar peso'}
            </Button>
          </form>

          <div className="panel min-w-0 space-y-3 overflow-hidden p-4">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">Último registro</p>
                <p className="font-display text-3xl font-bold">
                  {body?.latest_kg != null ? `${body.latest_kg} kg` : '—'}
                </p>
              </div>
              {body?.delta_kg != null ? (
                <p
                  className={[
                    'text-sm font-bold',
                    body.trend === 'down' ? 'text-evo-lime' : body.trend === 'up' ? 'text-evo-warn' : 'text-evo-muted',
                  ].join(' ')}
                >
                  {body.delta_kg > 0 ? '+' : ''}
                  {body.delta_kg} kg
                </p>
              ) : null}
            </div>
            <div className="h-44 w-full">
              {weightChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightChart}>
                    <defs>
                      <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#b6f36a" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#b6f36a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3d4c60" />
                    <XAxis dataKey="fecha" tick={{ fill: '#c5d0de', fontSize: 12 }} />
                    <YAxis
                      tick={{ fill: '#c5d0de', fontSize: 12 }}
                      domain={['dataMin - 1', 'dataMax + 1']}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{ background: '#161e29', border: '1px solid #4a5a70', borderRadius: 12, color: '#f6f8fb' }}
                    />
                    <Area type="monotone" dataKey="kg" name="Kg" stroke="#b6f36a" fill="url(#weightFill)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyBlock text="Sin historial de peso todavía." />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="min-w-0 space-y-4">
        <SectionHeading kicker="3" title="Fotos" text="Una sección distinta del peso. Compara dos fechas cuando quieras." />
      <PhotoCheckIn
        photos={photosQuery.data ?? []}
        recordedOn={photoOn}
        caption={caption}
        photoFile={photoFile}
        uploading={uploadPhoto.isPending}
        onRecordedOn={setPhotoOn}
        onCaption={setCaption}
        onPhotoFile={setPhotoFile}
        onUpload={() => uploadPhoto.mutate()}
      />
      </section>
    </div>
  )
}

function SectionHeading({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return (
    <div className="border-b border-evo-border pb-3">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-evo-accent">{kicker}</p>
      <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-base text-evo-muted">{text}</p>
    </div>
  )
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="panel px-3 py-3 sm:px-4 sm:py-4">
      <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold leading-none sm:text-3xl">{value}</p>
      <p className="mt-1.5 text-[0.7rem] leading-snug text-evo-muted">{hint}</p>
    </div>
  )
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-evo-border px-4 py-6 text-center text-sm text-evo-muted">
      {text}
    </div>
  )
}

function HighlightList({
  title,
  empty,
  rows,
  tone,
}: {
  title: string
  empty: string
  rows: ProgressExerciseRow[]
  tone: 'win' | 'watch'
}) {
  return (
    <div className="panel space-y-2 p-4">
      <p className="text-sm font-bold">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-evo-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.name} className="rounded-xl bg-evo-bg/50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{row.name}</p>
                <span
                  className={[
                    'shrink-0 text-xs font-bold',
                    tone === 'win' ? 'text-evo-lime' : 'text-evo-danger',
                  ].join(' ')}
                >
                  {formatDelta(row)}
                </span>
              </div>
              <p className="mt-0.5 text-[0.7rem] text-evo-muted">
                {formatMark(row, 'previous')} → {formatMark(row, 'current')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ExerciseRow({ row }: { row: ProgressExerciseRow }) {
  const ui = statusUi[row.status]
  return (
    <li className="panel px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ui.className}`}>{statusLabel(row)}</span> {row.name}
          </p>
          <p className="mt-0.5 text-xs text-evo-muted">
            {formatMark(row, 'previous')} → {formatMark(row, 'current')}
            {row.delta_pct != null ? ` · ${row.delta_pct > 0 ? '+' : ''}${row.delta_pct}%` : ''}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ui.className}`}>{statusLabel(row)}</span>
      </div>
      {row.coach_note ? (
        <p className="mt-2 border-t border-evo-border/50 pt-2 text-xs leading-snug text-evo-muted">
          {row.coach_note}
        </p>
      ) : null}
    </li>
  )
}
