import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { BrandLogo } from '../BrandLogo'
import { useUiFeedback } from '../feedback/UiFeedback'
import { Icon } from '../icons/Icon'
import { Button } from '../ui/Button'
import { formatHeaderDay, helloLine } from '../../lib/motivation'

const navItems = [
  { to: '/', label: 'Hoy', icon: 'home' as const, end: true },
  { to: '/routines', label: 'Rutinas', icon: 'routines' as const, end: false },
  { to: '/exercises', label: 'Catálogo', icon: 'catalog' as const, end: false },
  { to: '/calendar', label: 'Agenda', icon: 'calendar' as const, end: false },
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
  if (pathname.startsWith('/routines/') && pathname !== '/routines/new') {
    return 'Detalle'
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
          <BrandLogo size="sm" />
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

      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col overflow-x-hidden">
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

            <BrandLogo size="xs" className="justify-self-center" />

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

        <header className="safe-top sticky top-0 z-50 border-b border-white/10 bg-evo-bg/80 backdrop-blur-xl lg:hidden">
          <div className="grid h-[4.75rem] grid-cols-[3.5rem_1fr_3.5rem] items-center px-4">
            <button
              type="button"
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-evo-surface-2 text-evo-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition active:scale-95"
              aria-expanded={menuOpen}
              aria-controls="mobile-drawer"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="relative block h-7 w-7">
                <Icon
                  name="menu"
                  className={[
                    'absolute inset-0 h-7 w-7 transition duration-300',
                    menuOpen ? 'scale-75 opacity-0' : 'scale-100 opacity-100',
                  ].join(' ')}
                />
                <Icon
                  name="close"
                  className={[
                    'absolute inset-0 h-7 w-7 transition duration-300',
                    menuOpen ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                  ].join(' ')}
                />
              </span>
            </button>
            <BrandLogo size="sm" className="justify-self-center" />
            <span aria-hidden />
          </div>
        </header>

        <main className="no-x-scroll flex-1 px-3 py-4 lg:px-8 lg:py-6">
          <Outlet />
        </main>

        <button
          type="button"
          className={[
            'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-out lg:hidden',
            menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
          aria-label="Cerrar menú"
          tabIndex={menuOpen ? 0 : -1}
          onClick={() => setMenuOpen(false)}
        />

        <aside
          id="mobile-drawer"
          inert={!menuOpen}
          className={[
            'fixed bottom-0 left-0 z-40 flex w-full flex-col bg-evo-bg/95 px-5 pb-6 backdrop-blur-xl lg:hidden',
            'top-[calc(env(safe-area-inset-top)+4.75rem)]',
            'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            menuOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="mb-6 pt-6">
            <p className="truncate font-display text-4xl font-bold tracking-tight">{helloLine(user?.name)}</p>
            <p className="mt-1 text-base font-semibold text-evo-muted">
              {headerDay.day} {headerDay.num} · {title}
            </p>
          </div>

          <nav aria-label="Principal" className="flex flex-1 flex-col gap-3 overflow-y-auto">
            {navItems.map((item, index) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={{ transitionDelay: menuOpen ? `${80 + index * 50}ms` : '0ms' }}
                className={({ isActive }) =>
                  [
                    'flex min-h-[4.5rem] items-center gap-4 rounded-3xl px-4 text-xl font-bold',
                    'transition duration-300 ease-out motion-reduce:transition-none',
                    menuOpen ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0',
                    isActive
                      ? 'bg-evo-accent text-[#1a120c]'
                      : 'bg-evo-surface text-evo-text active:bg-evo-surface-2',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={[
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                        isActive ? 'bg-black/10' : 'bg-evo-surface-2',
                      ].join(' ')}
                    >
                      <Icon name={item.icon} className="h-6 w-6" />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div
            style={{ transitionDelay: menuOpen ? '320ms' : '0ms' }}
            className={[
              'safe-bottom mt-6 space-y-3 rounded-3xl bg-evo-surface p-5',
              'transition duration-300 ease-out motion-reduce:transition-none',
              menuOpen ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
            ].join(' ')}
          >
            <p className="truncate font-display text-2xl font-bold">{user?.name}</p>
            <p className="truncate text-base text-evo-muted">{user?.email}</p>
            <Button variant="secondary" fullWidth size="lg" onClick={() => void handleLogout()}>
              Cerrar sesión
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
