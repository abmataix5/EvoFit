import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Link, useParams } from 'react-router-dom'
import { PostCard } from '../features/feed/PostCard'
import { CommentsPanel } from '../features/feed/PostComments'
import { postQuery } from '../lib/feed'

export function PostDetailPage() {
  const id = Number(useParams().id)
  const post = useQuery({ ...postQuery(id), enabled: Number.isFinite(id) })

  if (post.isLoading) return <p className="text-sm text-evo-muted">Cargando…</p>
  if (!post.data) {
    const gone = isAxiosError(post.error) && post.error.response?.status === 404
    return (
      <div className="mx-auto max-w-md space-y-2 py-10 text-center">
        <p className="font-display text-xl font-bold">{gone ? 'Esta publicación ya no está disponible' : 'No se ha podido cargar'}</p>
        <Link to="/" className="text-sm font-bold text-evo-accent">
          Volver al inicio
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-40">
      <PostCard post={post.data} detailed />
      <CommentsPanel post={post.data} />
    </div>
  )
}
