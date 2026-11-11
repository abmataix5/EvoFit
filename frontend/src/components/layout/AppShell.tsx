import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { Avatar } from '../../features/profile/Avatar'
import { BrandLogo } from '../BrandLogo'
import { Icon, type IconName } from '../icons/Icon'
import { isTabActive, routeMeta, TABS, type Tab, type TabId } from './navigation'
import { unreadCountQuery } from '../../lib/social'

const TAB_ICONS: Record<Exclude<TabId, 'profile'>, IconName> = {
  home: 'home',
  calendar: 'calendar',
  routines: 'routines',
  progress: 'progress',
}

const iconButton =
  'flex h-11 w-11 items-center justify-center rounded-full text-evo-text transition hover:bg-evo-surface-2 active:scale-95 active:bg-evo-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-evo-accent/40'

function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const { user } = useAuth()

  if (tab.id === 'profile') {
    return (
      <Avatar
        name={user?.name}
        url={user?.avatar_url}
        size="xs"
        className={[
          'ring-2 ring-offset-2 ring-offset-evo-bg transition',
          active ? 'ring-evo-accent' : 'ring-transparent',
        ].join(' ')}
      />
    )
  }

  return <Icon name={TAB_ICONS[tab.id]} className="h-6 w-6" />
}

/** Volver atrás dentro de la app; si se entró por un enlace directo, a la pantalla padre. */
function useGoBack(parent: string | undefined) {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(parent ?? '/', { replace: true })
  }
}

function TopBar() {
  const location = useLocation()
  const meta = routeMeta(location.pathname)
  const goBack = useGoBack(meta.parent)
  const unread = useQuery(unreadCountQuery).data ?? 0

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-evo-border/30 bg-evo-bg/85 backdrop-blur-xl">
      {meta.root ? (
        <div className="flex h-14 items-center gap-2 px-4 lg:h-16 lg:px-8">
          <h1 className="min-w-0 flex-1 truncate font-display text-[1.7rem] font-bold tracking-tight">{meta.title}</h1>
          <nav aria-label="Acciones" className="-mr-2 flex items-center">
            <Link to="/search" className={iconButton} aria-label="Buscar">
              <Icon name="search" className="h-6 w-6" />
            </Link>
            <Link
              to="/notifications"
              className={`${iconButton} relative`}
              aria-label={unread > 0 ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}
            >
              <Icon name="bell" className="h-6 w-6" />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-evo-accent px-1 text-[0.7rem] font-bold text-[#1a120c] ring-2 ring-evo-bg">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </Link>
          </nav>
        </div>
      ) : (
        <div className="grid h-14 grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 px-2 lg:h-16 lg:px-6">
          <button type="button" className={iconButton} aria-label="Volver" onClick={goBack}>
            <Icon name="back" className="h-6 w-6" />
          </button>
          <p className="truncate text-center text-base font-bold">{meta.title}</p>
          <span aria-hidden />
        </div>
      )}
    </header>
  )
}

function TabLink({ tab, pathname, variant }: { tab: Tab; pathname: string; variant: 'bottom' | 'side' }) {
  const active = isTabActive(tab, pathname)

  function handleClick() {
    // Tocar la pestaña en la que ya estás sube al principio, como en las apps nativas.
    if (pathname === tab.to) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (variant === 'side') {
    return (
      <Link
        to={tab.to}
        onClick={handleClick}
        aria-current={active ? 'page' : undefined}
        className={[
          'flex min-h-13 items-center gap-3 rounded-2xl px-4 text-base font-bold transition',
          active ? 'bg-evo-accent/15 text-evo-accent' : 'text-evo-text hover:bg-evo-surface-2',
        ].join(' ')}
      >
        <TabIcon tab={tab} active={active} />
        {tab.id === 'profile' ? 'Tu perfil' : tab.label}
      </Link>
    )
  }

  return (
    <Link
      to={tab.to}
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[0.7rem] font-bold transition active:scale-95',
        active ? 'text-evo-accent' : 'text-evo-muted',
      ].join(' ')}
    >
      <span className="flex h-7 items-center justify-center">
        <TabIcon tab={tab} active={active} />
      </span>
      {tab.label}
    </Link>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const meta = routeMeta(pathname)
  const showTabs = !meta.focus

  // Cada pantalla empieza arriba: si no, se hereda el scroll de la anterior.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="no-x-scroll min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-evo-border/40 bg-evo-surface px-4 py-6 lg:flex">
        <Link to="/" aria-label="Ir al inicio" className="mb-8 flex items-center gap-3 px-2">
          <BrandLogo size="nav" />
          <span className="font-display text-xl font-bold">EvoFit</span>
        </Link>
        <nav aria-label="Principal" className="flex flex-col gap-1.5">
          {TABS.map((tab) => (
            <TabLink key={tab.id} tab={tab} pathname={pathname} variant="side" />
          ))}
        </nav>
      </aside>

      <div className="flex min-h-dvh w-full min-w-0 flex-col">
        <TopBar />

        <main
          className={[
            'no-x-scroll mx-auto w-full max-w-6xl flex-1 px-4 py-5 lg:px-8 lg:py-6',
            showTabs ? 'pb-28 lg:pb-6' : '',
          ].join(' ')}
        >
          <Outlet />
        </main>

        {showTabs ? (
          <nav
            aria-label="Principal"
            className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-evo-border/40 bg-evo-bg/95 px-2 pt-1.5 backdrop-blur-xl lg:hidden"
          >
            <ul className="mx-auto grid max-w-lg grid-cols-5">
              {TABS.map((tab) => (
                <li key={tab.id}>
                  <TabLink tab={tab} pathname={pathname} variant="bottom" />
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  )
}
