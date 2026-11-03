import { useEffect } from 'react'

type WakeLockSentinelLike = { release: () => Promise<void> }
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }

/** Mantiene la pantalla encendida mientras se entrena (si el navegador lo permite). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const nav = navigator as WakeLockNavigator
    if (!nav.wakeLock) return
    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    async function acquire() {
      try {
        const lock = await nav.wakeLock?.request('screen')
        if (cancelled) void lock?.release()
        else sentinel = lock ?? null
      } catch {
        // Batería baja o permiso denegado: no pasa nada.
      }
    }

    // El bloqueo se pierde al cambiar de app; se recupera al volver.
    function onVisible() {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => undefined)
    }
  }, [enabled])
}
