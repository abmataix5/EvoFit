import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Icon } from '../../components/icons/Icon'
import { Sheet } from '../../components/ui/Sheet'
import { api, apiErrorMessage } from '../../lib/api'
import { likersQuery, removePostEverywhere, toggleLike, type Post, type PostSummaryExercise } from '../../lib/feed'
import { handle, timeAgo } from '../../lib/social'
import { Avatar } from '../profile/Avatar'
import { EditPostSheet } from './EditPostSheet'
import { CommentsSheet } from './PostComments'
import { formatVolume } from './WorkoutCover'
import { haptic } from '../../lib/haptics'
import { StoryRing } from '../stories/StoriesBar'
import { StoryViewer } from '../stories/StoryViewer'
import { storiesQuery } from '../../lib/stories'

type Props = {
  post: Post
  /** En el detalle se muestran los ejercicios debajo y los comentarios van en la propia página. */
  detailed?: boolean
}

/**
 * Un entreno compartido, en el formato propio de EvoFit: quién, qué entreno y sus cifras en grande,
 * la foto (o los ejercicios si no hay foto) y, abajo, «dar fuerza» y comentar.
 */
export function PostCard({ post, detailed = false }: Props) {
  const { notify, confirm } = useUiFeedback()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<'menu' | 'edit' | 'likers' | 'comments' | 'exercises' | 'story' | null>(null)
  // Si el autor tiene historia activa, su foto lleva el marco y la abre.
  const storyGroup = useQuery({ ...storiesQuery, select: (groups) => groups.find((g) => g.user.id === post.author.id) }).data
  const [captionOpen, setCaptionOpen] = useState(detailed)
  const [burst, setBurst] = useState(0)
  const lastTap = useRef(0)
  const summary = post.summary
  const author = handle(post.author)

  const like = useMutation({
    mutationFn: () => toggleLike(post),
    onError: () => notify('No se ha podido guardar. Revisa la conexión.', 'error'),
  })

  const remove = useMutation({
    mutationFn: async () => api.delete(`/posts/${post.id}`),
    onSuccess: () => {
      removePostEverywhere(post.id)
      notify('Publicación eliminada', 'success')
      // En su propia pantalla ya no queda nada que ver: se vuelve atrás.
      if (detailed) navigate(-1)
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido eliminar.'), 'error'),
  })

  /** Un toque cada vez: si hay una petición en curso se ignora, para que no se crucen dar y quitar. */
  function giveStrength() {
    if (like.isPending) return
    if (!post.liked_by_me) haptic()
    like.mutate()
  }

  // Doble toque en la foto = dar fuerza; nunca la quita.
  function onMediaTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      setBurst((n) => n + 1)
      if (!post.liked_by_me && !like.isPending) {
        haptic()
        like.mutate()
      }
    }
    lastTap.current = now
  }

  async function confirmDelete() {
    setSheet(null)
    const ok = await confirm({
      title: '¿Eliminar esta publicación?',
      message: 'Se borran también sus reacciones y comentarios. Tu entreno no se toca.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (ok) remove.mutate()
  }

  const stats = [
    summary.duration_minutes ? { value: String(summary.duration_minutes), label: 'min' } : null,
    { value: String(summary.sets), label: summary.sets === 1 ? 'serie' : 'series' },
    summary.volume_kg > 0 ? { value: formatVolume(summary.volume_kg), label: 'levantados' } : null,
  ].filter(Boolean) as Array<{ value: string; label: string }>
  const statsText = stats.map((stat) => `${stat.value} ${stat.label}`).join(' · ')
  const longCaption = (post.caption?.length ?? 0) > 110 || (post.caption?.split('\n').length ?? 0) > 2
  const records = summary.records.length
  const preview = summary.exercises.slice(0, 3)
  const others = post.likes_count - 1

  return (
    <article className="overflow-hidden rounded-3xl border border-evo-border/60 bg-evo-surface">
      <header className="flex items-center gap-3 py-2.5 pl-3.5 pr-1.5">
        {storyGroup ? (
          <button type="button" onClick={() => setSheet('story')} aria-label={`Ver la historia de ${author}`} className="flex shrink-0 transition active:scale-95">
            <StoryRing group={storyGroup} size="sm">
              <Avatar name={post.author.name} url={post.author.avatar_url} size="sm" />
            </StoryRing>
          </button>
        ) : null}
        <Link to={`/u/${post.author.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          {!storyGroup ? <Avatar name={post.author.name} url={post.author.avatar_url} size="sm" /> : null}
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[0.95rem] font-bold">{author}</span>
            <span className="block truncate text-xs text-evo-muted">
              {timeAgo(post.created_at)}
              {post.gym_name ? ` · ${post.gym_name}` : ''}
              {post.edited ? ' · editado' : ''}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setSheet('menu')}
          aria-label="Opciones de la publicación"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-evo-muted transition hover:bg-evo-surface-2 active:scale-90"
        >
          <Icon name="more" className="h-5 w-5" />
        </button>
      </header>

      <div className="space-y-3 px-3.5 pb-3">
        <div>
          {records > 0 ? (
            <p className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-evo-warn px-2.5 py-1 text-xs font-extrabold text-[#1a120c]">
              <Icon name="trophy" className="h-3.5 w-3.5" />
              {records === 1 ? summary.records[0] : `${records} récords personales`}
            </p>
          ) : null}
          <h3 className="font-display text-[1.75rem] font-extrabold uppercase leading-none [text-wrap:balance]">{summary.title}</h3>
          {summary.routine_name && summary.routine_name !== summary.title ? (
            <p className="mt-1 truncate text-sm font-semibold text-evo-muted">{summary.routine_name}</p>
          ) : null}
        </div>

        <dl className="grid auto-cols-fr grid-flow-col gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-evo-surface-2 px-3 py-2">
              <dd className="font-display text-2xl font-bold leading-none tabular-nums">{stat.value}</dd>
              <dt className="mt-1 text-[0.7rem] font-bold uppercase tracking-wide text-evo-muted">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      {post.photo_url ? (
        <div className="relative mx-3.5 select-none overflow-hidden rounded-2xl" onClick={onMediaTap}>
          <img
            src={post.photo_url}
            alt={`Foto de ${author} entrenando`}
            loading="lazy"
            decoding="async"
            className="aspect-[4/5] w-full bg-evo-surface-2 object-cover"
          />
          {burst > 0 ? (
            <span key={burst} className="pointer-events-none absolute inset-0 flex items-center justify-center drop-shadow-lg" aria-hidden>
              <Icon name="bolt-filled" className="evo-bolt h-28 w-28 text-evo-accent" />
            </span>
          ) : null}
        </div>
      ) : !detailed && preview.length > 0 ? (
        <button
          type="button"
          onClick={() => setSheet('exercises')}
          aria-label={`Ver los ${summary.exercises.length} ejercicios de ${summary.title}`}
          className="mx-3.5 block w-[calc(100%-1.75rem)] overflow-hidden rounded-2xl bg-evo-surface-2/60 text-left transition active:scale-[0.99]"
        >
          <span className="block divide-y divide-evo-border/30">
            {preview.map((exercise, index) => (
              <ExerciseRow key={`${exercise.name}-${index}`} exercise={exercise} compact />
            ))}
          </span>
          {summary.exercises.length > preview.length ? (
            <span className="flex items-center justify-between gap-2 border-t border-evo-border/30 px-3 py-2 text-sm font-bold text-evo-accent">
              Ver los {summary.exercises.length} ejercicios
              <Icon name="chevron" className="h-4 w-4" />
            </span>
          ) : null}
        </button>
      ) : null}

      {post.caption ? (
        <div className="px-3.5 pt-3">
          <p className={['whitespace-pre-line break-words text-[0.95rem] leading-snug', captionOpen ? '' : 'line-clamp-2'].join(' ')}>{post.caption}</p>
          {longCaption && !captionOpen ? (
            <button type="button" onClick={() => setCaptionOpen(true)} className="-ml-1 min-h-9 px-1 text-sm font-bold text-evo-muted">
              Leer más
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2 px-3.5 pb-3 pt-3">
        <button
          type="button"
          aria-pressed={post.liked_by_me}
          aria-label={post.liked_by_me ? 'Quitar tu fuerza' : 'Dar fuerza'}
          onClick={giveStrength}
          className={[
            'flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-extrabold transition active:scale-90',
            post.liked_by_me ? 'bg-evo-accent text-[#1a120c]' : 'bg-evo-surface-2 text-evo-text',
          ].join(' ')}
        >
          <Icon name={post.liked_by_me ? 'bolt-filled' : 'bolt'} className={['h-5 w-5', post.liked_by_me ? 'evo-pop' : ''].join(' ')} />
          Fuerza
          {post.likes_count > 0 ? <span className="tabular-nums">{post.likes_count}</span> : null}
        </button>
        {!detailed ? (
          <button
            type="button"
            onClick={() => setSheet('comments')}
            aria-label={post.comments_count > 0 ? `Comentarios: ${post.comments_count}` : 'Comentar'}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-evo-surface-2 px-4 text-sm font-extrabold text-evo-text transition active:scale-90"
          >
            <Icon name="comment" className="h-5 w-5" />
            {post.comments_count > 0 ? <span className="tabular-nums">{post.comments_count}</span> : 'Comentar'}
          </button>
        ) : null}
        {!detailed && post.photo_url && summary.exercises.length > 0 ? (
          <button
            type="button"
            onClick={() => setSheet('exercises')}
            className="ml-auto flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-bold text-evo-accent transition active:scale-95"
          >
            {summary.exercises.length} {summary.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
            <Icon name="chevron" className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {post.likes_count > 0 ? (
        <button type="button" onClick={() => setSheet('likers')} className="flex min-h-9 w-full items-center gap-2 border-t border-evo-border/30 px-3.5 py-2 text-left text-sm text-evo-muted">
          {post.liked_by ? <Avatar name={post.liked_by.name} url={post.liked_by.avatar_url} size="xs" /> : null}
          <span className="min-w-0 truncate">
            {post.liked_by ? (
              <>
                <span className="font-bold text-evo-text">{handle(post.liked_by)}</span>
                {others > 0 ? (
                  <>
                    {' '}y <span className="font-bold text-evo-text">{others} más</span> le dan fuerza
                  </>
                ) : (
                  ' le da fuerza'
                )}
              </>
            ) : post.likes_count === 1 && post.liked_by_me ? (
              'Le has dado fuerza'
            ) : (
              <>
                <span className="font-bold text-evo-text">{post.likes_count}</span> {post.likes_count === 1 ? 'persona le da fuerza' : 'personas le dan fuerza'}
              </>
            )}
          </span>
        </button>
      ) : null}

      {detailed && summary.exercises.length > 0 ? (
        <div className="px-3.5 pb-3.5">
          <ExerciseList exercises={summary.exercises} />
        </div>
      ) : null}

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

      {sheet === 'story' && storyGroup ? <StoryViewer groups={[storyGroup]} startGroup={0} onClose={() => setSheet(null)} /> : null}
      {sheet === 'edit' ? <EditPostSheet post={post} onClose={() => setSheet(null)} /> : null}
      {sheet === 'likers' ? <LikersSheet postId={post.id} onClose={() => setSheet(null)} /> : null}
      {sheet === 'comments' ? <CommentsSheet post={post} onClose={() => setSheet(null)} /> : null}
      {sheet === 'exercises' ? (
        <Sheet title={summary.title} onClose={() => setSheet(null)}>
          <p className="mb-3 text-sm text-evo-muted">{statsText}</p>
          <ExerciseList exercises={summary.exercises} />
        </Sheet>
      ) : null}
    </article>
  )
}

function ExerciseRow({ exercise, compact = false }: { exercise: PostSummaryExercise; compact?: boolean }) {
  // Dentro del botón de vista previa no puede haber <li>: ahí cada fila es un <span>.
  const Row = compact ? 'span' : 'li'
  return (
    <Row className={['flex items-center gap-3 px-3', compact ? 'py-2' : 'py-2.5'].join(' ')}>
      {exercise.image_url ? (
        <img src={exercise.image_url} alt="" loading="lazy" className={[compact ? 'h-10 w-10' : 'h-11 w-11', 'shrink-0 rounded-xl bg-white object-cover'].join(' ')} />
      ) : (
        <span className={[compact ? 'h-10 w-10' : 'h-11 w-11', 'flex shrink-0 items-center justify-center rounded-xl bg-evo-surface text-evo-muted'].join(' ')} aria-hidden>
          <Icon name="dumbbell" className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{exercise.name}</span>
        <span className="block truncate text-sm text-evo-muted">
          {exercise.sets} {exercise.sets === 1 ? 'serie' : 'series'} · mejor {exercise.best}
        </span>
      </span>
      {exercise.record ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-evo-warn/20 px-2 py-0.5 text-xs font-bold text-evo-warn">
          <Icon name="trophy" className="h-3.5 w-3.5" />
          Récord
        </span>
      ) : null}
    </Row>
  )
}

function ExerciseList({ exercises, className = '' }: { exercises: PostSummaryExercise[]; className?: string }) {
  return (
    <ul className={['divide-y divide-evo-border/40 overflow-hidden rounded-2xl bg-evo-surface-2/60', className].join(' ')}>
      {exercises.map((exercise, index) => (
        <ExerciseRow key={`${exercise.name}-${index}`} exercise={exercise} />
      ))}
    </ul>
  )
}

function LikersSheet({ postId, onClose }: { postId: number; onClose: () => void }) {
  const likers = useQuery(likersQuery(postId))

  return (
    <Sheet title="Le dan fuerza" onClose={onClose}>
      {likers.isPending ? (
        <div className="space-y-2 py-2" role="status" aria-label="Cargando">
          <div className="evo-skeleton h-12 rounded-2xl" />
          <div className="evo-skeleton h-12 rounded-2xl" />
        </div>
      ) : likers.isError ? (
        <div className="py-6 text-center">
          <p className="text-sm text-evo-muted">No se ha podido cargar la lista.</p>
          <button type="button" onClick={() => void likers.refetch()} className="mt-1 min-h-11 px-4 text-sm font-bold text-evo-accent">
            Reintentar
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-evo-border/40">
          {likers.data.map((person) => (
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
