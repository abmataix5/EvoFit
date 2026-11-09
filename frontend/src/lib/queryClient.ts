import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

function shouldRetry(failureCount: number, error: unknown) {
  if (isAxiosError(error)) {
    const status = error.response?.status
    // Errores del cliente (404, 403, 422…) no se arreglan reintentando.
    if (status != null && status >= 400 && status < 500 && status !== 408 && status !== 429) return false
  }
  return failureCount < 2
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})

/** Prefijos de caché que dependen de lo entrenado: se refrescan tras guardar series. */
export const TRAINING_KEYS = [
  ['calendar'],
  ['calendar-week'],
  ['routine-history'],
  ['progress-insights'],
  ['progress-highlights'],
  ['progress-muscles'],
  ['exercise-history'],
] as const

export async function invalidateTraining() {
  await Promise.all(TRAINING_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })))
}
