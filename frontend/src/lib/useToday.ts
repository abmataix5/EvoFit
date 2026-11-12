import { useEffect, useState } from 'react'
import { localDateKey } from './dates'
import { queryClient } from './queryClient'

/**
 * La fecha de hoy ('YYYY-MM-DD'), que se pone al día sola cuando vuelves a la app.
 * Sin esto, dejar la app abierta por la noche enseñaba "¡Hecho por hoy!" a la mañana siguiente.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => localDateKey())

  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return
      const current = localDateKey()
      setToday((previous) => {
        if (previous === current) return previous
        // Día nuevo: la agenda y el resumen de la semana se vuelven a pedir.
        for (const key of [['calendar'], ['calendar-week'], ['progress-highlights']]) void queryClient.invalidateQueries({ queryKey: key })
        return current
      })
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  return today
}
