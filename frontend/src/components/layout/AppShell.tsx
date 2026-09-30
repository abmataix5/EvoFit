import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { BrandLogo } from '../BrandLogo'
import { useUiFeedback } from '../feedback/UiFeedback'
import { Button } from '../ui/Button'
import { formatHeaderDay } from '../../lib/motivation'

const navItems = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/routines', label: 'Rutinas', icon: '💪', end: false },
  { to: '/exercises', label: 'Ejercicios', icon: '🏋️', end: false },
  { to: '/calendar', label: 'Agenda', icon: '📅', end: false },
  { to: '/progress', label: 'Progreso', icon: '📈', end: false },
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

function initials(name?: string) {
  if (!name?.trim()) return 'EF'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'EF'
}

export function AppShell() {
  const { user, logout } = useAuth()
  const { confirm } = useUiFeedback()
  const location = useLocation()
  const title = resolveTitle(location.pathname)
  const headerDay = formatHeaderDay()

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
                    ? 'bg-evo-accent text-[#111] shadow-[0_10px_28px_rgba(255,107,44,0.32)]'
                    : 'text-evo-text hover:bg-evo-surface-2',
                ].join(' ')
              }
            >
              <span aria-hidden className="text-lg">
                {item.icon}
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
        <header className="safe-top sticky top-0 z-20 border-b border-evo-border/70 bg-[#151b26]/92 backdrop-blur-md">
          <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center px-3 lg:h-14 lg:px-8">
            <div className="justify-self-start">
              <p className="leading-none">
                <span className="font-display text-sm font-bold uppercase tracking-wide text-evo-accent">
                  {headerDay.day}
                </span>
                <span className="ml-1.5 font-display text-sm font-bold text-evo-text">
                  {headerDay.num}
                </span>
              </p>
            </div>

            <BrandLogo size="xs" className="justify-self-center" />

            <div className="justify-self-end text-right">
              <p className="truncate text-xs font-bold uppercase tracking-wide text-evo-muted lg:hidden">
                {title}
              </p>
              <div className="hidden items-center justify-end gap-3 lg:flex">
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

        <main className="no-x-scroll flex-1 px-3 py-4 pb-24 lg:px-8 lg:py-6 lg:pb-10">
          <Outlet />
        </main>

        <nav
          aria-label="Navegación móvil"
          className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-evo-border bg-evo-surface/95 backdrop-blur-md lg:hidden"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-6 px-0.5 pt-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.62rem] font-bold transition',
                      isActive ? 'text-evo-accent' : 'text-evo-muted hover:text-evo-text',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden
                        className={[
                          'flex h-7 w-7 items-center justify-center rounded-lg text-sm leading-none',
                          isActive ? 'bg-evo-accent/20' : '',
                        ].join(' ')}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[0.62rem] font-bold text-evo-muted transition hover:text-evo-text"
                aria-label="Cuenta y cerrar sesión"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-evo-border bg-evo-surface-2 text-[0.65rem] font-bold text-evo-text"
                  aria-hidden
                >
                  {initials(user?.name)}
                </span>
                Perfil
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
