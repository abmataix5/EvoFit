import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { buttonClasses } from '../components/ui/Button'
import { PersonRow } from '../features/social/PersonRow'
import { friendRequestsQuery, friendsQuery, timeAgo } from '../lib/social'

/** Mis amigos y las solicitudes pendientes (recibidas y enviadas). */
export function FriendsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'requests' ? 'requests' : 'friends'
  const friends = useQuery(friendsQuery)
  const requests = useQuery(friendRequestsQuery)
  const incoming = requests.data?.incoming ?? []
  const outgoing = requests.data?.outgoing ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div role="tablist" aria-label="Amigos" className="grid grid-cols-2 gap-1 rounded-2xl bg-evo-surface-2 p-1">
        {(
          [
            { id: 'friends', label: 'Amigos', count: friends.data?.length ?? 0 },
            { id: 'requests', label: 'Solicitudes', count: incoming.length },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setParams(item.id === 'requests' ? { tab: 'requests' } : {}, { replace: true })}
            className={['min-h-11 rounded-xl text-sm font-bold transition', tab === item.id ? 'bg-evo-surface text-evo-text shadow' : 'text-evo-muted'].join(' ')}
          >
            {item.label}
            {item.count ? (
              <span
                className={[
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                  item.id === 'requests' ? 'bg-evo-accent text-[#1a120c]' : 'text-evo-muted',
                ].join(' ')}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'friends' ? (
        friends.isLoading ? (
          <p className="text-sm text-evo-muted">Cargando…</p>
        ) : (friends.data ?? []).length === 0 ? (
          <div className="space-y-3 rounded-3xl border-2 border-dashed border-evo-border p-6 text-center">
            <p className="text-3xl" aria-hidden>
              👋
            </p>
            <p className="font-bold">Aún no tienes amigos en EvoFit</p>
            <p className="text-sm text-evo-muted">Búscalos por su nombre o su @usuario y envíales una solicitud.</p>
            <Link to="/search" className={buttonClasses({ className: 'mt-1' })}>
              Buscar personas
            </Link>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-evo-border/60 bg-evo-surface">
            {friends.data!.map((person) => (
              <PersonRow key={person.id} person={person} />
            ))}
          </ul>
        )
      ) : requests.isLoading ? (
        <p className="text-sm text-evo-muted">Cargando…</p>
      ) : (
        <div className="space-y-5">
          <section>
            <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-evo-muted">Recibidas</h2>
            {incoming.length === 0 ? (
              <p className="rounded-2xl bg-evo-surface px-4 py-5 text-center text-sm text-evo-muted">No tienes solicitudes pendientes.</p>
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-evo-border/60 bg-evo-surface">
                {incoming.map((request) => (
                  <PersonRow key={request.id} person={request.user} subtitle={`Te la envió hace ${timeAgo(request.created_at)}`} />
                ))}
              </ul>
            )}
          </section>
          {outgoing.length > 0 ? (
            <section>
              <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-evo-muted">Enviadas</h2>
              <ul className="overflow-hidden rounded-2xl border border-evo-border/60 bg-evo-surface">
                {outgoing.map((request) => (
                  <PersonRow key={request.id} person={request.user} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <Link to="/search" className="block text-center text-sm font-bold text-evo-accent">
        Buscar más personas
      </Link>
    </div>
  )
}
