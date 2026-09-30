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
    return () => window.removeEventListener('keydown', onKey)
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

        <main className="no-x-scroll flex-1 px-3 pb-6 pt-16 lg:px-8 lg:py-6 lg:pb-10">
          <Outlet />
        </main>

        <button
          type="button"
          className="safe-top fixed left-3 top-3 z-30 flex h-12 w-12 items-center justify-center rounded-2xl border border-evo-border bg-evo-surface text-evo-text shadow-lg lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-drawer"
          aria-label="Abrir menú"
          onClick={() => setMenuOpen(true)}
        >
          <Icon name="menu" />
        </button>

        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/55 lg:hidden"
              aria-label="Cerrar menú"
              onClick={() => setMenuOpen(false)}
            />
            <aside
              id="mobile-drawer"
              className="safe-top fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col border-r border-evo-border bg-evo-surface px-4 py-4 lg:hidden"
            >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-bold">{helloLine(user?.name)}</p>
              <p className="text-sm font-semibold text-evo-muted">
                {headerDay.day} {headerDay.num}
              </p>
            </div>
            <button
              type="button"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-evo-border"
              aria-label="Cerrar menú"
              onClick={() => setMenuOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>

          <nav aria-label="Principal" className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex min-h-14 items-center gap-3 rounded-2xl px-4 text-base font-bold transition',
                    isActive ? 'bg-evo-accent text-[#1a120c]' : 'text-evo-text hover:bg-evo-surface-2',
                  ].join(' ')
                }
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="safe-bottom mt-4 space-y-3 rounded-2xl border border-evo-border bg-evo-surface-2 p-4">
            <p className="truncate font-display text-lg font-bold">{user?.name}</p>
            <p className="truncate text-sm text-evo-muted">{user?.email}</p>
            <Button variant="secondary" fullWidth onClick={() => void handleLogout()}>
              Cerrar sesión
            </Button>
          </div>
        </aside>
          </>
        ) : null}
      </div>
    </div>
  )
}
