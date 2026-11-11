import { queryOptions } from '@tanstack/react-query'
import { api, type CatalogExercise, type Routine } from './api'

/** Consultas compartidas entre pantallas: misma clave, misma caché. */
export const routinesQuery = queryOptions({
  queryKey: ['routines'],
  queryFn: async () => (await api.get<{ data: Routine[] }>('/routines')).data.data,
})

export const catalogExercisesQuery = queryOptions({
  queryKey: ['catalog-exercises'],
  queryFn: async () => (await api.get<{ data: CatalogExercise[] }>('/catalog-exercises')).data.data,
})
