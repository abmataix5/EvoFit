import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, type ReactNode } from 'react'
import type { Post } from '../../lib/feed'
import { PostCard } from './PostCard'

type Page = { data: Post[]; next_before: number | null }

/** Lista de publicaciones que carga la siguiente página al acercarse al final. */
export function PostList({ query, empty }: { query: UseInfiniteQueryResult<InfiniteData<Page>>; empty: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: '600px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (query.isLoading) {
    return (
      <div className="space-y-3" aria-busy>
        {[0, 1].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-3xl bg-evo-surface" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="rounded-3xl bg-evo-surface p-5 text-center">
        <p className="text-sm text-evo-muted">No se han podido cargar los entrenos.</p>
        <button type="button" onClick={() => void query.refetch()} className="mt-2 text-sm font-bold text-evo-accent">
          Reintentar
        </button>
      </div>
    )
  }

  const posts = query.data?.pages.flatMap((page) => page.data) ?? []
  if (posts.length === 0) return <>{empty}</>

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div ref={sentinel} />
      {isFetchingNextPage ? <p className="py-2 text-center text-sm text-evo-muted">Cargando más…</p> : null}
      {!hasNextPage && posts.length > 3 ? <p className="py-2 text-center text-sm text-evo-muted">Ya estás al día 💪</p> : null}
    </div>
  )
}
