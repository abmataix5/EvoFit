import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { personPostsQuery, type Post } from '../../lib/feed'

/** Miniatura de un entreno: su foto o una mini portada de color con el día. */
function Tile({ post }: { post: Post }) {
  const record = post.summary.records.length > 0
  return (
    <Link to={`/posts/${post.id}`} className="group relative block aspect-square overflow-hidden bg-evo-surface-2" aria-label={`${post.summary.title}, ver entreno`}>
      {post.photo_url ? (
        <img src={post.photo_url} alt="" loading="lazy" className="h-full w-full object-cover transition group-active:scale-95" />
      ) : (
        <span
          className={[
            'flex h-full w-full flex-col items-center justify-center gap-0.5 px-2 text-center text-[#1a120c]',
            record ? 'bg-gradient-to-br from-[#ffb347] via-[#ff8a4c] to-[#e8553d]' : 'bg-gradient-to-br from-[#ff9d68] via-[#ff8a4c] to-[#f0623c]',
          ].join(' ')}
        >
          <span className="text-2xl" aria-hidden>
            {record ? '🏆' : '🎉'}
          </span>
          <span className="line-clamp-2 font-display text-sm font-bold leading-tight sm:text-base">{post.summary.title}</span>
        </span>
      )}
      {post.photo_url ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6">
          <span className="block truncate text-xs font-bold text-white">{post.summary.title}</span>
        </span>
      ) : null}
      {record && post.photo_url ? (
        <span className="absolute right-1.5 top-1.5 text-base drop-shadow" aria-label="Con récord">
          🏆
        </span>
      ) : null}
      {post.likes_count > 0 ? (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[0.65rem] font-bold text-white">♥ {post.likes_count}</span>
      ) : null}
    </Link>
  )
}

/** Cuadrícula de entrenos compartidos (3 columnas), carga más al bajar. */
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

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-3 gap-0.5" aria-busy>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-square animate-pulse bg-evo-surface" />
        ))}
      </div>
    )
  }

  const posts = query.data?.pages.flatMap((p) => p.data) ?? []
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-evo-text/80 text-3xl" aria-hidden>
          📸
        </span>
        <p className="font-display text-lg font-bold">Aún no hay entrenos</p>
        <p className="text-sm text-evo-muted">{emptyText}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5">
        {posts.map((post) => (
          <Tile key={post.id} post={post} />
        ))}
      </div>
      <div ref={sentinel} />
      {isFetchingNextPage ? <p className="py-3 text-center text-sm text-evo-muted">Cargando…</p> : null}
    </>
  )
}
