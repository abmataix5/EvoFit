import { api, type CatalogExercise } from './api'
import { queryClient } from './queryClient'
import type { TimeDirection, TrackingMode } from './tracking'

export type CatalogDraft = {
  name: string
  target_muscle: string
  tracking_mode: TrackingMode
  time_direction: TimeDirection
  default_sets: number
  default_reps: number
  /** Objetivo en segundos (solo ejercicios por tiempo). */
  default_duration_seconds: number
  rest_seconds: number
}

export function emptyCatalogDraft(name = ''): CatalogDraft {
  return {
    name,
    target_muscle: '',
    tracking_mode: 'weight_reps',
    time_direction: 'faster',
    default_sets: 3,
    default_reps: 10,
    default_duration_seconds: 60,
    rest_seconds: 90,
  }
}

export function draftFromCatalog(item: CatalogExercise): CatalogDraft {
  return {
    name: item.name,
    target_muscle: item.target_muscle ?? '',
    tracking_mode: item.tracking_mode ?? 'weight_reps',
    time_direction: item.time_direction ?? 'faster',
    default_sets: item.default_sets,
    default_reps: item.default_reps,
    default_duration_seconds: item.default_duration_seconds ?? 60,
    rest_seconds: item.rest_seconds,
  }
}

function payloadFrom(draft: CatalogDraft) {
  const timed = draft.tracking_mode !== 'weight_reps'
  return {
    name: draft.name.trim(),
    target_muscle: draft.target_muscle.trim() || null,
    tracking_mode: draft.tracking_mode,
    time_direction: timed ? draft.time_direction : 'faster',
    default_sets: draft.default_sets,
    default_reps: draft.default_reps,
    default_duration_seconds: timed ? draft.default_duration_seconds : null,
    rest_seconds: draft.rest_seconds,
  }
}

/** Crea o actualiza un ejercicio del catálogo y refresca las listas que lo usan. */
export async function saveCatalogExercise(draft: CatalogDraft, id?: number): Promise<CatalogExercise> {
  const payload = payloadFrom(draft)
  const exercise = id
    ? (await api.patch<{ data: CatalogExercise }>(`/catalog-exercises/${id}`, payload)).data.data
    : (await api.post<{ exercise: CatalogExercise }>('/catalog-exercises', payload)).data.exercise
  await queryClient.invalidateQueries({ queryKey: ['catalog-exercises'] })
  if (id) {
    // El nombre y el modo se copian a las rutinas que lo usan.
    void queryClient.invalidateQueries({ queryKey: ['routines'] })
    void queryClient.invalidateQueries({ queryKey: ['routine'] })
  }
  return exercise
}

/** Añade un ejercicio de la biblioteca a "Mis ejercicios" (si ya estaba, devuelve el tuyo). */
export async function addFromLibrary(exerciseId: number): Promise<CatalogExercise> {
  const { data } = await api.post<{ exercise: CatalogExercise }>('/catalog-exercises', { exercise_id: exerciseId })
  await queryClient.invalidateQueries({ queryKey: ['catalog-exercises'] })
  return data.exercise
}

/** Enlaza (o desenlaza con null) un ejercicio propio con uno de la biblioteca. */
export async function linkToLibrary(catalogId: number, exerciseId: number | null): Promise<CatalogExercise> {
  const { data } = await api.patch<{ data: CatalogExercise }>(`/catalog-exercises/${catalogId}`, { exercise_id: exerciseId })
  await queryClient.invalidateQueries({ queryKey: ['catalog-exercises'] })
  void queryClient.invalidateQueries({ queryKey: ['routine'] })
  return data.data
}
