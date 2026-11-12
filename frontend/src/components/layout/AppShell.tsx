import { useQuery } from '@tanstack/react-query'
import { Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { Link, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { Avatar } from '../../features/profile/Avatar'
import { WelcomeGuideGate } from '../../features/guide/WelcomeGuide'
import { BrandLogo } from '../BrandLogo'
import { Icon, type IconName } from '../icons/Icon'
import { isTabActive, routeMeta, TABS, type Tab, type TabId } from './navigation'
import { unreadCountQuery } from '../../lib/social'
import { unreadMessagesQuery } from '../../lib/messages'
import { queryClient } from '../../lib/queryClient'

const TAB_ICONS: Record<Exclude<TabId, 'profile'>, IconName> = {
  home: 'home',
  calendar: 'calendar',
  routines: 'dumbbell',
  progress: 'progress',
}

const iconButton =
  'flex h-11 w-11 items-center justify-center rounded-full text-evo-text transition hover:bg-evo-surface-2 active:scale-90 active:bg-evo-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-evo-accent/40'

const badge =
  'evo-pop absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-evo-accent px-1 text-[0.7rem] font-extrabold text-[#1a120c] ring-2 ring-evo-bg'

function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const { user } = useAuth()

  if (tab.id === 'profile') {
    return (
      <Avatar
        name={user?.name}
        url={user?.avatar_url}
        size="xs"
        className={active ? 'ring-2 ring-[#1a120c]/70' : ''}
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
  const unreadMessages = useQuery(unreadMessagesQuery).data ?? 0

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-evo-border/30 bg-evo-bg">
      {meta.root ? (
        <div className="flex h-14 items-center gap-2.5 px-4 lg:h-16 lg:px-8">
          <BrandLogo size="xs" className="lg:hidden" decorative />
          <h1 className="min-w-0 flex-1 truncate font-display text-[1.9rem] font-extrabold uppercase leading-none tracking-tight">
            {meta.title}
          </h1>
          <nav aria-label="Acciones" className="-mr-2 flex items-center">
            <Link to="/search" className={iconButton} aria-label="Buscar personas">
              <Icon name="search" className="h-6 w-6" />
            </Link>
            <Link
              to="/notifications"
              className={`${iconButton} relative`}
              aria-label={unread > 0 ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}
            >
              <Icon name="bell" className="h-6 w-6" />
              {unread > 0 ? <span className={badge}>{unread > 9 ? '9+' : unread}</span> : null}
            </Link>
            <Link
              to="/messages"
              className={`${iconButton} relative`}
              aria-label={unreadMessages > 0 ? `Mensajes: ${unreadMessages} sin leer` : 'Mensajes'}
            >
              <Icon name="chat" className="h-6 w-6" />
              {unreadMessages > 0 ? <span className={badge}>{unreadMessages > 9 ? '9+' : unreadMessages}</span> : null}
            </Link>
          </nav>
        </div>
      ) : (
        <div className="grid h-14 grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 px-2 lg:h-16 lg:px-6">
          <button type="button" className={iconButton} aria-label="Volver" onClick={goBack}>
            <Icon name="back" className="h-6 w-6" />
          </button>
          <h1 className="truncate text-center font-display text-xl font-bold uppercase tracking-wide">{meta.title}</h1>
          <span aria-hidden />
        </div>
      )}
    </header>
  )
}

function TabLink({ tab, pathname, variant }: { tab: Tab; pathname: string; variant: 'bottom' | 'side' }) {
  const active = isTabActive(tab, pathname)

  function handleClick() {
    // Tocar la pestaña en la que ya estás sube al principio (y en Hoy, refresca el feed).
    if (pathname === tab.to) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      if (tab.id === 'home') void queryClient.invalidateQueries({ queryKey: ['feed'] })
    }
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
        'group relative z-10 flex min-h-14 flex-col items-center justify-center gap-1 text-[0.7rem] font-bold transition-colors duration-200',
        active ? 'text-evo-text' : 'text-evo-muted',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-8 w-14 items-center justify-center transition duration-200 group-active:scale-90',
          active ? 'text-[#1a120c]' : '',
        ].join(' ')}
      >
        <TabIcon tab={tab} active={active} />
      </span>
      {tab.label}
    </Link>
  )
}

