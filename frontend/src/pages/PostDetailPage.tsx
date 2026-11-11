import { useMutation, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { useAuth } from '../features/auth/AuthContext'
import { PostCard } from '../features/feed/PostCard'
import { Avatar } from '../features/profile/Avatar'
import { api, apiErrorMessage } from '../lib/api'
import { commentsQuery, patchPost, postQuery, type PostComment } from '../lib/feed'
import { queryClient } from '../lib/queryClient'
import { timeAgo } from '../lib/social'

export function PostDetailPage() {
  const id = Number(useParams().id)
  const { user } = useAuth()
  const { notify } = useUiFeedback()
  const post = useQuery({ ...postQuery(id), enabled: Number.isFinite(id) })
  const comments = useQuery({ ...commentsQuery(id), enabled: post.isSuccess })
  const [body, setBody] = useState('')

  const send = useMutation({
    mutationFn: async (text: string) => (await api.post<{ data: PostComment }>(`/posts/${id}/comments`, { body: text })).data.data,
    onSuccess: (comment) => {
      setBody('')
      queryClient.setQueryData<PostComment[]>(['post-comments', id], (list) => [...(list ?? []), comment])
      patchPost(id, (p) => ({ ...p, comments_count: p.comments_count + 1, comments_preview: [...p.comments_preview, comment].slice(-2) }))
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido enviar el comentario.'), 'error'),
  })

  const remove = useMutation({
    mutationFn: async (commentId: number) => api.delete(`/comments/${commentId}`),
    onSuccess: (_, commentId) => {
      queryClient.setQueryData<PostComment[]>(['post-comments', id], (list) => (list ?? []).filter((c) => c.id !== commentId))
      patchPost(id, (p) => ({
        ...p,
        comments_count: Math.max(0, p.comments_count - 1),
        comments_preview: p.comments_preview.filter((c) => c.id !== commentId),
      }))
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido borrar.'), 'error'),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const text = body.trim()
    if (text) send.mutate(text)
  }

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
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <PostCard post={post.data} detailed />

      <section aria-label="Comentarios" className="space-y-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-evo-muted">
          Comentarios{post.data.comments_count ? ` · ${post.data.comments_count}` : ''}
        </h2>
        {comments.isLoading ? (
          <p className="px-1 text-sm text-evo-muted">Cargando…</p>
        ) : (comments.data ?? []).length === 0 ? (
          <p className="px-1 text-sm text-evo-muted">Sé el primero en comentar.</p>
        ) : (
          <ul className="space-y-3">
            {comments.data!.map((comment) => (
              <li key={comment.id} className="flex gap-3">
                <Link to={`/u/${comment.author.id}`} className="shrink-0">
                  <Avatar name={comment.author.name} url={comment.author.avatar_url} size="sm" />
                </Link>
                <div className="min-w-0 flex-1 rounded-2xl bg-evo-surface px-3 py-2">
                  <p className="text-sm">
                    <Link to={`/u/${comment.author.id}`} className="font-bold">
                      {comment.author.name}
                    </Link>{' '}
                    <span className="text-xs text-evo-muted">{timeAgo(comment.created_at)}</span>
                  </p>
                  <p className="whitespace-pre-line break-words text-[0.95rem] leading-snug">{comment.body}</p>
                </div>
                {comment.can_delete ? (
                  <button
                    type="button"
                    onClick={() => remove.mutate(comment.id)}
                    disabled={remove.isPending}
                    className="self-center rounded-lg px-2 py-1 text-xs font-semibold text-evo-muted hover:text-evo-danger"
                    aria-label="Borrar comentario"
                  >
                    Borrar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={submit}
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex items-end gap-2 border-t border-evo-border/40 bg-evo-bg/95 px-4 pt-3 backdrop-blur-xl lg:left-[260px]"
      >
        <Avatar name={user?.name} url={user?.avatar_url} size="sm" className="mb-1" />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Escribe un comentario</span>
          <textarea
            rows={1}
            maxLength={500}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit(e)
              }
            }}
            placeholder="Añade un comentario…"
            className="max-h-32 w-full resize-none rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-4 py-2.5 text-base text-evo-text placeholder:text-evo-muted/80 focus:border-evo-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={!body.trim() || send.isPending}
          className="mb-0.5 min-h-11 rounded-2xl px-3 font-bold text-evo-accent disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
