import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Icon } from '../../components/icons/Icon'
import { Sheet } from '../../components/ui/Sheet'
import { api, apiErrorMessage } from '../../lib/api'
import { likersQuery, removePostEverywhere, toggleLike, type Post, type PostSummaryExercise } from '../../lib/feed'
import { handle, timeAgo } from '../../lib/social'
import { Avatar } from '../profile/Avatar'
import { EditPostSheet } from './EditPostSheet'
import { CommentsSheet } from './PostComments'
import { WorkoutCover, formatVolume } from './WorkoutCover'

type Props = {
  post: Post
  /** En el detalle se muestran los ejercicios debajo y los comentarios van en la propia página. */
  detailed?: boolean
}

/** Un entreno compartido, al estilo Instagram: autor, foto (o portada), acciones, "me gusta" y texto. */
export function PostCard({ post, detailed = false }: Props) {
  const { notify, confirm } = useUiFeedback()
  const [sheet, setSheet] = useState<'menu' | 'edit' | 'likers' | 'comments' | 'exercises' | null>(null)
  const [captionOpen, setCaptionOpen] = useState(detailed)
  const [burst, setBurst] = useState(0)
  const lastTap = useRef(0)
  const summary = post.summary
  const author = handle(post.author)

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
    setSheet(null)
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
  const longCaption = (post.caption?.length ?? 0) > 110 || (post.caption?.split('\n').length ?? 0) > 2

  return (
    <article className="-mx-4 border-b border-evo-border/50 bg-evo-bg sm:mx-0 sm:overflow-hidden sm:rounded-3xl sm:border sm:bg-evo-surface">
      <header className="flex items-center gap-3 px-3 py-2.5">
        <Link to={`/u/${post.author.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar name={post.author.name} url={post.author.avatar_url} size="sm" />
          <span className="min-w-0 leading-tight">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-[0.95rem] font-bold">{author}</span>
              <span className="shrink-0 text-sm text-evo-muted">· {timeAgo(post.created_at)}</span>
            </span>
            {post.gym_name ? <span className="block truncate text-xs text-evo-muted">{post.gym_name}</span> : null}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setSheet('menu')}
          aria-label="Opciones de la publicación"
          className="-mr-1 flex h-10 w-10 items-center justify-center rounded-full text-evo-text hover:bg-evo-surface-2"
        >
          <Icon name="more" className="h-5 w-5" />
        </button>
      </header>

      <div className="relative select-none" onClick={onMediaTap}>
        {post.photo_url ? (
          <>
            <img src={post.photo_url} alt={`Foto de ${author} entrenando`} loading="lazy" className="aspect-[4/5] w-full bg-evo-surface-2 object-cover" />
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
        {!detailed ? (
          <button type="button" onClick={() => setSheet('comments')} aria-label="Comentarios" className="flex h-11 items-center gap-1 rounded-full px-2.5 text-evo-text">
            <Icon name="comment" className="h-7 w-7" />
            {post.comments_count > 0 ? <span className="text-sm font-bold tabular-nums">{post.comments_count}</span> : null}
          </button>
        ) : null}
        {!detailed && summary.exercises.length > 0 ? (
          <button
            type="button"
            onClick={() => setSheet('exercises')}
            className="ml-auto mr-1.5 flex items-center gap-1.5 rounded-full bg-evo-surface-2 py-1 pl-1 pr-3 text-xs font-bold text-evo-text"
          >
            <span className="flex -space-x-2" aria-hidden>
              {summary.exercises.slice(0, 3).map((exercise, index) =>
                exercise.image_url ? (
                  <img key={index} src={exercise.image_url} alt="" className="h-7 w-7 rounded-full bg-white object-cover ring-2 ring-evo-surface-2" />
                ) : null,
              )}
            </span>
            {summary.exercises.length} {summary.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
          </button>
        ) : null}
      </div>

      <div className="space-y-1 px-4 pb-4">
        {post.likes_count > 0 ? (
          <button type="button" onClick={() => setSheet('likers')} className="flex items-center gap-2 text-left text-sm">
            {post.liked_by ? <Avatar name={post.liked_by.name} url={post.liked_by.avatar_url} size="xs" /> : null}
            <span>
              {post.liked_by ? (
                <>
                  Le gusta a <span className="font-bold">{handle(post.liked_by)}</span>
                  {post.likes_count > 1 ? (
                    <>
                      {' '}y <span className="font-bold">{post.likes_count - 1} más</span>
                    </>
                  ) : null}
                </>
              ) : (
                <span className="font-bold">{post.likes_count} Me gusta</span>
              )}
            </span>
          </button>
        ) : null}

        {post.caption ? (
          <p className={['whitespace-pre-line text-sm leading-snug', captionOpen ? '' : 'line-clamp-2'].join(' ')}>
            <Link to={`/u/${post.author.id}`} className="font-bold">
              {author}
            </Link>{' '}
            {post.caption}
          </p>
        ) : null}
        {post.caption && longCaption && !captionOpen ? (
          <button type="button" onClick={() => setCaptionOpen(true)} className="text-sm text-evo-muted">
            más
          </button>
        ) : null}

        {!detailed && post.comments_count > 0 ? (
          <button type="button" onClick={() => setSheet('comments')} className="block text-sm text-evo-muted">
            {post.comments_count === 1 ? 'Ver 1 comentario' : `Ver los ${post.comments_count} comentarios`}
          </button>
        ) : null}

        {post.edited ? <p className="text-xs text-evo-muted">Editado</p> : null}

        {detailed && summary.exercises.length > 0 ? <ExerciseList exercises={summary.exercises} className="!mt-3" /> : null}
      </div>

      {sheet === 'menu' ? (
        <Sheet title={post.mine ? 'Tu publicación' : author} onClose={() => setSheet(null)}>
          <div className="divide-y divide-evo-border/40 overflow-hidden rounded-2xl bg-evo-surface-2">
            {post.mine ? (
              <>
                <button type="button" onClick={() => setSheet('edit')} className="flex min-h-14 w-full items-center px-4 text-left font-semibold">
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
              <Link to={`/u/${post.author.id}`} className="flex min-h-14 items-center px-4 font-semibold">
                Ver perfil de {author}
              </Link>
            )}
          </div>
        </Sheet>
      ) : null}

      {sheet === 'edit' ? <EditPostSheet post={post} onClose={() => setSheet(null)} /> : null}
      {sheet === 'likers' ? <LikersSheet postId={post.id} onClose={() => setSheet(null)} /> : null}
      {sheet === 'comments' ? <CommentsSheet post={post} onClose={() => setSheet(null)} /> : null}
      {sheet === 'exercises' ? (
        <Sheet title={summary.title} onClose={() => setSheet(null)}>
          <p className="mb-3 text-sm text-evo-muted">{stats.join(' · ')}</p>
          <ExerciseList exercises={summary.exercises} />
        </Sheet>
      ) : null}
    </article>
  )
}

function ExerciseList({ exercises, className = '' }: { exercises: PostSummaryExercise[]; className?: string }) {
  return (
    <ul className={['divide-y divide-evo-border/40 overflow-hidden rounded-2xl bg-evo-surface-2/60', className].join(' ')}>
      {exercises.map((exercise, index) => (
        <li key={`${exercise.name}-${index}`} className="flex items-center gap-3 px-3 py-2.5">
          {exercise.image_url ? (
            <img src={exercise.image_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl bg-white object-cover" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-evo-surface text-evo-muted" aria-hidden>
              <Icon name="catalog" className="h-5 w-5" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{exercise.name}</span>
            <span className="block text-sm text-evo-muted">
              {exercise.sets} {exercise.sets === 1 ? 'serie' : 'series'} · mejor {exercise.best}
            </span>
          </span>
          {exercise.record ? <span className="shrink-0 rounded-full bg-[#ffd166]/20 px-2 py-0.5 text-xs font-bold text-evo-warn">🏆 Récord</span> : null}
        </li>
      ))}
    </ul>
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
                  <span className="block truncate font-bold">{handle(person)}</span>
                  {person.username ? <span className="block truncate text-sm text-evo-muted">{person.name}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
