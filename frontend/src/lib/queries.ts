import { queryOptions } from '@tanstack/react-query'
import { api, type CatalogExercise, type LibraryExercise, type Routine } from './api'

/** Consultas compartidas entre pantallas: misma clave, misma caché. */
export const routinesQuery = queryOptions({
  queryKey: ['routines'],
  queryFn: async () => (await api.get<{ data: Routine[] }>('/routines')).data.data,
})

export const catalogExercisesQuery = queryOptions({
  queryKey: ['catalog-exercises'],
  queryFn: async () => (await api.get<{ data: CatalogExercise[] }>('/catalog-exercises')).data.data,
})

/** La biblioteca cambia solo con cada versión de la app: se pide una vez por sesión. */
export const libraryQuery = queryOptions({
  queryKey: ['exercise-library'],
  queryFn: async () => (await api.get<{ data: LibraryExercise[] }>('/exercises')).data.data,
  staleTime: 1000 * 60 * 60,
  gcTime: 1000 * 60 * 60 * 24,
})
