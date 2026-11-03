import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { BrandLogo } from '../BrandLogo'
import { useUiFeedback } from '../feedback/UiFeedback'
import { Icon } from '../icons/Icon'
import { Button } from '../ui/Button'
import { formatHeaderDay, helloLine } from '../../lib/motivation'

const navItems = [
  { to: '/', label: 'Hoy', icon: 'home' as const, end: true },
  { to: '/calendar', label: 'Agenda', icon: 'calendar' as const, end: false },
  { to: '/routines', label: 'Rutinas', icon: 'routines' as const, end: false },
  { to: '/exercises', label: 'Catálogo', icon: 'catalog' as const, end: false },
  { to: '/progress', label: 'Progreso', icon: 'progress' as const, end: false },
]

const pageTitles: Record<string, string> = {
  '/': 'Hoy',
  '/routines': 'Rutinas',
  '/routines/new': 'Nueva',
  '/exercises': 'Catálogo',
  '/calendar': 'Agenda',
  '/progress': 'Progreso',
}

function resolveTitle(pathname: string) {
  if (pathname.startsWith('/routines/') && pathname !== '/routines/new' && !pathname.endsWith('/edit')) {
    return 'Detalle'
  }
  if (pathname.startsWith('/exercise-history/')) {
    return 'Historial'
  }
  if (pathname.endsWith('/edit')) {
    return 'Editar'
  }
  if (pathname.startsWith('/workout/')) {
    return 'Sesión'
  }
  return pageTitles[pathname] ?? 'EvoFit'
}

export function AppShell() {
  const { user, logout } = useAuth()
  const { confirm } = useUiFeedback()
  const location = useLocation()
  const title = resolveTitle(location.pathname)
  const headerDay = formatHeaderDay()
  const [menuOpen, setMenuOpen] = useState(false)
  // En plena sesión no hay pestañas: la pantalla es para apuntar series.
  const hideTabs = location.pathname.startsWith('/workout/')

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  async function handleLogout() {
    const ok = await confirm({
      title: 'Cerrar sesión',
      message: '¿Quieres salir de EvoFit?',
      confirmLabel: 'Salir',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (ok) await logout()
  }

  return (
    <div className="no-x-scroll min-h-dvh lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r border-evo-border bg-evo-surface lg:flex lg:flex-col lg:px-5 lg:py-6">
        <div className="mb-8 flex items-center gap-3 rounded-2xl bg-evo-surface-2 p-3">
          <Link to="/" aria-label="Ir al inicio">
            <BrandLogo size="nav" />
          </Link>
          <div>
            <p className="font-display text-xl font-bold">EvoFit</p>
            <p className="text-xs font-medium text-evo-muted">Entrena · Mejora · Evoluciona</p>
          </div>
        </div>

        <nav aria-label="Principal" className="flex flex-1 flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex min-h-14 items-center gap-3 rounded-2xl px-4 text-base font-bold transition',
                  isActive
                    ? 'bg-evo-accent text-[#1a120c] shadow-[0_10px_28px_rgba(255,138,76,0.28)]'
                    : 'text-evo-text hover:bg-evo-surface-2',
                ].join(' ')
              }
            >
              <span aria-hidden>
                <Icon name={item.icon} />
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3 rounded-2xl border-2 border-evo-border bg-evo-surface-2 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-evo-muted">Cuenta</p>
            <p className="mt-1 font-display text-lg font-bold">{user?.name}</p>
            <p className="truncate text-sm text-evo-muted">{user?.email}</p>
          </div>
          <Button variant="secondary" fullWidth onClick={() => void handleLogout()}>
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col overflow-x-clip">
        <header className="safe-top sticky top-0 z-20 hidden border-b border-evo-border/70 bg-[#151b26]/92 backdrop-blur-md lg:block">
          <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center px-3 lg:h-14 lg:px-8">
            <div className="min-w-0 justify-self-start">
              <p className="truncate font-display text-sm font-semibold leading-none text-evo-text">
                {helloLine(user?.name)}
              </p>
              <p className="mt-1 text-[0.7rem] font-semibold uppercase tracking-wide text-evo-muted">
                {headerDay.day} {headerDay.num}
              </p>
            </div>

            <Link to="/" aria-label="Ir al inicio" className="justify-self-center">
              <BrandLogo size="nav" />
            </Link>

            <div className="justify-self-end text-right">
              <div className="flex items-center justify-end gap-3">
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-semibold">{user?.name}</p>
                  <p className="truncate text-xs text-evo-muted">{title}</p>
                </div>
                <Button variant="ghost" className="!min-h-10 !px-3" onClick={() => void handleLogout()}>
                  Salir
                </Button>
              </div>
            </div>
          </div>
        </header>

        <header className="safe-top sticky top-0 z-50 border-b border-white/10 bg-evo-bg/85 backdrop-blur-xl lg:hidden">
          <div className="grid h-14 grid-cols-[3rem_1fr_3rem] items-center px-3">
            <span aria-hidden />
            <Link to="/" aria-label="Ir al inicio" className="justify-self-center">
              <BrandLogo size="nav" />
            </Link>
            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center justify-self-end rounded-2xl bg-evo-surface-2 text-evo-text transition active:scale-95"
              aria-expanded={menuOpen}
              aria-controls="account-drawer"
              aria-label={menuOpen ? 'Cerrar cuenta' : 'Abrir cuenta'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? 'close' : 'user'} className="h-6 w-6" />
            </button>
          </div>
        </header>

        <main
          className={[
            'no-x-scroll flex-1 px-4 py-5 lg:px-8 lg:py-6',
            hideTabs ? '' : 'pb-28 lg:pb-6',
          ].join(' ')}
        >
          <Outlet />
        </main>

        {!hideTabs ? (
          <nav
            aria-label="Principal"
            className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-evo-bg/95 px-2 pt-1.5 backdrop-blur-xl lg:hidden"
          >
            <ul className="mx-auto grid max-w-lg grid-cols-5">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.7rem] font-bold transition',
                        isActive ? 'text-evo-accent' : 'text-evo-muted active:bg-evo-surface-2',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={[
                            'flex h-8 w-12 items-center justify-center rounded-full transition',
                            isActive ? 'bg-evo-accent/20' : '',
                          ].join(' ')}
                        >
                          <Icon name={item.icon} className="h-6 w-6" />
                        </span>
                        {item.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {menuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-label="Cerrar cuenta"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}

        <aside
          id="account-drawer"
          inert={!menuOpen}
          aria-label="Cuenta"
          className={[
            'fixed right-0 top-[calc(env(safe-area-inset-top)+3.5rem)] z-40 flex w-[min(20.5rem,86vw)] flex-col rounded-bl-3xl border-l border-white/10 bg-evo-surface px-4 pb-5 shadow-2xl lg:hidden',
            'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            menuOpen ? 'translate-x-0' : 'translate-x-full',
          ].join(' ')}
        >
          <div className="pt-5">
            <p className="truncate font-display text-2xl font-bold tracking-tight">{helloLine(user?.name)}</p>
            <p className="mt-1 text-sm font-semibold text-evo-muted">
              {headerDay.day} {headerDay.num}
            </p>
          </div>
          <div className="safe-bottom mt-5 space-y-3 rounded-3xl bg-evo-surface-2 p-4">
            <p className="truncate font-display text-lg font-bold">{user?.name}</p>
            <p className="truncate text-sm text-evo-muted">{user?.email}</p>
            <Button variant="secondary" fullWidth size="lg" onClick={() => void handleLogout()}>
              Cerrar sesión
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
