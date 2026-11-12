/**
 * Pequeña vibración que confirma un toque importante (dar fuerza, completar una serie).
 * Solo existe en Android; en iPhone no hace nada. Respeta "reducir movimiento".
 */
export function haptic(pattern: number | number[] = 12) {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return
    navigator.vibrate(pattern)
  } catch {
    // Sin permiso o sin motor de vibración: no pasa nada.
  }
}
