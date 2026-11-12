import { useState, type ReactNode } from 'react'
import { Icon } from '../../components/icons/Icon'
import { Segmented } from '../../components/ui/Segmented'
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

const LEVEL_STEPS = { beginner: 1, intermediate: 2, advanced: 3 } as const

/** Nivel como tres trazos inclinados (los del logo) que se van encendiendo: la «evolución» de EvoFit. */
function LevelMeter({ level, label }: { level: keyof typeof LEVEL_STEPS; label: string }) {
  const steps = LEVEL_STEPS[level]
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-evo-surface-2 py-1.5 pl-3 pr-3.5 text-sm font-bold">
      <span className="flex gap-[3px]" aria-hidden>
        {[1, 2, 3].map((step) => (
          <span key={step} className={['h-3.5 w-1.5 -skew-x-[20deg] rounded-[2px]', step <= steps ? 'bg-evo-accent' : 'bg-evo-border'].join(' ')} />
        ))}
      </span>
      <span>
        <span className="sr-only">Nivel: </span>
        {label}
      </span>
    </span>
  )
}

function Stat({ value, label, icon, onClick }: { value: string | number; label: string; icon?: ReactNode; onClick?: () => void }) {
  const content = (
    <>
      <span className="flex items-center gap-1 font-display text-3xl font-extrabold tabular-nums leading-none">
        {value}
        {icon}
      </span>
      <span className="mt-1 flex items-center gap-0.5 text-xs font-bold uppercase tracking-wide text-evo-muted">
        {label}
        {onClick ? <Icon name="chevron" className="h-3 w-3" /> : null}
      </span>
    </>
  )
  const box = 'flex min-h-[4.5rem] min-w-0 flex-col justify-center rounded-2xl border border-evo-border/50 bg-evo-surface px-3 py-2.5 text-left'
  return onClick ? (
    <button type="button" onClick={onClick} className={`${box} transition active:scale-95 active:bg-evo-surface-2`}>
      {content}
    </button>
  ) : (
    <div className={box}>{content}</div>
  )
}

/**
 * Ficha de atleta de EvoFit: cabecera de marca con la foto, nombre, nivel y objetivo;
 * las cifras en tres marcadores; y debajo sus entrenos o sus datos.
 */
export function ProfileView({ person, isSelf, actions, onMenu, storyGroup, onOpenStory, onFriends, notice }: Props) {
  const [tab, setTab] = useState<'posts' | 'about'>('posts')
  const goal = goalOption(person.training_goal)
  const level = levelLabel(person.experience_level)
  const stats = person.stats
  const canView = person.can_view_activity
  const facts = [person.location ? `📍 ${person.location}` : null, person.gym_name ? `🏟️ ${person.gym_name}` : null].filter(Boolean)
  const isPrivate = person.profile_visibility === 'private'

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
  const streak = canView && stats ? stats.streak_weeks : null

  return (
    <div className="evo-stagger mx-auto max-w-2xl space-y-3">
      <section aria-label="Perfil" className="relative overflow-hidden rounded-3xl border border-evo-border/60 bg-evo-surface">
        <div className="relative h-[4.5rem] bg-gradient-to-br from-[#ffb347] via-evo-accent to-[#e8553d]" aria-hidden>
          <span className="evo-stripes absolute inset-0" />
        </div>
        <button
          type="button"
          onClick={onMenu}
          aria-label={isSelf ? 'Configuración' : 'Más opciones'}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition active:scale-90"
        >
          <Icon name={isSelf ? 'settings' : 'more'} className="h-5 w-5" />
        </button>

        <div className="px-4 pb-4">
          <div className="-mt-11 flex items-end justify-between gap-3">
            <span className="evo-shape flex shrink-0 bg-evo-surface p-1">
              {storyGroup && onOpenStory ? (
                <button type="button" className="flex transition active:scale-95" onClick={onOpenStory} aria-label="Ver historia">
                  <StoryRing group={storyGroup}>{avatar}</StoryRing>
                </button>
              ) : (
                avatar
              )}
            </span>
            {person.experience_level && level ? <LevelMeter level={person.experience_level} label={level} /> : null}
          </div>

          <h2 className="mt-2.5 break-words font-display text-[2rem] font-extrabold uppercase leading-none">{person.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-evo-muted">
            {person.username ? <span>@{person.username}</span> : null}
            {isPrivate ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="lock" className="h-3.5 w-3.5" /> Perfil privado
              </span>
            ) : null}
          </p>
          {goal ? (
            <p className="mt-2 text-sm font-bold text-evo-accent">
              <span aria-hidden>{goal.emoji}</span> Objetivo: {goal.label}
            </p>
          ) : null}
          {person.bio ? <p className="mt-2 whitespace-pre-line break-words text-[0.95rem] leading-snug">{person.bio}</p> : null}
          {facts.length > 0 ? <p className="mt-2 text-sm text-evo-muted">{facts.join('  ·  ')}</p> : null}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Stat value={canView && stats ? stats.total_workouts : '–'} label="Entrenos" />
        <Stat
          value={streak ?? '–'}
          label="Sem. racha"
          icon={streak ? <Icon name="flame" className="h-6 w-6 text-evo-accent" /> : undefined}
        />
        <Stat value={person.friends_count} label="Amigos" onClick={onFriends} />
      </div>

      <div>{actions}</div>

      {notice ? <div>{notice}</div> : null}

      {canView ? (
        <>
          <Segmented
            label="Contenido del perfil"
            value={tab}
            onChange={setTab}
            className="!mt-5"
            options={[
              { id: 'posts', label: 'Entrenos', count: person.posts_count ?? undefined },
              { id: 'about', label: 'Ficha' },
            ]}
          />

          <div>
            {tab === 'posts' ? (
              <PostGrid
                userId={person.id}
                emptyText={isSelf ? 'Cuando termines un entreno, compártelo y aparecerá aquí.' : `${person.username ?? person.name} aún no ha compartido entrenos.`}
              />
            ) : about.length > 0 ? (
              <ul className="divide-y divide-evo-border/40 overflow-hidden rounded-3xl border border-evo-border/60 bg-evo-surface px-4">
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
        <section className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-evo-border px-6 py-10 text-center">
          <span className="evo-shape flex h-14 w-14 items-center justify-center bg-evo-surface-2 text-evo-muted" aria-hidden>
            <Icon name="lock" className="h-7 w-7" />
          </span>
          <p className="font-display text-2xl font-bold">{isPrivate ? 'Esta cuenta es privada' : 'Solo para amigos'}</p>
          <p className="text-sm text-evo-muted">
            {isPrivate ? 'No comparte sus entrenos.' : `Añade a ${person.username ?? person.name} como amigo para ver sus entrenos.`}
          </p>
        </section>
      )}
    </div>
  )
}
