import { useInfiniteQuery } from '@tanstack/react-query'
import { personPostsQuery } from '../../lib/feed'
import { PostList } from './PostList'

/** Entrenos compartidos por una persona, para su perfil. */
export function ProfilePosts({ userId, emptyText }: { userId: number; emptyText: string }) {
  const posts = useInfiniteQuery(personPostsQuery(userId))

  return (
    <section aria-label="Entrenos compartidos" className="space-y-3">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-evo-muted">Entrenos compartidos</h2>
      <PostList query={posts} empty={<p className="rounded-3xl bg-evo-surface px-4 py-6 text-center text-sm text-evo-muted">{emptyText}</p>} />
    </section>
  )
}
