import { useEffect, useRef, useState } from 'react'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Button } from '../../components/ui/Button'
import { apiErrorMessage, validationErrors } from '../../lib/api'
import { shareWorkout } from '../../lib/feed'
import { prepareProgressPhoto } from '../../lib/preparePhoto'
import { useAuth } from '../auth/AuthContext'
import { SessionReportButton } from '../reports/SessionReportButton'
import type { SessionStats } from './model'

const HOME_VIEW_KEY = 'evofit:home-view'

export function WorkoutSummary({
  sessionId,
  title,
  stats,
  minutes,
  onDone,
}: {
  sessionId: number
  title: string
  stats: SessionStats
  minutes: number | null
  /** shared: se ha publicado en el feed (se vuelve al inicio con la vista de amigos). */
  onDone: (shared: boolean) => void
}) {
  const hasRecords = stats.records.length > 0
  const canShare = stats.doneSets > 0
  const { user } = useAuth()
  const { notify } = useUiFeedback()
  const [share, setShare] = useState(canShare)
  const [caption, setCaption] = useState('')
  const [gym, setGym] = useState(user?.gym_name ?? '')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!photo) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  async function finish() {
    if (!share || !canShare) {
      onDone(false)
      return
    }
    setPublishing(true)
    try {
      await shareWorkout(sessionId, {
        caption: caption.trim(),
        gym_name: gym.trim(),
        photo: photo ? await prepareProgressPhoto(photo) : null,
      })
      try {
        localStorage.setItem(HOME_VIEW_KEY, 'friends')
      } catch {
        // Sin almacenamiento: no pasa nada.
      }
      notify('Compartido con tus amigos 💪', 'success')
      onDone(true)
    } catch (error) {
      const message = Object.values(validationErrors(error))[0]
      notify(message ?? apiErrorMessage(error, 'No se ha podido compartir. Tu entreno está guardado.'), 'error')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      <div className="panel space-y-1 p-5 text-center">
        <p className="text-5xl" aria-hidden>
          {hasRecords ? '🔥' : '💪'}
        </p>
        <h1 className="font-display text-3xl font-bold">Sesión completada</h1>
        <p className="text-evo-muted">{title}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Series" value={`${stats.doneSets}`} />
        <Stat label="Volumen" value={stats.volumeKg > 0 ? `${stats.volumeKg.toLocaleString('es-ES')} kg` : '—'} />
        <Stat label="Duración" value={minutes != null ? `${minutes} min` : '—'} />
      </div>

      {hasRecords ? (
        <div className="panel space-y-3 p-5">
          <h2 className="font-display text-xl font-bold">Récords de hoy</h2>
          <ul className="space-y-2">
            {stats.records.map((record) => (
              <li key={record.exercise} className="rounded-2xl bg-evo-warn/10 px-4 py-3">
                <p className="font-bold">{record.exercise}</p>
                <p className="text-sm text-evo-warn">{record.label}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canShare ? (
        <section className={['panel space-y-4 p-4 transition', share ? '' : 'opacity-80'].join(' ')}>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block font-display text-lg font-bold">Compartir con amigos</span>
              <span className="block text-sm text-evo-muted">
                {user?.profile_visibility === 'private'
                  ? 'Tu perfil es privado: solo lo verás tú.'
                  : user?.profile_visibility === 'public'
                    ? 'Lo verán tus amigos y cualquiera que visite tu perfil.'
                    : 'Lo verán tus amigos en su feed.'}
              </span>
            </span>
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="h-6 w-6 shrink-0 accent-evo-accent" />
          </label>

          {share ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) setPhoto(file)
                }}
              />
              {preview ? (
                <div className="relative overflow-hidden rounded-2xl">
                  <img src={preview} alt="Foto que vas a compartir" className="max-h-80 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1.5 text-sm font-bold text-white"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-evo-border text-evo-muted transition active:scale-[0.99]"
                >
                  <span className="text-2xl" aria-hidden>
                    📸
                  </span>
                  <span className="text-sm font-bold">Añadir una foto (opcional)</span>
                </button>
              )}
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">¿Qué tal ha ido?</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Opcional: cómo te has sentido, un logro…"
                  className="w-full resize-none rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-4 py-3 text-base text-evo-text placeholder:text-evo-muted/80 focus:border-evo-accent focus:outline-none"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">📍 Gimnasio</span>
                <input
                  value={gym}
                  maxLength={80}
                  onChange={(e) => setGym(e.target.value)}
                  placeholder="Dónde has entrenado (opcional)"
                  className="w-full rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-4 py-3 text-base text-evo-text placeholder:text-evo-muted/80 focus:border-evo-accent focus:outline-none"
                />
              </label>
            </>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-2">
        <Button size="lg" fullWidth disabled={publishing} onClick={() => void finish()}>
          {publishing ? 'Publicando…' : share && canShare ? 'Publicar y terminar' : 'Terminar'}
        </Button>
        <SessionReportButton sessionId={sessionId} size="lg" fullWidth label="Descargar resumen en PDF" />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
