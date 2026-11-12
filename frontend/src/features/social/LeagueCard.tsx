import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/icons/Icon'
import { formatScore, leagueQuery, rank, readMetric } from '../../lib/league'
import { handle } from '../../lib/social'
import { Avatar } from '../profile/Avatar'

/** Resumen de la liga semanal en el inicio: tu puesto y los tres primeros, y lleva a la clasificación. */
export function LeagueCard() {
  const league = useQuery(leagueQuery(0))
  if (!league.data || league.data.entries.length <= 1) return null

  const metric = readMetric()
  const ranked = rank(league.data.entries, metric)
  const me = ranked.find((entry) => entry.me)
  const leader = ranked[0]!
  const status =
    leader.score === 0
      ? 'Nadie ha puntuado aún. ¡Sé el primero!'
      : me?.position === 1
        ? `¡Vas en cabeza! · ${formatScore(me, metric)}`
        : me?.position != null
          ? `Vas ${me.position}.º de ${ranked.length} · ${formatScore(me, metric)}`
          : `Va primero ${handle(leader.user)} · ${formatScore(leader, metric)}`

  return (
    <Link
      to="/league"
      className="flex items-center gap-3 rounded-3xl border border-evo-border/60 bg-evo-surface p-3.5 transition active:scale-[0.98]"
    >
      <span className="evo-shape flex h-12 w-12 shrink-0 items-center justify-center bg-evo-accent text-[#1a120c]" aria-hidden>
        <Icon name="trophy" className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-extrabold uppercase tracking-[0.14em] text-evo-muted">Liga de la semana</span>
        <span className="block truncate font-bold">{status}</span>
      </span>
      <span className="flex shrink-0" aria-hidden>
        {ranked.slice(0, 3).map((entry, index) => (
          <Avatar
            key={entry.user.id}
            name={entry.user.name}
            url={entry.user.avatar_url}
            size="xs"
            className={['ring-2 ring-evo-surface', index > 0 ? '-ml-2' : ''].join(' ')}
          />
        ))}
      </span>
      <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
    </Link>
  )
}
