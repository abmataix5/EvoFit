import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import { handle } from '../../lib/social'
import { storiesQuery, type StoryGroup } from '../../lib/stories'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../profile/Avatar'
import { StoryComposer } from './StoryComposer'
import { StoryViewer } from './StoryViewer'

/** Marco de historia con la silueta de EvoFit: degradado de marca si hay alguna sin ver, gris si ya las has visto. */
export function StoryRing({ group, children, size = 'lg' }: { group: StoryGroup | undefined; children: React.ReactNode; size?: 'sm' | 'lg' }) {
  if (!group) return <>{children}</>
  return (
    <span
      className={[
        // inline-flex (no inline-block): sin el hueco de línea de texto que deformaba el marco por abajo.
        'evo-shape inline-flex shrink-0',
        size === 'lg' ? 'p-[3px]' : 'p-[2px]',
        group.has_unseen ? 'bg-gradient-to-br from-evo-accent via-[#ffb347] to-evo-lime' : 'bg-evo-border/70',
      ].join(' ')}
    >
      <span className={['evo-shape flex bg-evo-bg', size === 'lg' ? 'p-[3px]' : 'p-[2px]'].join(' ')}>{children}</span>
    </span>
  )
}

/** Fila de historias arriba del feed: la tuya primero y después las de tus amigos. */
export function StoriesBar() {
  const { user } = useAuth()
  const stories = useQuery(storiesQuery)
  const [viewing, setViewing] = useState<{ groups: StoryGroup[]; start: number } | null>(null)
  const [composing, setComposing] = useState(false)

  const groups = stories.data ?? []
  const mine = groups.find((g) => g.mine)
  const others = groups.filter((g) => !g.mine)

  function open(group: StoryGroup) {
    // Se ven en el orden de la barra: tuya (si la abres tú) y después el resto.
    const list = group.mine ? groups : others
    setViewing({ groups: list, start: list.indexOf(group) })
  }

  return (
    <>
      <div
        className="-mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Historias"
      >
        <div className="flex w-[4.6rem] shrink-0 snap-start flex-col items-center gap-1.5">
          <span className="relative flex">
            <button type="button" className="flex" onClick={() => (mine ? open(mine) : setComposing(true))} aria-label={mine ? 'Ver tu historia' : 'Crear historia'}>
              <StoryRing group={mine}>
                <Avatar name={user?.name} url={user?.avatar_url} size="md" className="!h-16 !w-16" />
              </StoryRing>
            </button>
            <button
              type="button"
              onClick={() => setComposing(true)}
              aria-label="Nueva historia"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-evo-accent text-[#1a120c] ring-[3px] ring-evo-bg transition before:absolute before:-inset-2 before:content-[''] active:scale-90"
            >
              <Icon name="plus" className="h-4 w-4" />
            </button>
          </span>
          <span className="w-full truncate text-center text-xs font-semibold text-evo-muted">Tu historia</span>
        </div>

        {others.map((group) => (
          <button key={group.user.id} type="button" onClick={() => open(group)} className="flex w-[4.6rem] shrink-0 snap-start flex-col items-center gap-1.5 transition active:scale-95">
            <StoryRing group={group}>
              <Avatar name={group.user.name} url={group.user.avatar_url} size="md" className="!h-16 !w-16" />
            </StoryRing>
            <span className={['w-full truncate text-center text-xs', group.has_unseen ? 'font-bold text-evo-text' : 'font-semibold text-evo-muted'].join(' ')}>
              {handle(group.user)}
            </span>
          </button>
        ))}

        {others.length === 0 && !stories.isLoading ? (
          <div className="flex min-w-0 items-center pl-1 text-sm text-evo-muted">
            <p className="max-w-[14rem] leading-snug">Cuando tus amigos suban historias aparecerán aquí. ¡Sube la tuya!</p>
          </div>
        ) : null}
      </div>

      {viewing ? <StoryViewer groups={viewing.groups} startGroup={viewing.start} onClose={() => setViewing(null)} /> : null}
      {composing ? <StoryComposer onClose={() => setComposing(false)} /> : null}
    </>
  )
}
