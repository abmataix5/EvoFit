import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Icon } from '../../components/icons/Icon'
import { Sheet } from '../../components/ui/Sheet'
import { api, apiErrorMessage } from '../../lib/api'
import { likersQuery, removePostEverywhere, toggleLike, type Post } from '../../lib/feed'
import { timeAgo } from '../../lib/social'
import { Avatar } from '../profile/Avatar'
import { EditPostSheet } from './EditPostSheet'
import { WorkoutCover, formatVolume } from './WorkoutCover'

type Props = {
  post: Post
  /** En el detalle se muestran todos los ejercicios y no el resumen de comentarios. */
  detailed?: boolean
}

function longTimeAgo(iso: string) {
  const short = timeAgo(iso)
  if (short === 'ahora') return 'Ahora mismo'
  if (/^\d+ (min|h|d)$/.test(short)) {
    const [n, unit] = short.split(' ')
    const words = { min: ['minuto', 'minutos'], h: ['hora', 'horas'], d: ['día', 'días'] }[unit as 'min' | 'h' | 'd']
    return `Hace ${n} ${Number(n) === 1 ? words[0] : words[1]}`
  }
  return short
}

/** Un entreno compartido, al estilo Instagram: autor, foto (o portada), acciones, "me gusta", texto y comentarios. */
export function PostCard({ post, detailed = false }: Props) {
  const { notify, confirm } = useUiFeedback()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [likersOpen, setLikersOpen] = useState(false)
  const [captionOpen, setCaptionOpen] = useState(detailed)
  const [burst, setBurst] = useState(0)
  const lastTap = useRef(0)
  const summary = post.summary

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

  // Doble toque en la imagen = "me gusta" (como en Instagram); nunca lo quita.
  function onMediaTap() {
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
    summary.duration_minutes ? `${summary.duration_minutes} min` : null,
    `${summary.sets} ${summary.sets === 1 ? 'serie' : 'series'}`,
    summary.volume_kg > 0 ? formatVolume(summary.volume_kg) : null,
  ].filter(Boolean) as string[]

  const longCaption = (post.caption?.length ?? 0) > 120 || (post.caption?.split('\n').length ?? 0) > 2

  return (
    <article className="-mx-4 border-y border-evo-border/50 bg-evo-surface sm:mx-0 sm:overflow-hidden sm:rounded-3xl sm:border">
      <header className="flex items-center gap-3 px-3 py-2.5">
        <Link to={`/u/${post.author.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="rounded-full bg-gradient-to-tr from-[#ffd166] via-evo-accent to-[#e8553d] p-[2px]">
            <span className="block rounded-full bg-evo-surface p-[2px]">
              <Avatar name={post.author.name} url={post.author.avatar_url} size="sm" />
            </span>
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[0.95rem] font-bold">{post.author.name}</span>
            {post.gym_name ? <span className="block truncate text-xs text-evo-muted">{post.gym_name}</span> : null}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Opciones de la publicación"
          className="-mr-1 flex h-10 w-10 items-center justify-center rounded-full text-evo-muted hover:bg-evo-surface-2"
        >
          <Icon name="more" className="h-5 w-5" />
        </button>
      </header>

      <div className="relative select-none" onClick={onMediaTap}>
        {post.photo_url ? (
          <>
            <img src={post.photo_url} alt={`Foto de ${post.author.name} entrenando`} loading="lazy" className="aspect-[4/5] w-full bg-evo-surface-2 object-cover" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-3 pt-14 text-white">
              <p className="font-display text-2xl font-bold leading-tight drop-shadow">{summary.title}</p>
              <p className="mt-0.5 text-sm font-semibold text-white/90">{stats.join(' · ')}</p>
            </div>
            {summary.records.length > 0 ? (
              <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-[#ffd166] px-3 py-1 text-xs font-extrabold text-[#1a120c] shadow">
                🏆 {summary.records.length === 1 ? 'Récord personal' : `${summary.records.length} récords`}
              </span>
            ) : null}
          </>
        ) : (
          <WorkoutCover summary={summary} seed={post.id} />
        )}
        {burst > 0 ? (
          <span key={burst} className="pointer-events-none absolute inset-0 flex items-center justify-center drop-shadow-lg" aria-hidden>
            <Icon name="heart-filled" className="evo-heart h-24 w-24 text-white" />
          </span>
        ) : null}
      </div>

      <div className="flex items-center px-1.5 pt-1">
        <button
          type="button"
          aria-pressed={post.liked_by_me}
          aria-label={post.liked_by_me ? 'Quitar me gusta' : 'Me gusta'}
          onClick={() => like.mutate()}
          className={[
            'flex h-11 w-11 items-center justify-center rounded-full transition active:scale-75',
            post.liked_by_me ? 'text-[#ff3b5c]' : 'text-evo-text',
          ].join(' ')}
        >
          <Icon name={post.liked_by_me ? 'heart-filled' : 'heart'} className={['h-7 w-7', post.liked_by_me ? 'evo-pop' : ''].join(' ')} />
        </button>
        <Link to={`/posts/${post.id}`} aria-label="Comentar" className="flex h-11 w-11 items-center justify-center rounded-full text-evo-text">
          <Icon name="comment" className="h-7 w-7" />
        </Link>
        {!detailed && summary.exercises.length > 0 ? (
          <Link to={`/posts/${post.id}`} className="ml-auto mr-2 rounded-full bg-evo-surface-2 px-3 py-1.5 text-xs font-bold text-evo-muted">
            {summary.exercises.length} {summary.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
          </Link>
        ) : null}
      </div>

      <div className="space-y-1 px-4 pb-3">
        {post.likes_count > 0 ? (
          <button type="button" onClick={() => setLikersOpen(true)} className="block text-left text-sm">
            {post.liked_by_name ? (
              <>
                Le gusta a <span className="font-bold">{post.liked_by_name}</span>
                {post.likes_count > 1 ? (
                  <>
                    {' '}y <span className="font-bold">{post.likes_count - 1} más</span>
                  </>
                ) : null}
              </>
            ) : (
              <span className="font-bold">{post.likes_count} Me gusta</span>
            )}
          </button>
        ) : null}

        {post.caption ? (
          <p className={['whitespace-pre-line text-sm leading-snug', captionOpen ? '' : 'line-clamp-2'].join(' ')}>
            <Link to={`/u/${post.author.id}`} className="font-bold">
              {post.author.name}
            </Link>{' '}
            {post.caption}
          </p>
        ) : null}
        {post.caption && longCaption && !captionOpen ? (
          <button type="button" onClick={() => setCaptionOpen(true)} className="text-sm text-evo-muted">
            más
          </button>
        ) : null}

        {detailed && summary.exercises.length > 0 ? (
          <ul className="!mt-3 divide-y divide-evo-border/40 overflow-hidden rounded-2xl bg-evo-surface-2/60">
            {summary.exercises.map((exercise, index) => (
              <li key={`${exercise.name}-${index}`} className="flex items-center gap-3 px-3 py-2">
                {exercise.image_url ? (
                  <img src={exercise.image_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg bg-white object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-evo-surface text-evo-muted" aria-hidden>
                    <Icon name="catalog" className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{exercise.name}</span>
                  <span className="block text-xs text-evo-muted">
                    {exercise.sets} {exercise.sets === 1 ? 'serie' : 'series'} · mejor {exercise.best}
                  </span>
                </span>
                {exercise.record ? (
                  <span className="shrink-0 rounded-full bg-[#ffd166]/20 px-2 py-0.5 text-xs font-bold text-evo-warn">🏆 Récord</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {!detailed && post.comments_count > post.comments_preview.length ? (
          <Link to={`/posts/${post.id}`} className="block text-sm text-evo-muted">
            Ver los {post.comments_count} comentarios
          </Link>
        ) : null}
        {!detailed
          ? post.comments_preview.map((comment) => (
              <p key={comment.id} className="line-clamp-2 text-sm leading-snug">
                <span className="font-bold">{comment.author.name}</span> {comment.body}
              </p>
            ))
          : null}
        {!detailed && post.comments_count === 0 ? (
          <Link to={`/posts/${post.id}`} className="block text-sm text-evo-muted">
            Añade un comentario…
          </Link>
        ) : null}

        <p className="pt-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-evo-muted">
          {longTimeAgo(post.created_at)}
          {post.edited ? ' · Editado' : ''}
        </p>
      </div>

      {menuOpen ? (
        <Sheet title={post.mine ? 'Tu publicación' : post.author.name} onClose={() => setMenuOpen(false)}>
          <div className="divide-y divide-evo-border/40 overflow-hidden rounded-2xl bg-evo-surface-2">
            {post.mine ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setEditing(true)
                  }}
                  className="flex min-h-14 w-full items-center px-4 text-left font-semibold"
                >
                  Editar
                </button>
                {post.workout_session_id ? (
                  <Link to={`/workout/${post.workout_session_id}`} className="flex min-h-14 items-center px-4 font-semibold">
                    Ver el entreno
                  </Link>
                ) : null}
                <button type="button" onClick={() => void confirmDelete()} className="flex min-h-14 w-full items-center px-4 text-left font-semibold text-evo-danger">
                  Eliminar
                </button>
              </>
            ) : (
              <>
                <Link to={`/posts/${post.id}`} className="flex min-h-14 items-center px-4 font-semibold">
                  Ver detalle del entreno
                </Link>
                <Link to={`/u/${post.author.id}`} className="flex min-h-14 items-center px-4 font-semibold">
                  Ver perfil de {post.author.name}
                </Link>
              </>
            )}
          </div>
        </Sheet>
      ) : null}

      {editing ? <EditPostSheet post={post} onClose={() => setEditing(false)} /> : null}
      {likersOpen ? <LikersSheet postId={post.id} onClose={() => setLikersOpen(false)} /> : null}
    </article>
  )
}

function LikersSheet({ postId, onClose }: { postId: number; onClose: () => void }) {
  const likers = useQuery(likersQuery(postId))

  return (
    <Sheet title="Me gusta" onClose={onClose}>
      {likers.isLoading ? (
        <p className="py-6 text-center text-sm text-evo-muted">Cargando…</p>
      ) : (
        <ul className="divide-y divide-evo-border/40">
          {(likers.data ?? []).map((person) => (
            <li key={person.id}>
              <Link to={`/u/${person.id}`} className="flex items-center gap-3 py-2.5">
                <Avatar name={person.name} url={person.avatar_url} />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{person.name}</span>
                  {person.username ? <span className="block truncate text-sm text-evo-muted">@{person.username}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
