import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/icons/Icon'
import { personPostsQuery, type Post } from '../../lib/feed'
import { formatVolume } from './WorkoutCover'

function shortDate(post: Post) {
  const day = post.summary.trained_on
  const date = day ? new Date(`${day}T12:00:00`) : new Date(post.created_at)
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/** Ficha de un entreno: su foto de fondo (si la tiene), el día, las cifras y la fuerza recibida. */
function Tile({ post }: { post: Post }) {
  const { summary } = post
  const record = summary.records.length > 0
  const photo = Boolean(post.photo_url)
  const figures = [
    `${summary.sets} ${summary.sets === 1 ? 'serie' : 'series'}`,
    summary.volume_kg > 0 ? formatVolume(summary.volume_kg) : summary.duration_minutes ? `${summary.duration_minutes} min` : null,
  ].filter(Boolean)

  return (
    <Link
      to={`/posts/${post.id}`}
      className={[
        'group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl border border-evo-border/50 p-3 transition active:scale-[0.97]',
        photo ? 'text-white' : 'bg-gradient-to-br from-evo-accent/25 via-evo-surface to-evo-surface text-evo-text',
      ].join(' ')}
      aria-label={`${summary.title}, ${shortDate(post)}. Ver entreno`}
    >
      {photo ? (
        <>
          <img src={post.photo_url!} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" aria-hidden />
        </>
      ) : (
        <Icon name="dumbbell" className="absolute -right-3 top-8 h-24 w-24 -rotate-12 text-evo-accent/20" />
      )}

      <span className="absolute inset-x-2.5 top-2.5 flex items-center justify-between gap-2">
        <span className={['rounded-full px-2 py-0.5 text-[0.7rem] font-bold', photo ? 'bg-black/45 text-white' : 'bg-evo-surface-2 text-evo-muted'].join(' ')}>
          {shortDate(post)}
        </span>
        {record ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-evo-warn text-[#1a120c]" role="img" aria-label="Con récord personal">
            <Icon name="trophy" className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </span>

      <span className="relative">
        <span className="line-clamp-2 font-display text-xl font-extrabold uppercase leading-none">{summary.title}</span>
        <span className={['mt-1 block truncate text-xs font-semibold', photo ? 'text-white/85' : 'text-evo-muted'].join(' ')}>{figures.join(' · ')}</span>
        {post.likes_count > 0 || post.comments_count > 0 ? (
          <span className={['mt-1.5 flex items-center gap-2.5 text-xs font-bold', photo ? 'text-white' : 'text-evo-text'].join(' ')}>
            {post.likes_count > 0 ? (
              <span className="flex items-center gap-0.5">
                <Icon name="bolt-filled" className="h-3.5 w-3.5 text-evo-accent" />
                {post.likes_count}
              </span>
            ) : null}
            {post.comments_count > 0 ? (
              <span className="flex items-center gap-0.5">
                <Icon name="comment" className="h-3.5 w-3.5" />
                {post.comments_count}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </Link>
  )
}

/** Entrenos compartidos de una persona, en fichas a dos columnas; carga más al bajar. */
export function PostGrid({ userId, emptyText }: { userId: number; emptyText: string }) {
  const query = useInfiniteQuery(personPostsQuery(userId))
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage()
    }, { rootMargin: '400px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (query.isPending) {
    return (
      <div className="grid grid-cols-2 gap-2.5" role="status" aria-label="Cargando entrenos">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="evo-skeleton aspect-[4/5] rounded-2xl" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="rounded-3xl bg-evo-surface p-5 text-center">
        <p className="text-sm text-evo-muted">No se han podido cargar los entrenos.</p>
        <button type="button" onClick={() => void query.refetch()} className="mt-1 min-h-11 px-4 text-sm font-bold text-evo-accent">
          Reintentar
        </button>
      </div>
    )
  }

  const posts = query.data.pages.flatMap((p) => p.data)
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-evo-border px-6 py-10 text-center">
        <span className="evo-shape flex h-14 w-14 items-center justify-center bg-evo-surface-2 text-evo-muted" aria-hidden>
          <Icon name="dumbbell" className="h-7 w-7" />
        </span>
        <p className="font-display text-2xl font-bold">Aún no hay entrenos</p>
        <p className="text-sm text-evo-muted">{emptyText}</p>
      </div>
    )
  }

  return (
    <>
      <div className="evo-stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {posts.map((post) => (
          <Tile key={post.id} post={post} />
        ))}
      </div>
      <div ref={sentinel} />
      {isFetchingNextPage ? <div className="evo-skeleton mt-2.5 h-16 rounded-2xl" role="status" aria-label="Cargando más" /> : null}
    </>
  )
}
