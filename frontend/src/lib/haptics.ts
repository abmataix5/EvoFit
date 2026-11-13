import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { IS_APP } from './platform'

type HapticOptions = {
  /** Avisos que hay que notar siempre (fin del descanso): no se callan con "reducir movimiento". */
  always?: boolean
}

/**
 * Vibración que confirma un toque (un número, en ms) o avisa de algo (un patrón de pulsos y pausas).
 *
 * En el navegador solo vibra Android; el iPhone no lo permite. Dentro de las apps de iOS y Android
 * se usa el motor del móvil: un golpecito para los toques, un aviso para los patrones cortos y
 * la vibración larga del sistema para los patrones largos.
 */
export function haptic(pattern: number | number[] = 12, { always = false }: HapticOptions = {}) {
  try {
    if (!always && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return

    if (IS_APP) {
      const total = Array.isArray(pattern) ? pattern.reduce((sum, ms) => sum + ms, 0) : pattern
      const done = !Array.isArray(pattern)
        ? Haptics.impact({ style: ImpactStyle.Light })
        : total >= 600
          ? Haptics.vibrate({ duration: 500 })
          : Haptics.notification({ type: NotificationType.Success })
      void done.catch(() => undefined)
      return
    }

    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    navigator.vibrate(pattern)
  } catch {
    // Sin permiso o sin motor de vibración: no pasa nada.
  }
}
