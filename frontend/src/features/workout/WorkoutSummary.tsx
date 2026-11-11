import { useState } from 'react'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Button } from '../../components/ui/Button'
import { apiErrorMessage, validationErrors, type WorkoutSession } from '../../lib/api'
import { shareWorkout } from '../../lib/feed'
import { prepareProgressPhoto } from '../../lib/preparePhoto'
import { useAuth } from '../auth/AuthContext'
import { PostComposer, composerDirty, composerFrom } from '../feed/PostComposer'
import { SessionReportButton } from '../reports/SessionReportButton'
import type { SessionStats } from './model'

const HOME_VIEW_KEY = 'evofit:home-view'

type ExistingPost = NonNullable<WorkoutSession['post']>

export function WorkoutSummary({
  sessionId,
  title,
  stats,
  minutes,
  existingPost,
  onDone,
}: {
  sessionId: number
  title: string
  stats: SessionStats
  minutes: number | null
  /** Si ya se compartió, se ofrece editar la publicación en vez de publicarla otra vez. */
  existingPost: ExistingPost | null
  /** shared: se ha publicado o editado en el feed (se vuelve al inicio con la vista de amigos). */
  onDone: (shared: boolean) => void
}) {
  const hasRecords = stats.records.length > 0
  const canShare = stats.doneSets > 0
  const { user } = useAuth()
  const { notify } = useUiFeedback()
  const [original] = useState(() => composerFrom(existingPost, user?.gym_name ?? ''))
  const [value, setValue] = useState(original)
  // Nuevo: compartir viene activado. Ya publicado: solo si quieres editar.
  const [active, setActive] = useState(existingPost ? false : canShare)
  const [publishing, setPublishing] = useState(false)

  const willPublish = canShare && active && (!existingPost || composerDirty(value, original))

  async function finish() {
    if (!willPublish) {
      onDone(false)
      return
    }
    setPublishing(true)
    try {
      await shareWorkout(sessionId, {
        caption: value.caption.trim(),
        gym_name: value.gym.trim(),
        photo: value.photo ? await prepareProgressPhoto(value.photo) : null,
        remove_photo: value.removePhoto && !value.photo,
      })
      try {
        localStorage.setItem(HOME_VIEW_KEY, 'friends')
      } catch {
        // Sin almacenamiento: no pasa nada.
      }
      notify(existingPost ? 'Publicación actualizada' : 'Compartido con tus amigos 💪', 'success')
      onDone(true)
    } catch (error) {
      notify(Object.values(validationErrors(error))[0] ?? apiErrorMessage(error, 'No se ha podido publicar. Tu entreno está guardado.'), 'error')
    } finally {
      setPublishing(false)
    }
  }

  const audience =
    user?.profile_visibility === 'private'
      ? 'Tu perfil es privado: solo lo verás tú.'
      : user?.profile_visibility === 'public'
        ? 'Lo verán tus amigos y quien visite tu perfil.'
        : 'Lo verán tus amigos en su feed.'

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

      {canShare && existingPost ? (
        <section className="panel space-y-4 p-4">
          <div className="flex items-center gap-3">
            {existingPost.photo_url ? (
              <img src={existingPost.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff9d68] to-[#f0623c] text-2xl" aria-hidden>
                🎉
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold">✓ Ya está en el feed</p>
              <p className="truncate text-sm text-evo-muted">{existingPost.caption || 'Sin pie de foto'}</p>
            </div>
            {!active ? (
              <Button variant="secondary" className="!min-h-10 shrink-0" onClick={() => setActive(true)}>
                Editar
              </Button>
            ) : null}
          </div>
          {active ? <PostComposer value={value} onChange={setValue} /> : null}
          {active ? <p className="text-xs text-evo-muted">Los datos del entreno de la publicación se actualizan al guardar.</p> : null}
        </section>
      ) : null}

      {canShare && !existingPost ? (
        <section className="panel space-y-4 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block font-display text-lg font-bold">Compartir con amigos</span>
              <span className="block text-sm text-evo-muted">{audience}</span>
            </span>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-6 w-6 shrink-0 accent-evo-accent" />
          </label>
          {active ? <PostComposer value={value} onChange={setValue} /> : null}
        </section>
      ) : null}

      <div className="space-y-2">
        <Button size="lg" fullWidth disabled={publishing} onClick={() => void finish()}>
          {publishing ? 'Guardando…' : willPublish ? (existingPost ? 'Guardar cambios y terminar' : 'Publicar y terminar') : 'Terminar'}
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
