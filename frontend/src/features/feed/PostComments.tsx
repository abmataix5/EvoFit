import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Sheet } from '../../components/ui/Sheet'
import { api, apiErrorMessage } from '../../lib/api'
import { commentsQuery, patchPost, type Post, type PostComment } from '../../lib/feed'
import { queryClient } from '../../lib/queryClient'
import { handle, timeAgo } from '../../lib/social'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../profile/Avatar'

const QUICK_REACTIONS = ['🔥', '💪', '👏', '😍', '🙌', '😮', '🏆', '💯']

/** Comentarios de una publicación: lista, envío y borrado (actualiza también el feed). */
function usePostComments(postId: number) {
  const { notify } = useUiFeedback()
  const comments = useQuery(commentsQuery(postId))

  const send = useMutation({
    mutationFn: async (text: string) => (await api.post<{ data: PostComment }>(`/posts/${postId}/comments`, { body: text })).data.data,
    onSuccess: (comment) => {
      queryClient.setQueryData<PostComment[]>(['post-comments', postId], (list) => [...(list ?? []), comment])
      patchPost(postId, (p) => ({ ...p, comments_count: p.comments_count + 1, comments_preview: [...p.comments_preview, comment].slice(-2) }))
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido enviar el comentario.'), 'error'),
  })

  const remove = useMutation({
    mutationFn: async (commentId: number) => api.delete(`/comments/${commentId}`),
    onSuccess: (_, commentId) => {
      queryClient.setQueryData<PostComment[]>(['post-comments', postId], (list) => (list ?? []).filter((c) => c.id !== commentId))
      patchPost(postId, (p) => ({
        ...p,
        comments_count: Math.max(0, p.comments_count - 1),
        comments_preview: p.comments_preview.filter((c) => c.id !== commentId),
      }))
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido borrar.'), 'error'),
  })

  return { comments, send, remove }
}

function CommentList({ post, state }: { post: Post; state: ReturnType<typeof usePostComments> }) {
  const { comments, remove } = state

  return (
    <ul className="space-y-4">
      {post.caption ? (
        <li className="flex gap-3 border-b border-evo-border/40 pb-4">
          <Avatar name={post.author.name} url={post.author.avatar_url} size="sm" />
          <p className="min-w-0 flex-1 whitespace-pre-line break-words text-[0.95rem] leading-snug">
            <span className="font-bold">{handle(post.author)}</span> {post.caption}
            <span className="mt-1 block text-xs font-semibold text-evo-muted">{timeAgo(post.created_at)}</span>
          </p>
        </li>
      ) : null}
      {comments.isLoading ? (
        <li className="py-4 text-center text-sm text-evo-muted">Cargando…</li>
      ) : (comments.data ?? []).length === 0 ? (
        <li className="py-6 text-center">
          <p className="font-bold">Aún no hay comentarios</p>
          <p className="text-sm text-evo-muted">Anima a {post.mine ? 'tus amigos' : handle(post.author)} con el primero.</p>
        </li>
      ) : (
        comments.data!.map((comment) => (
          <li key={comment.id} className="flex gap-3">
            <Link to={`/u/${comment.author.id}`} className="shrink-0">
              <Avatar name={comment.author.name} url={comment.author.avatar_url} size="sm" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-line break-words text-[0.95rem] leading-snug">
                <Link to={`/u/${comment.author.id}`} className="font-bold">
                  {handle(comment.author)}
                </Link>{' '}
                {comment.body}
              </p>
              <p className="mt-1 flex gap-3 text-xs font-semibold text-evo-muted">
                <span>{timeAgo(comment.created_at)}</span>
                {comment.can_delete ? (
                  <button type="button" onClick={() => remove.mutate(comment.id)} disabled={remove.isPending} className="hover:text-evo-danger">
                    Eliminar
                  </button>
                ) : null}
              </p>
            </div>
          </li>
        ))
      )}
    </ul>
  )
}

function CommentInput({ state, autoFocus }: { state: ReturnType<typeof usePostComments>; autoFocus?: boolean }) {
  const { user } = useAuth()
  const [body, setBody] = useState('')
  const { send } = state

  function submit(event?: FormEvent) {
    event?.preventDefault()
    const text = body.trim()
    if (!text || send.isPending) return
    send.mutate(text, { onSuccess: () => setBody('') })
  }

  return (
    <div className="space-y-2">
      <div className="-mx-1 flex justify-between px-1" role="group" aria-label="Reacciones rápidas">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => setBody((current) => current + emoji)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition active:scale-90"
            aria-label={`Añadir ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex items-end gap-2">
        <Avatar name={user?.name} url={user?.avatar_url} size="sm" className="mb-1" />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Escribe un comentario</span>
          <textarea
            rows={1}
            maxLength={500}
            autoFocus={autoFocus}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Añade un comentario…"
            className="max-h-32 w-full resize-none rounded-full border border-evo-border bg-evo-surface-2 px-4 py-2.5 text-base text-evo-text placeholder:text-evo-muted/80 focus:border-evo-accent focus:outline-none"
          />
        </label>
        <button type="submit" disabled={!body.trim() || send.isPending} className="mb-0.5 min-h-11 px-2 font-bold text-evo-accent disabled:opacity-40">
          Publicar
        </button>
      </form>
    </div>
  )
}

/** Comentarios en una hoja inferior, sin salir del feed (como en Instagram). */
export function CommentsSheet({ post, onClose }: { post: Post; onClose: () => void }) {
  const state = usePostComments(post.id)

  return (
    <Sheet title="Comentarios" onClose={onClose} footer={<CommentInput state={state} />}>
      <CommentList post={post} state={state} />
    </Sheet>
  )
}

/** Comentarios en la pantalla de detalle (al abrir un aviso, por ejemplo). */
export function CommentsPanel({ post }: { post: Post }) {
  const state = usePostComments(post.id)

  return (
    <>
      <section aria-label="Comentarios" className="pt-2">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-evo-muted">
          Comentarios{post.comments_count ? ` · ${post.comments_count}` : ''}
        </h2>
        <CommentList post={post} state={state} />
      </section>
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-evo-border/40 bg-evo-bg/95 px-4 pt-2 backdrop-blur-xl lg:left-[260px]">
        <div className="mx-auto max-w-2xl">
          <CommentInput state={state} />
        </div>
      </div>
    </>
  )
}
