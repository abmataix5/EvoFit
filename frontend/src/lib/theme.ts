import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'dark' | 'light' | 'auto'

const KEY = 'evofit:theme'
const COLORS = { dark: '#0c1219', light: '#f2f4f7' }

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'auto' ? value : 'dark'
  } catch {
    return 'dark'
  }
}

function systemLight() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
}

function apply(preference: ThemePreference) {
  const theme = preference === 'light' || (preference === 'auto' && systemLight()) ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme])
}

/** Preferencia de tema (oscuro, claro o según el sistema), guardada en este dispositivo. */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference)

  useEffect(() => {
    apply(preference)
    if (preference !== 'auto' || typeof matchMedia !== 'function') return
    const media = matchMedia('(prefers-color-scheme: light)')
    const onChange = () => apply('auto')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const change = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // modo privado: se aplica igual en esta visita
    }
    setPreference(next)
  }, [])

  return { preference, setPreference: change }
}
