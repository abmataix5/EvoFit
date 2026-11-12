import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../components/feedback/LoadError'
import { Icon } from '../components/icons/Icon'
import { buttonClasses } from '../components/ui/Button'
import { Avatar } from '../features/profile/Avatar'
import { FriendButton } from '../features/social/FriendButton'
import { api } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import { handle, notificationsQuery, timeAgo, type AppNotification } from '../lib/social'

function describe(notification: AppNotification): string {
  switch (notification.kind) {
    case 'friend_request':
      return notification.pending ? 'quiere ser tu amigo' : 'te envió una solicitud de amistad'
    case 'friend_accepted':
      return 'ha aceptado tu solicitud. ¡Ya sois amigos!'
    case 'post_like':
      return 'le ha dado fuerza a tu entreno ⚡'
    case 'post_comment':
      return notification.excerpt ? `ha comentado: «${notification.excerpt}»` : 'ha comentado tu entreno'
    default:
      return 'tiene novedades para ti'
  }
}

export function NotificationsPage() {
  const query = useQuery({ ...notificationsQuery, refetchOnMount: 'always' })
  const markRead = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.setQueryData(['notifications', 'unread'], 0)
      // También en la lista guardada: al volver a entrar no se vuelve a marcar todo antes de ver lo nuevo.
      queryClient.setQueryData<{ data: AppNotification[]; unread: number }>(['notifications'], (current) => (current ? { ...current, unread: 0 } : current))
    },
  })

  const unread = query.data?.unread ?? 0
  const marked = useRef(false)
  // Al abrir la bandeja se dan por vistas (una vez por visita; las nuevas siguen resaltadas).
  useEffect(() => {
    if (unread > 0 && !marked.current) {
      marked.current = true
      markRead.mutate()
    }
  }, [unread, markRead])

  if (query.isError && !query.data) return <LoadError onRetry={() => void query.refetch()} />
  if (!query.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-2" role="status" aria-label="Cargando notificaciones">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="evo-skeleton h-16 rounded-2xl" />
        ))}
      </div>
    )
  }

  const items = query.data?.data ?? []

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 text-center">
        <span className="evo-shape flex h-16 w-16 items-center justify-center bg-evo-surface-2 text-evo-muted">
          <Icon name="bell" className="h-8 w-8" />
        </span>
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-bold">Todo tranquilo por aquí</h2>
          <p className="text-evo-muted">Aquí verás las solicitudes de amistad y la fuerza y los comentarios que reciben tus entrenos.</p>
        </div>
        <Link to="/search" className={buttonClasses({ variant: 'secondary' })}>
          Buscar amigos
        </Link>
      </div>
    )
  }

  return (
    <ul className="evo-stagger mx-auto max-w-2xl overflow-hidden rounded-3xl border border-evo-border/60 bg-evo-surface">
      {items.map((notification) => (
        <li
          key={notification.id}
          className={['border-b border-evo-border/40 px-3 py-3 last:border-b-0', notification.read ? '' : 'bg-evo-accent/5'].join(' ')}
        >
          <div className="flex items-start gap-3">
            <Link to={`/u/${notification.actor.id}`} className="shrink-0">
              <Avatar name={notification.actor.name} url={notification.actor.avatar_url} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[0.95rem] leading-snug">
                <Link to={`/u/${notification.actor.id}`} className="font-bold">
                  {handle(notification.actor)}
                </Link>{' '}
                {describe(notification)}
                <span className="ml-1.5 whitespace-nowrap text-sm text-evo-muted">{timeAgo(notification.created_at)}</span>
              </p>
              {notification.post_id ? (
                <Link to={`/posts/${notification.post_id}`} className="-mb-2 flex min-h-10 items-center gap-0.5 text-sm font-bold text-evo-accent">
                  Ver entreno <Icon name="chevron" className="h-3.5 w-3.5" />
                </Link>
              ) : null}
              {notification.kind === 'friend_request' && notification.pending ? (
                <div className="mt-2">
                  <FriendButton person={notification.actor} />
                </div>
              ) : null}
            </div>
            {!notification.read ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-evo-accent" role="img" aria-label="Nueva" /> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
