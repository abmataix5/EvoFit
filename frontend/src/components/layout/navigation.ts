import { matchPath } from 'react-router-dom'

export type TabId = 'home' | 'calendar' | 'routines' | 'progress' | 'profile'

export type Tab = {
  id: TabId
  to: string
  label: string
  /** Rutas que encienden la pestaña (también sus pantallas de detalle). */
  matches: string[]
}

export const TABS: Tab[] = [
  { id: 'home', to: '/', label: 'Hoy', matches: ['/'] },
  { id: 'calendar', to: '/calendar', label: 'Agenda', matches: ['/calendar'] },
  {
    id: 'routines',
    to: '/routines',
    label: 'Rutinas',
    matches: ['/routines', '/routines/*', '/exercises', '/exercise-history/*'],
  },
  { id: 'progress', to: '/progress', label: 'Progreso', matches: ['/progress'] },
  { id: 'profile', to: '/profile', label: 'Tú', matches: ['/profile', '/profile/*'] },
]

export type RouteMeta = {
  title: string
  /** Pantalla raíz de una pestaña: título grande y acciones (buscar, avisos). */
  root: boolean
  /** A dónde vuelve el botón atrás si no hay historial (p. ej. al abrir un enlace directo). */
  parent?: string
  /** Pantalla de concentración (entreno, formularios largos): sin pestañas abajo. */
  focus?: boolean
}

const ROUTES: Array<{ pattern: string; meta: (params: Record<string, string | undefined>) => RouteMeta }> = [
  { pattern: '/', meta: () => ({ title: 'Hoy', root: true }) },
  { pattern: '/calendar', meta: () => ({ title: 'Agenda', root: true }) },
  { pattern: '/routines', meta: () => ({ title: 'Rutinas', root: true }) },
  { pattern: '/progress', meta: () => ({ title: 'Progreso', root: true }) },
  { pattern: '/profile', meta: () => ({ title: 'Tú', root: true }) },
  { pattern: '/routines/new', meta: () => ({ title: 'Nueva rutina', root: false, parent: '/routines', focus: true }) },
  { pattern: '/routines/:id/edit', meta: (p) => ({ title: 'Editar rutina', root: false, parent: `/routines/${p.id}`, focus: true }) },
  { pattern: '/routines/:id', meta: () => ({ title: 'Rutina', root: false, parent: '/routines' }) },
  { pattern: '/exercises', meta: () => ({ title: 'Ejercicios', root: false, parent: '/routines' }) },
  { pattern: '/exercise-history/:id', meta: () => ({ title: 'Historial', root: false, parent: '/routines' }) },
  { pattern: '/workout/:id', meta: () => ({ title: 'Entreno', root: false, parent: '/', focus: true }) },
  { pattern: '/profile/edit', meta: () => ({ title: 'Editar perfil', root: false, parent: '/profile', focus: true }) },
  { pattern: '/search', meta: () => ({ title: 'Buscar', root: false, parent: '/' }) },
  { pattern: '/notifications', meta: () => ({ title: 'Notificaciones', root: false, parent: '/' }) },
]

export function routeMeta(pathname: string): RouteMeta {
  for (const route of ROUTES) {
    const match = matchPath({ path: route.pattern, end: true }, pathname)
    if (match) return route.meta(match.params)
  }
  return { title: 'EvoFit', root: false, parent: '/' }
}

export function isTabActive(tab: Tab, pathname: string): boolean {
  return tab.matches.some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null)
}
