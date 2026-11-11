import { isAxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type WorkoutSession } from '../../lib/api'
import { invalidateTraining, queryClient } from '../../lib/queryClient'
import { clearWorkoutDraft, loadWorkoutDraft, saveWorkoutDraft } from '../../lib/workoutDrafts'
import { buildDrafts, mergeLocalDrafts, sessionExercises, toPayloadSet, type SetDraft } from './model'

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'error'

type RemovedSet = { routine_exercise_id: number; set_number: number }

const DEBOUNCE_MS = 800
const RETRY_STEPS_MS = [2_000, 5_000, 10_000, 20_000, 30_000]

function isNetworkError(error: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return isAxiosError(error) && error.response == null
}

/**
 * Autosave de una sesión:
 * - cada cambio se copia al momento en el móvil (localStorage);
 * - se envía al servidor con un pequeño retardo, de uno en uno (nunca dos PUT a la vez);
 * - si falla, reintenta solo con espera creciente y en cuanto vuelve la conexión.
 */
export function useWorkoutAutosave(sessionId: number, session: WorkoutSession | undefined) {
  const [drafts, setDraftsState] = useState<SetDraft[]>([])
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [hydrated, setHydrated] = useState(false)

  const draftsRef = useRef<SetDraft[]>([])
  const removedRef = useRef<RemovedSet[]>([])
  const editSeq = useRef(0)
  const savedSeq = useRef(0)
  const inflight = useRef<Promise<boolean> | null>(null)
  const debounceTimer = useRef<number | null>(null)
  const retryTimer = useRef<number | null>(null)
  const attempt = useRef(0)
  const hydratedFor = useRef<number | null>(null)
  const flushRef = useRef<() => Promise<boolean>>(async () => true)

  const persistLocal = useCallback(() => {
    saveWorkoutDraft(sessionId, { drafts: draftsRef.current, removed: removedRef.current })
  }, [sessionId])

  const clearTimers = useCallback(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current)
    if (retryTimer.current) window.clearTimeout(retryTimer.current)
    debounceTimer.current = null
    retryTimer.current = null
  }, [])

  const isDirty = useCallback(() => editSeq.current !== savedSeq.current, [])

  const send = useCallback(
    async (complete: boolean): Promise<boolean> => {
      // Uno detrás de otro: si hay un envío en curso, se espera y se manda el estado más nuevo.
      while (inflight.current) {
        await inflight.current
      }
      if (!complete && !isDirty()) return true

      const seq = editSeq.current
      const removed = [...removedRef.current]
      const payload = {
        sets: draftsRef.current.map(toPayloadSet),
        remove_sets: removed,
        complete,
      }

      const run = (async () => {
        setSaveState('saving')
        try {
          const { data } = await api.put<{ data: WorkoutSession }>(`/workout-sessions/${sessionId}/logs`, payload)
          attempt.current = 0
          removedRef.current = removedRef.current.filter(
            (item) => !removed.some((r) => r.routine_exercise_id === item.routine_exercise_id && r.set_number === item.set_number),
          )
          if (seq >= savedSeq.current) savedSeq.current = seq
          if (seq === editSeq.current) {
            clearWorkoutDraft(sessionId)
            setSaveState('saved')
          } else {
            persistLocal()
            setSaveState('pending')
          }
          // Solo se actualiza la caché con datos del servidor (previous_lifts, completed_at…);
          // lo que se ve en pantalla sigue saliendo de los borradores locales.
          queryClient.setQueryData(['workout-session', sessionId], data.data)
          void invalidateTraining()
          return true
        } catch (error) {
          persistLocal()
          setSaveState(isNetworkError(error) ? 'offline' : 'error')
          return false
        }
      })()

      inflight.current = run
      try {
        return await run
      } finally {
        inflight.current = null
      }
    },
    [isDirty, persistLocal, sessionId],
  )

  const scheduleRetry = useCallback(() => {
    if (retryTimer.current) return
    const delay = RETRY_STEPS_MS[Math.min(attempt.current, RETRY_STEPS_MS.length - 1)] ?? 30_000
    attempt.current += 1
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null
      void flushRef.current()
    }, delay)
  }, [])

  const flush = useCallback(async () => {
    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    if (!isDirty()) return true
    const ok = await send(false)
    if (!ok) scheduleRetry()
    else if (isDirty()) void flushRef.current()
    return ok
  }, [isDirty, scheduleRetry, send])

  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  const queueSave = useCallback(() => {
    setSaveState('pending')
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current)
    debounceTimer.current = window.setTimeout(() => {
      debounceTimer.current = null
      void flushRef.current()
    }, DEBOUNCE_MS)
  }, [])

  const commit = useCallback(
    (next: SetDraft[]) => {
      draftsRef.current = next
      editSeq.current += 1
      setDraftsState(next)
      persistLocal()
      queueSave()
    },
    [persistLocal, queueSave],
  )

  // Carga inicial: la copia local (si quedó algo sin enviar) manda sobre el servidor.
  useEffect(() => {
    if (!session || hydratedFor.current === sessionId) return
    hydratedFor.current = sessionId
    const local = loadWorkoutDraft(sessionId)
    if (local && local.drafts.length > 0) {
      const merged = mergeLocalDrafts(session, local.drafts)
      draftsRef.current = merged
      removedRef.current = local.removed
      setDraftsState(merged)
      editSeq.current = 1
      savedSeq.current = 0
      setHydrated(true)
      queueSave()
      return
    }
    const fresh = buildDrafts(session)
    draftsRef.current = fresh
    removedRef.current = []
    editSeq.current = 0
    savedSeq.current = 0
    setDraftsState(fresh)
    setHydrated(true)
  }, [session, sessionId, queueSave])

  // Reintento inmediato al recuperar conexión; guardado al salir o bloquear el móvil.
  useEffect(() => {
    const onOnline = () => {
      attempt.current = 0
      if (retryTimer.current) {
        window.clearTimeout(retryTimer.current)
        retryTimer.current = null
      }
      void flushRef.current()
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flushRef.current()
    }
    const onLeave = () => void flushRef.current()
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onLeave)
      void flushRef.current()
      clearTimers()
    }
  }, [clearTimers])

  const updateDraft = useCallback(
    (index: number, patch: Partial<SetDraft>) => {
      commit(draftsRef.current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
    },
    [commit],
  )

  const updateMany = useCallback(
    (patches: Array<{ index: number; patch: Partial<SetDraft> }>) => {
      const byIndex = new Map(patches.map((p) => [p.index, p.patch]))
      commit(draftsRef.current.map((item, i) => (byIndex.has(i) ? { ...item, ...byIndex.get(i) } : item)))
    },
    [commit],
  )

  const addSet = useCallback(
    (draft: SetDraft) => {
      const current = draftsRef.current
      // Se inserta justo después de la última serie de ese ejercicio.
      let insertAt = current.length
      for (let i = current.length - 1; i >= 0; i -= 1) {
        if (current[i]?.routine_exercise_id === draft.routine_exercise_id) {
          insertAt = i + 1
          break
        }
      }
      removedRef.current = removedRef.current.filter(
        (r) => !(r.routine_exercise_id === draft.routine_exercise_id && r.set_number === draft.set_number),
      )
      commit([...current.slice(0, insertAt), draft, ...current.slice(insertAt)])
    },
    [commit],
  )

  const removeSet = useCallback(
    (exerciseId: number, setNumber: number) => {
      removedRef.current = [...removedRef.current, { routine_exercise_id: exerciseId, set_number: setNumber }]
      commit(draftsRef.current.filter((d) => !(d.routine_exercise_id === exerciseId && d.set_number === setNumber)))
    },
    [commit],
  )

  /**
   * Tras cambiar o añadir un ejercicio en el servidor: se añaden sus series vacías y se
   * olvidan las del que ya no está (si no, el siguiente guardado las mandaría y fallaría).
   */
  const syncExercises = useCallback(
    (next: WorkoutSession) => {
      const ids = new Set(sessionExercises(next).map((exercise) => exercise.id))
      draftsRef.current = mergeLocalDrafts(next, draftsRef.current)
      removedRef.current = removedRef.current.filter((item) => ids.has(item.routine_exercise_id))
      setDraftsState(draftsRef.current)
      persistLocal()
    },
    [persistLocal],
  )

  /** Guarda y marca la sesión como completada. Devuelve false si no se pudo. */
  const complete = useCallback(async () => {
    clearTimers()
    const ok = await send(true)
    if (!ok) scheduleRetry()
    return ok
  }, [clearTimers, scheduleRetry, send])

  return {
    drafts,
    hydrated,
    saveState,
    updateDraft,
    updateMany,
    addSet,
    removeSet,
    complete,
    syncExercises,
    /** Envía ya lo pendiente; false si no se pudo (sin conexión…). */
    flushNow: () => flushRef.current(),
    retryNow: () => {
      attempt.current = 0
      void flushRef.current()
    },
  }
}