/** Recuerda por dónde ibas en cada pantalla: al volver atrás apareces donde estabas, no arriba del todo. */
function useScrollMemory() {
  const location = useLocation()
  const type = useNavigationType()
  const positions = useRef(new Map<string, number>())

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  }, [])

  useLayoutEffect(() => {
    const key = location.key
    let timer = 0
    const saved = type === 'POP' ? positions.current.get(key) : undefined
    if (saved == null || saved === 0) {
      window.scrollTo({ top: 0 })
    } else {
      // El contenido puede tardar unos instantes en pintarse (datos en caché): se reintenta un poco.
      let tries = 0
      const restore = () => {
        window.scrollTo({ top: saved })
        if (Math.abs(window.scrollY - saved) > 4 && tries++ < 12) timer = window.setTimeout(restore, 50)
      }
      timer = window.setTimeout(restore, 0)
    }
    const remember = () => positions.current.set(key, window.scrollY)
    window.addEventListener('scroll', remember, { passive: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', remember)
    }
  }, [location.key, type])
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" role="status" aria-label="Cargando">
      <div className="evo-skeleton h-12 rounded-2xl" />
      <div className="evo-skeleton h-56 rounded-3xl" />
      <div className="evo-skeleton h-28 rounded-3xl" />
    </div>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const meta = routeMeta(pathname)
  const showTabs = !meta.focus

  const activeIndex = TABS.findIndex((tab) => isTabActive(tab, pathname))
  useScrollMemory()

  // El título de la pestaña del navegador (y lo que anuncia el lector de pantalla) sigue a la pantalla.
  useEffect(() => {
    document.title = meta.title === 'EvoFit' ? 'EvoFit' : `${meta.title} · EvoFit`
  }, [meta.title])

  return (
    <div className="no-x-scroll min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a
        href="#contenido"
        className="sr-only-focusable fixed left-3 top-3 z-[100] rounded-xl bg-evo-accent px-4 py-3 text-sm font-bold text-[#1a120c]"
      >
        Saltar al contenido
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-evo-border/40 bg-evo-surface px-4 py-6 lg:flex">
        <Link to="/" aria-label="Ir al inicio" className="mb-8 flex items-center gap-3 px-2">
          <BrandLogo size="nav" />
          <span className="font-display text-2xl font-extrabold uppercase">
            Evo<span className="text-evo-accent">Fit</span>
          </span>
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
          id="contenido"
          tabIndex={-1}
          className={[
            'outline-none',
            'no-x-scroll mx-auto w-full max-w-6xl flex-1 px-4 py-5 lg:px-8 lg:py-6',
            showTabs ? 'pb-28 lg:pb-6' : '',
          ].join(' ')}
        >
          {/* Cada pantalla entra con un fundido; mientras se descarga, la barra y las pestañas siguen en su sitio. */}
          <div key={pathname} className="evo-page">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        <WelcomeGuideGate />

        {showTabs ? (
          <nav
            aria-label="Principal"
            className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-evo-border/40 bg-evo-bg/95 px-2 pt-1.5 backdrop-blur-xl lg:hidden"
          >
            <ul className="relative mx-auto grid max-w-lg grid-cols-5">
              {/* Indicador de marca: se desliza hasta la pestaña activa. */}
              {activeIndex >= 0 ? (
                <li
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0 flex w-1/5 justify-center pt-1.5 transition-transform duration-300 ease-(--ease-evo)"
                  style={{ transform: `translateX(${activeIndex * 100}%)` }}
                >
                  <span className="h-8 w-14 rounded-[0.9rem_0.35rem] bg-evo-accent shadow-[0_4px_16px_rgba(255,122,54,0.35)]" />
                </li>
              ) : null}
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
