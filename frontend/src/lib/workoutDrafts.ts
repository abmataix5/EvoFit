/**
 * Copia local de lo que se está apuntando en una sesión.
 * Si no hay cobertura en el gimnasio o el móvil cierra la app, las series siguen aquí
 * y se envían en cuanto vuelve la conexión.
 */
const PREFIX = 'evofit:workout-draft:'

export type StoredSetDraft = {
  routine_exercise_id: number
  set_number: number
  weight_kg: string
  reps: string
  minutes: string
  seconds: string
  rpe: string
  notes: string
  done: boolean
}

export type StoredWorkoutDraft = {
  drafts: StoredSetDraft[]
  removed: Array<{ routine_exercise_id: number; set_number: number }>
  updatedAt: number
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadWorkoutDraft(sessionId: number): StoredWorkoutDraft | null {
  const storage = safeStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(PREFIX + sessionId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredWorkoutDraft
    if (!Array.isArray(parsed?.drafts)) return null
    return { drafts: parsed.drafts, removed: parsed.removed ?? [], updatedAt: parsed.updatedAt ?? 0 }
  } catch {
    return null
  }
}

export function saveWorkoutDraft(sessionId: number, draft: Omit<StoredWorkoutDraft, 'updatedAt'>) {
  const storage = safeStorage()
  if (!storage) return
  try {
    storage.setItem(PREFIX + sessionId, JSON.stringify({ ...draft, updatedAt: Date.now() }))
  } catch {
    // Almacenamiento lleno o bloqueado: seguimos solo con memoria.
  }
}

export function clearWorkoutDraft(sessionId: number) {
  try {
    safeStorage()?.removeItem(PREFIX + sessionId)
  } catch {
    /* nada */
  }
}

export function clearAllWorkoutDrafts() {
  const storage = safeStorage()
  if (!storage) return
  try {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i)
      if (key?.startsWith(PREFIX)) storage.removeItem(key)
    }
  } catch {
    /* nada */
  }
}
