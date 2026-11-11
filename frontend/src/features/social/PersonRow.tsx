import { Link } from 'react-router-dom'
import type { PersonCard } from '../../lib/social'
import { Avatar } from '../profile/Avatar'
import { FriendButton } from './FriendButton'

/** Persona en una lista: foto, nombre y @usuario (abre su perfil) y el botón de amistad. */
export function PersonRow({ person, subtitle, showAction = true }: { person: PersonCard; subtitle?: string; showAction?: boolean }) {
  return (
    <li className="flex items-center gap-3 border-b border-evo-border/40 px-3 py-2.5 last:border-b-0">
      <Link to={`/u/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={person.name} url={person.avatar_url} />
        <span className="min-w-0">
          <span className="block truncate font-bold">{person.name}</span>
          <span className="block truncate text-sm text-evo-muted">
            {subtitle ?? [person.username ? `@${person.username}` : null, person.location].filter(Boolean).join(' · ')}
          </span>
        </span>
      </Link>
      {showAction ? <FriendButton person={person} /> : null}
    </li>
  )
}
