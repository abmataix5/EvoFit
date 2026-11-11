import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Icon } from '../../components/icons/Icon'
import { Sheet } from '../../components/ui/Sheet'
import { api, apiErrorMessage } from '../../lib/api'
import { removePostEverywhere, toggleLike, type Post } from '../../lib/feed'
import { timeAgo } from '../../lib/social'
import { Avatar } from '../profile/Avatar'

type Props = {
  post: Post
  /** En el detalle se muestran todos los ejercicios y no el resumen de comentarios. */
  detailed?: boolean
}

function formatVolume(kg: number) {
  return kg >= 10000 ? `${(kg / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} t` : `${kg.toLocaleString('es-ES')} kg`
}

/** Un entreno compartido: autor, foto, resumen, récords, "me gusta" y comentarios. */
export function PostCard({ post, detailed = false }: Props) {
  const { notify, confirm } = useUiFeedback()
  const [menuOpen, setMenuOpen] = useState(false)
  const [burst, setBurst] = useState(0)
  const lastTap = useRef(0)
  const summary = post.summary
  const exercises = detailed ? summary.exercises : summary.exercises.slice(0, 3)
  const hidden = summary.exercises.length - exercises.length

  const like = useMutation({
    mutationFn: () => toggleLike(post),
    onError: () => notify('No se ha podido guardar el «me gusta».', 'error'),
  })

  const remove = useMutation({
    mutationFn: async () => api.delete(`/posts/${post.id}`),
    onSuccess: () => {
      removePostEverywhere(post.id)
      notify('Publicación eliminada', 'success')
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido eliminar.'), 'error'),
  })

  // Doble toque en la foto = "me gusta" (como en Instagram); nunca lo quita.
  function onPhotoTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      setBurst((n) => n + 1)
      if (!post.liked_by_me && !like.isPending) like.mutate()
    }
    lastTap.current = now
  }

  async function confirmDelete() {
    setMenuOpen(false)
    const ok = await confirm({
      title: '¿Eliminar esta publicación?',
      message: 'Se borran también sus «me gusta» y comentarios. Tu entreno no se toca.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (ok) remove.mutate()
  }

  const stats = [
    summary.duration_minutes ? { label: 'Tiempo', value: `${summary.duration_minutes} min` } : null,
    { label: 'Series', value: String(summary.sets) },
    summary.volume_kg > 0 ? { label: 'Volumen', value: formatVolume(summary.volume_kg) } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>

  return (
    <article className="overflow-hidden rounded-3xl border border-evo-border/60 bg-evo-surface">
      <header className="flex items-center gap-3 px-4 pt-3.5">
        <Link to={`/u/${post.author.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={post.author.name} url={post.author.avatar_url} />
          <span className="min-w-0">
            <span className="block truncate font-bold">{post.author.name}</span>
            <span className="block truncate text-xs text-evo-muted">
              {timeAgo(post.created_at)}
              {post.gym_name ? ` · 📍 ${post.gym_name}` : ''}
            </span>
          </span>
        </Link>
        {post.mine ? (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Opciones de la publicación"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-evo-muted hover:bg-evo-surface-2"
          >
            <Icon name="more" className="h-5 w-5" />
          </button>
        ) : null}
      </header>

      <div className="px-4 pb-3 pt-3">
        <Link to={`/posts/${post.id}`} className="block">
          <h3 className="font-display text-xl font-bold leading-tight">{summary.title}</h3>
          {summary.routine_name && summary.routine_name !== summary.title ? (
            <p className="text-sm text-evo-muted">{summary.routine_name}</p>
          ) : null}
        </Link>
        <dl className="mt-3 flex gap-5">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs font-semibold text-evo-muted">{stat.label}</dt>
              <dd className="font-display text-lg font-bold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
        {summary.records.length > 0 ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-evo-warn/15 px-3 py-1 text-sm font-bold text-evo-warn">
            🏆 {summary.records.length === 1 ? `Récord en ${summary.records[0]}` : `${summary.records.length} récords personales`}
          </p>
        ) : null}
      </div>

      {post.photo_url ? (
        <div className="relative select-none bg-evo-surface-2" onClick={onPhotoTap}>
          <img src={post.photo_url} alt={`Foto de ${post.author.name} entrenando`} loading="lazy" className="max-h-[70vh] w-full object-cover" />
          {burst > 0 ? (
            <span key={burst} className="pointer-events-none absolute inset-0 flex items-center justify-center drop-shadow-lg" aria-hidden>
              <Icon name="heart-filled" className="evo-heart h-24 w-24 text-white" />
            </span>
          ) : null}
        </div>
      ) : null}

      {exercises.length > 0 ? (
        <ul className="divide-y divide-evo-border/40 border-t border-evo-border/40">
          {exercises.map((exercise, index) => (
            <li key={`${exercise.name}-${index}`} className="flex items-center gap-3 px-4 py-2">
              {exercise.image_url ? (
                <img src={exercise.image_url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg bg-white object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-evo-surface-2 text-evo-muted" aria-hidden>
                  <Icon name="catalog" className="h-4 w-4" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {exercise.name}
                  {exercise.record ? <span className="ml-1.5" aria-label="récord">🏆</span> : null}
                </span>
                <span className="block text-xs text-evo-muted">
                  {exercise.sets} {exercise.sets === 1 ? 'serie' : 'series'} · mejor {exercise.best}
                </span>
              </span>
            </li>
          ))}
          {hidden > 0 ? (
            <li>
              <Link to={`/posts/${post.id}`} className="block px-4 py-2 text-sm font-semibold text-evo-muted">
                +{hidden} {hidden === 1 ? 'ejercicio más' : 'ejercicios más'}
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="flex items-center gap-1 border-t border-evo-border/40 px-2 py-1">
        <button
          type="button"
          aria-pressed={post.liked_by_me}
          aria-label={post.liked_by_me ? 'Quitar me gusta' : 'Me gusta'}
          onClick={() => like.mutate()}
          className={[
            'flex min-h-11 items-center gap-1.5 rounded-full px-3 font-bold transition active:scale-90',
            post.liked_by_me ? 'text-evo-danger' : 'text-evo-muted hover:text-evo-text',
          ].join(' ')}
        >
          <Icon name={post.liked_by_me ? 'heart-filled' : 'heart'} className="h-6 w-6" />
          <span className="tabular-nums">{post.likes_count > 0 ? post.likes_count : ''}</span>
        </button>
        <Link
          to={`/posts/${post.id}`}
          aria-label="Comentar"
          className="flex min-h-11 items-center gap-1.5 rounded-full px-3 font-bold text-evo-muted hover:text-evo-text"
        >
          <Icon name="comment" className="h-6 w-6" />
          <span className="tabular-nums">{post.comments_count > 0 ? post.comments_count : ''}</span>
        </Link>
      </div>

      {post.caption ? (
        <p className="whitespace-pre-line px-4 pb-2 text-[0.95rem] leading-snug">
          <Link to={`/u/${post.author.id}`} className="font-bold">
            {post.author.name}
          </Link>{' '}
          {post.caption}
        </p>
      ) : null}

      {!detailed && post.comments_count > 0 ? (
        <div className="space-y-1 px-4 pb-3">
          {post.comments_count > post.comments_preview.length ? (
            <Link to={`/posts/${post.id}`} className="block text-sm text-evo-muted">
              Ver los {post.comments_count} comentarios
            </Link>
          ) : null}
          {post.comments_preview.map((comment) => (
            <p key={comment.id} className="text-sm leading-snug">
              <span className="font-bold">{comment.author.name}</span> {comment.body}
            </p>
          ))}
        </div>
      ) : null}

      {!detailed && post.comments_count === 0 ? (
        <Link to={`/posts/${post.id}`} className="block px-4 pb-3 text-sm text-evo-muted">
          Añade un comentario…
        </Link>
      ) : null}

      {menuOpen ? (
        <Sheet title="Tu publicación" onClose={() => setMenuOpen(false)}>
          <div className="divide-y divide-evo-border/40 overflow-hidden rounded-2xl bg-evo-surface-2">
            {post.workout_session_id ? (
              <Link to={`/workout/${post.workout_session_id}`} className="flex min-h-14 items-center px-4 font-semibold">
                Ver el entreno
              </Link>
            ) : null}
            <button type="button" onClick={() => void confirmDelete()} className="flex min-h-14 w-full items-center px-4 text-left font-semibold text-evo-danger">
              Eliminar publicación
            </button>
          </div>
        </Sheet>
      ) : null}
    </article>
  )
}
