import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Segmented } from '../components/ui/Segmented'
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
      <Segmented
        label="Amigos"
        value={tab}
        onChange={(id) => setParams(id === 'requests' ? { tab: 'requests' } : {}, { replace: true })}
        options={[
          { id: 'friends', label: 'Amigos', count: friends.data?.length ?? 0 },
          { id: 'requests', label: 'Solicitudes', count: incoming.length, highlight: true },
        ]}
      />

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
            <h2 className="mb-1.5 px-1 evo-kicker">Recibidas</h2>
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
              <h2 className="mb-1.5 px-1 evo-kicker">Enviadas</h2>
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
