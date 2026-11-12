import { useSyncExternalStore } from 'react'
import type { User } from '../../lib/api'

/** La guía se puede abrir a mano (desde Configuración) además de salir sola la primera vez. */
let requested = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function openGuide() {
  requested = true
  emit()
}

export function closeGuide() {
  requested = false
  emit()
}

export function useGuideRequested() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => requested,
  )
}

const seenKey = (userId: number) => `evofit:guide-seen:${userId}`
const NEW_ACCOUNT_DAYS = 7

/**
 * ¿Toca enseñar la guía sola? Solo a cuentas recién creadas que aún no la han visto (o saltado)
 * en este dispositivo. A quien ya lleva tiempo usando la app no se le interrumpe.
 */
export function shouldAutoShowGuide(user: User): boolean {
  try {
    if (localStorage.getItem(seenKey(user.id))) return false
  } catch {
    // Sin almacenamiento no se puede recordar que ya se vio: mejor no insistir en cada visita.
    return false
  }
  if (!user.member_since) return false
  const created = new Date(`${user.member_since}T00:00:00`).getTime()
  return Date.now() - created < NEW_ACCOUNT_DAYS * 86_400_000
}

export function markGuideSeen(userId: number) {
  try {
    localStorage.setItem(seenKey(userId), '1')
  } catch {
    // Modo privado: no pasa nada.
  }
}
