import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useMemo, useState, type FormEvent } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { PhotoCheckIn } from '../../components/progress/PhotoCheckIn'
import { Button } from '../../components/ui/Button'
import { api, type BodyWeightEntry, type ProgressPhoto } from '../../lib/api'
import { formatShortDate, localDateKey } from '../../lib/dates'
import { prepareProgressPhoto } from '../../lib/preparePhoto'
import { formatKg, shortDate } from '../../lib/progress'

function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 86_400_000)
}

function WeightChange({ label, delta }: { label: string; delta: number | null }) {
  return (
    <div className="rounded-2xl bg-evo-surface-2 px-3 py-2.5">
      <p className="text-xs font-semibold text-evo-muted">{label}</p>
      <p className="font-display text-lg font-bold tabular-nums">
        {delta === null ? '—' : delta === 0 ? '= 0 kg' : `${delta > 0 ? '+' : '−'}${formatKg(Math.abs(delta))}`}
      </p>
    </div>
  )
}

/** Pestaña Cuerpo: peso corporal y fotos de progreso. */
export function BodyTab() {
  const queryClient = useQueryClient()
  const { notify, confirm } = useUiFeedback()
  const today = localDateKey()
  const [weightOn, setWeightOn] = useState(today)
  const [weightKg, setWeightKg] = useState('')
  const [photoOn, setPhotoOn] = useState(today)
  const [caption, setCaption] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [showAll, setShowAll] = useState(false)

  const weights = useQuery({
    queryKey: ['body-weights'],
    queryFn: async () => (await api.get<{ data: BodyWeightEntry[] }>('/progress/body-weight')).data.data,
  })
  const photos = useQuery({
    queryKey: ['progress-photos'],
    queryFn: async () => (await api.get<{ data: ProgressPhoto[] }>('/progress/photos')).data.data,
  })

  // Entradas de la más antigua a la más reciente.
  const entries = useMemo(
    () => [...(weights.data ?? [])].map((e) => ({ ...e, kg: Number(e.weight_kg) })).sort((a, b) => a.recorded_on.localeCompare(b.recorded_on)),
    [weights.data],
  )
  const latest = entries[entries.length - 1]
  const previous = entries[entries.length - 2]
  const monthAgo = latest ? [...entries].reverse().find((e) => daysBetween(latest.recorded_on, e.recorded_on) >= 28) : undefined
  const first = entries[0]
  const chart = entries.slice(-30).map((e) => ({ label: shortDate(e.recorded_on), kg: e.kg }))
  const round = (n: number) => Math.round(n * 10) / 10

  const saveWeight = useMutation({
    mutationFn: async () => api.post('/progress/body-weight', { recorded_on: weightOn, weight_kg: Number(weightKg.replace(',', '.')) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['body-weights'] })
      void queryClient.invalidateQueries({ queryKey: ['progress-insights'] })
      setWeightKg('')
      notify('Peso guardado', 'success')
    },
    onError: () => notify('No se ha podido guardar el peso. Revisa el número.', 'error'),
  })

  const deleteWeight = useMutation({
    mutationFn: async (id: number) => api.delete(`/progress/body-weight/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['body-weights'] })
      notify('Peso borrado', 'success')
    },
    onError: () => notify('No se ha podido borrar', 'error'),
  })

  const uploadPhoto = useMutation({
    mutationFn: async () => {
      if (!photoFile) return
      const ready = await prepareProgressPhoto(photoFile)
      const body = new FormData()
      body.append('recorded_on', photoOn)
      body.append('photo', ready)
      if (caption.trim()) body.append('caption', caption.trim())
      await api.post('/progress/photos', body)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['progress-photos'] })
      setPhotoFile(null)
      setCaption('')
      notify('Foto subida', 'success')
    },
    onError: (error: unknown) => {
      if (error instanceof Error && ['decode', 'blob', 'canvas'].includes(error.message)) {
        notify('No se ha podido leer esa foto. Prueba con otra de la galería.', 'error')
        return
      }
      if (axios.isAxiosError(error) && error.response?.status === 413) {
        notify('La foto pesa demasiado. Prueba con otra más ligera.', 'error')
        return
      }
      notify('No se ha podido subir la foto', 'error')
    },
  })

  async function deletePhoto(photo: ProgressPhoto) {
    const ok = await confirm({
      title: '¿Borrar esta foto?',
      message: 'Se elimina para siempre del servidor.',
      confirmLabel: 'Borrar',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (!ok) return false
    try {
      await api.delete(`/progress/photos/${photo.id}`)
      await queryClient.invalidateQueries({ queryKey: ['progress-photos'] })
      notify('Foto borrada', 'success')
      return true
    } catch {
      notify('No se ha podido borrar la foto', 'error')
      return false
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (weightKg.trim()) saveWeight.mutate()
  }

  const history = [...entries].reverse()

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-evo-border/60 bg-evo-surface p-4 sm:p-5" aria-label="Peso corporal">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Peso corporal</h2>
            <p className="font-display text-4xl font-bold tabular-nums leading-tight">{latest ? formatKg(latest.kg) : '—'}</p>
            {latest ? <p className="text-sm text-evo-muted">Último: {formatShortDate(latest.recorded_on)}</p> : null}
          </div>
        </div>

        {entries.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <WeightChange label="Último cambio" delta={latest && previous ? round(latest.kg - previous.kg) : null} />
            <WeightChange label="Último mes" delta={latest && monthAgo ? round(latest.kg - monthAgo.kg) : null} />
            <WeightChange label="Total" delta={latest && first && first !== latest ? round(latest.kg - first.kg) : null} />
          </div>
        ) : null}

        {chart.length > 1 ? (
          <div className="mt-4 h-48 w-full min-w-0" role="img" aria-label="Gráfica de tu peso corporal">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="bodyWeightFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-evo-chart-2)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-evo-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-evo-border)" strokeOpacity={0.35} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-evo-muted)', fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={40} domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: 'var(--color-evo-muted)', fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v)}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-evo-surface)', border: '1px solid var(--color-evo-border)', borderRadius: 14, color: 'var(--color-evo-text)' }}
                  formatter={(value) => [formatKg(Number(value)), 'Peso']}
                />
                <Area type="monotone" dataKey="kg" stroke="var(--color-evo-chart-2)" strokeWidth={2.5} fill="url(#bodyWeightFill)" dot={{ r: 3, fill: 'var(--color-evo-chart-2)', stroke: 'var(--color-evo-surface)', strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-evo-surface-2 px-4 py-3 text-sm text-evo-muted">
            {entries.length === 0 ? 'Apunta tu peso para empezar a ver la tendencia.' : 'Con un registro más verás la gráfica.'} Mejor siempre a la misma hora, por la mañana.
          </p>
        )}

        <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-2 border-t border-evo-border/40 pt-4">
          <label>
            <span className="mb-1 block text-xs font-semibold text-evo-muted">Peso (kg)</span>
            <input
              inputMode="decimal"
              placeholder="78,5"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="h-12 w-full rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-4 text-lg font-bold tabular-nums text-evo-text placeholder:font-semibold placeholder:text-evo-muted/60 focus:border-evo-accent focus:outline-none"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-evo-muted">Fecha</span>
            <input
              type="date"
              max={today}
              value={weightOn}
              onChange={(e) => setWeightOn(e.target.value)}
              className="h-12 w-full rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-3 text-sm text-evo-text focus:border-evo-accent focus:outline-none"
              required
            />
          </label>
          <Button type="submit" className="col-span-2 !min-h-12" disabled={saveWeight.isPending || !weightKg.trim()}>
            {saveWeight.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>

        {history.length > 0 ? (
          <div className="mt-4">
            <ul className="divide-y divide-evo-border/40">
              {(showAll ? history : history.slice(0, 4)).map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="text-evo-muted">{formatShortDate(entry.recorded_on)}</span>
                  <span className="flex items-center gap-1">
                    <span className="font-bold tabular-nums">{formatKg(entry.kg)}</span>
                    <button
                      type="button"
                      aria-label={`Borrar el peso del ${formatShortDate(entry.recorded_on)}`}
                      disabled={deleteWeight.isPending}
                      onClick={() => deleteWeight.mutate(entry.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-evo-muted hover:bg-evo-danger/15 hover:text-evo-danger"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            {history.length > 4 ? (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-sm font-bold text-evo-accent">
                {showAll ? 'Ver menos' : `Ver los ${history.length} registros`}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-label="Fotos de progreso" className="space-y-2">
        <h2 className="px-1 font-display text-lg font-bold">Fotos de progreso</h2>
        <PhotoCheckIn
          photos={photos.data ?? []}
          recordedOn={photoOn}
          caption={caption}
          photoFile={photoFile}
          uploading={uploadPhoto.isPending}
          onRecordedOn={setPhotoOn}
          onCaption={setCaption}
          onPhotoFile={setPhotoFile}
          onUpload={() => uploadPhoto.mutate()}
          onDelete={deletePhoto}
        />
      </section>
    </div>
  )
}
