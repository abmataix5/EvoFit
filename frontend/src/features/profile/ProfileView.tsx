import { useState, type ReactNode } from 'react'
import { Icon } from '../../components/icons/Icon'
import type { PersonProfile } from '../../lib/social'
import type { StoryGroup } from '../../lib/stories'
import { PostGrid } from '../feed/PostGrid'
import { StoryRing } from '../stories/StoriesBar'
import { Avatar } from './Avatar'
import { goalOption, levelLabel } from './profileOptions'

type Props = {
  person: PersonProfile
  isSelf: boolean
  /** Botones bajo la bio (Editar perfil / Añadir / Mensaje…). */
  actions: ReactNode
  /** Lo que abre el menú ☰ (ajustes en el tuyo; bloquear/denunciar en otros). */
  onMenu: () => void
  storyGroup?: StoryGroup
  onOpenStory?: () => void
  onFriends?: () => void
  /** Aviso opcional entre la cabecera y las pestañas (p. ej. "Completa tu perfil"). */
  notice?: ReactNode
}

function formatMonthYear(iso: string | null) {
  if (!iso) return null
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

function Stat({ value, label, onClick }: { value: string | number; label: string; onClick?: () => void }) {
  const content = (
    <>
      <span className="block font-display text-xl font-bold tabular-nums leading-tight">{value}</span>
      <span className="block text-xs text-evo-muted">{label}</span>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="min-w-0 rounded-xl py-1 text-center transition active:bg-evo-surface-2">
      {content}
    </button>
  ) : (
    <div className="min-w-0 py-1 text-center">{content}</div>
  )
}

/** Perfil al estilo Instagram: foto y cifras, bio, acciones y pestañas (entrenos / sobre mí). */
export function ProfileView({ person, isSelf, actions, onMenu, storyGroup, onOpenStory, onFriends, notice }: Props) {
  const [tab, setTab] = useState<'posts' | 'about'>('posts')
  const goal = goalOption(person.training_goal)
  const level = levelLabel(person.experience_level)
  const stats = person.stats
  const canView = person.can_view_activity
  const facts = [person.location ? `📍 ${person.location}` : null, person.gym_name ? `🏟️ ${person.gym_name}` : null].filter(Boolean)

  const about = [
    goal ? { icon: goal.emoji, label: 'Objetivo', value: goal.label } : null,
    level ? { icon: '📊', label: 'Nivel', value: level } : null,
    person.age != null ? { icon: '🎂', label: 'Edad', value: `${person.age} años` } : null,
    person.height_cm ? { icon: '📏', label: 'Altura', value: `${person.height_cm} cm` } : null,
    person.location ? { icon: '📍', label: 'De', value: person.location } : null,
    person.gym_name ? { icon: '🏟️', label: 'Gimnasio', value: person.gym_name } : null,
    stats ? { icon: '📅', label: 'Este mes', value: `${stats.month_workouts} ${stats.month_workouts === 1 ? 'entreno' : 'entrenos'}` } : null,
    stats && stats.best_streak_weeks > 0 ? { icon: '🏅', label: 'Mejor racha', value: `${stats.best_streak_weeks} semanas` } : null,
    person.member_since ? { icon: '✨', label: 'En EvoFit desde', value: formatMonthYear(person.member_since) ?? '' } : null,
  ].filter(Boolean) as Array<{ icon: string; label: string; value: string }>

  const avatar = <Avatar name={person.name} url={person.avatar_url} size="lg" className="!h-[5.5rem] !w-[5.5rem]" />

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-lg font-bold">
          <span className="truncate">{person.username ?? person.name}</span>
          {person.profile_visibility === 'private' ? <span aria-label="Perfil privado">🔒</span> : null}
        </p>
        <button
          type="button"
          onClick={onMenu}
          aria-label={isSelf ? 'Ajustes' : 'Más opciones'}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-evo-surface-2"
        >
          <Icon name="menu" className="h-6 w-6" />
        </button>
      </div>

      <div className="flex items-center gap-5">
        {storyGroup && onOpenStory ? (
          <button type="button" className="flex shrink-0" onClick={onOpenStory} aria-label="Ver historia">
            <StoryRing group={storyGroup}>{avatar}</StoryRing>
          </button>
        ) : (
          <span className="flex shrink-0">{avatar}</span>
        )}
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
          <Stat value={canView && stats ? stats.total_workouts : '–'} label="Entrenos" />
          <Stat value={person.friends_count} label="Amigos" onClick={onFriends} />
          <Stat value={canView && stats ? `${stats.streak_weeks}${stats.streak_weeks > 0 ? '🔥' : ''}` : '–'} label="Sem. racha" />
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <h1 className="font-display text-lg font-bold leading-tight">{person.name}</h1>
        {goal || level ? (
          <p className="text-sm font-semibold text-evo-accent">{[goal ? `${goal.emoji} ${goal.label}` : null, level].filter(Boolean).join(' · ')}</p>
        ) : null}
        {person.bio ? <p className="whitespace-pre-line text-[0.95rem] leading-snug">{person.bio}</p> : null}
        {facts.length > 0 ? <p className="text-sm text-evo-muted">{facts.join('  ·  ')}</p> : null}
      </div>

      <div className="mt-4">{actions}</div>

      {notice ? <div className="mt-4">{notice}</div> : null}

      {canView ? (
        <>
          <div role="tablist" aria-label="Contenido del perfil" className="-mx-4 mt-5 grid grid-cols-2 border-b border-evo-border/50 sm:mx-0">
            {(
              [
                { id: 'posts', label: `Entrenos${person.posts_count ? ` · ${person.posts_count}` : ''}`, icon: '▦' },
                { id: 'about', label: 'Sobre mí', icon: '◎' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={[
                  'flex min-h-12 items-center justify-center gap-1.5 border-b-2 text-sm font-bold transition',
                  tab === item.id ? 'border-evo-text text-evo-text' : 'border-transparent text-evo-muted',
                ].join(' ')}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="-mx-4 mt-0.5 sm:mx-0">
            {tab === 'posts' ? (
              <PostGrid
                userId={person.id}
                emptyText={isSelf ? 'Cuando termines un entreno, compártelo y aparecerá aquí.' : `${person.username ?? person.name} aún no ha compartido entrenos.`}
              />
            ) : about.length > 0 ? (
              <ul className="divide-y divide-evo-border/40 px-4 sm:px-0">
                {about.map((row) => (
                  <li key={row.label} className="flex items-center gap-3 py-3">
                    <span className="w-7 text-center text-xl" aria-hidden>
                      {row.icon}
                    </span>
                    <span className="flex-1 text-sm text-evo-muted">{row.label}</span>
                    <span className="truncate text-right font-semibold">{row.value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-10 text-center text-sm text-evo-muted">{isSelf ? 'Completa tu perfil para que tus amigos te conozcan.' : 'Sin información.'}</p>
            )}
          </div>
        </>
      ) : (
        <section className="mt-6 flex flex-col items-center gap-2 border-t border-evo-border/50 px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-evo-text/80 text-3xl" aria-hidden>
            🔒
          </span>
          <p className="font-display text-lg font-bold">{person.profile_visibility === 'private' ? 'Esta cuenta es privada' : 'Solo para amigos'}</p>
          <p className="text-sm text-evo-muted">
            {person.profile_visibility === 'private'
              ? 'No comparte sus entrenos.'
              : `Añade a ${person.username ?? person.name} como amigo para ver sus entrenos.`}
          </p>
        </section>
      )}
    </div>
  )
}
