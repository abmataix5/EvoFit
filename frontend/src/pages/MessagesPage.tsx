import { LoadError } from '../components/feedback/LoadError'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Icon } from '../components/icons/Icon'
import { buttonClasses } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { Avatar } from '../features/profile/Avatar'
import { apiErrorMessage } from '../lib/api'
import { conversationsQuery, openConversation } from '../lib/messages'
import { friendsQuery, handle, timeAgo } from '../lib/social'

/** Bandeja de mensajes privados. */
export function MessagesPage() {
  const conversations = useQuery(conversationsQuery)
  const [picking, setPicking] = useState(false)
  const list = conversations.data ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="sr-only">Mensajes</h1>
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-evo-muted">Privados, solo entre amigos.</p>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-evo-surface-2 px-4 text-sm font-bold transition active:scale-95"
        >
          <Icon name="plus" className="h-4 w-4" /> Nuevo
        </button>
      </div>

      {conversations.isError && !conversations.data ? (
        <LoadError onRetry={() => void conversations.refetch()} />
      ) : !conversations.data ? (
        <div className="space-y-2" role="status" aria-label="Cargando mensajes">
          {[0, 1, 2].map((i) => (
            <div key={i} className="evo-skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="space-y-3 rounded-3xl border-2 border-dashed border-evo-border p-6 text-center">
          <span className="evo-shape mx-auto flex h-14 w-14 items-center justify-center bg-evo-surface-2 text-evo-text">
            <Icon name="chat" className="h-7 w-7" />
          </span>
          <p className="font-display text-2xl font-bold">Tus mensajes</p>
          <p className="text-sm text-evo-muted">Escribe a tus amigos o responde a sus historias. Los mensajes son privados.</p>
          <button type="button" onClick={() => setPicking(true)} className={buttonClasses({ className: 'mt-1' })}>
            Enviar un mensaje
          </button>
        </div>
      ) : (
        <ul className="evo-stagger -mx-4 sm:mx-0">
          {list.map((conversation) => {
            const unread = conversation.unread > 0
            return (
              <li key={conversation.id}>
                <Link to={`/messages/${conversation.id}`} className="flex items-center gap-3 px-4 py-2.5 transition active:bg-evo-surface-2 sm:rounded-2xl">
                  <Avatar name={conversation.user?.name} url={conversation.user?.avatar_url} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className={['block truncate', unread ? 'font-bold' : 'font-semibold'].join(' ')}>{handle(conversation.user)}</span>
                    <span className={['flex gap-1 text-sm', unread ? 'font-semibold text-evo-text' : 'text-evo-muted'].join(' ')}>
                      <span className="truncate">
                        {conversation.last_message?.mine ? 'Tú: ' : ''}
                        {conversation.last_message?.preview}
                      </span>
                      {conversation.last_message ? <span className="shrink-0">· {timeAgo(conversation.last_message.created_at)}</span> : null}
                    </span>
                  </span>
                  {unread ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-evo-accent" aria-label="Sin leer" /> : null}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {picking ? <NewMessageSheet onClose={() => setPicking(false)} /> : null}
    </div>
  )
}

function NewMessageSheet({ onClose }: { onClose: () => void }) {
  const friends = useQuery(friendsQuery)
  const navigate = useNavigate()
  const { notify } = useUiFeedback()
  const open = useMutation({
    mutationFn: (userId: number) => openConversation(userId),
    onSuccess: (id) => navigate(`/messages/${id}`),
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido abrir la conversación.'), 'error'),
  })

  return (
    <Sheet title="Nuevo mensaje" onClose={onClose}>
      {friends.isLoading ? (
        <p className="py-6 text-center text-sm text-evo-muted">Cargando…</p>
      ) : (friends.data ?? []).length === 0 ? (
        <div className="space-y-2 py-6 text-center">
          <p className="font-bold">Aún no tienes amigos</p>
          <p className="text-sm text-evo-muted">Solo puedes escribir a tus amigos.</p>
          <Link to="/search" className="text-sm font-bold text-evo-accent">
            Buscar amigos
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-evo-border/40">
          {friends.data!.map((friend) => (
            <li key={friend.id}>
              <button type="button" disabled={open.isPending} onClick={() => open.mutate(friend.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                <Avatar name={friend.name} url={friend.avatar_url} />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{handle(friend)}</span>
                  <span className="block truncate text-sm text-evo-muted">{friend.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
