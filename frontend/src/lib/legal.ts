/** Datos del titular y enlaces legales, en un solo sitio para que todas las páginas digan lo mismo. */
export const LEGAL = {
  owner: 'Abel Mataix Pascual',
  site: 'evofit.fitness',
  url: 'https://evofit.fitness',
  /** Dirección a la que escribir para privacidad, derechos y avisos. */
  email: 'info@evofit.fitness',
  minAge: 16,
  /** Fecha de la última revisión de los textos. */
  updated: '12 de noviembre de 2026',
} as const

export const LEGAL_LINKS = [
  { to: '/privacidad', label: 'Privacidad' },
  { to: '/condiciones', label: 'Condiciones de uso' },
  { to: '/cookies', label: 'Cookies' },
  { to: '/aviso-legal', label: 'Aviso legal' },
] as const
