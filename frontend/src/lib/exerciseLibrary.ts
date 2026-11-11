import type { LibraryExercise } from './api'
import { EQUIPMENT_FILTERS, normalizeText } from './muscles'

const searchText = new WeakMap<LibraryExercise, string>()

/** Texto en el que se busca: nombre, sinónimos y músculo, sin tildes. */
function haystack(exercise: LibraryExercise): string {
  let text = searchText.get(exercise)
  if (text === undefined) {
    text = normalizeText([exercise.name, ...exercise.aliases, exercise.muscle_label].join(' | '))
    searchText.set(exercise, text)
  }
  return text
}

export type LibraryFilter = { term: string; muscle: string | null; equipment: string | null }

/** Filtra y ordena: primero los que empiezan por lo buscado, luego los que lo contienen. */
export function filterLibrary(items: LibraryExercise[], { term, muscle, equipment }: LibraryFilter): LibraryExercise[] {
  const q = normalizeText(term)
  const words = q.split(/\s+/).filter(Boolean)
  const allowed = equipment ? EQUIPMENT_FILTERS.find((f) => f.id === equipment)?.matches ?? [] : null

  const result = items.filter((item) => {
    if (muscle && item.muscle !== muscle) return false
    if (allowed && !allowed.includes(item.equipment)) return false
    if (words.length === 0) return true
    const text = haystack(item)
    return words.every((word) => text.includes(word))
  })

  if (!q) return result
  const starts = (item: LibraryExercise) => (normalizeText(item.name).startsWith(q) ? 0 : 1)
  return result.sort((a, b) => starts(a) - starts(b) || a.name.localeCompare(b.name, 'es'))
}

export const MECHANIC_LABELS: Record<LibraryExercise['mechanic'], string> = {
  compound: 'Multiarticular',
  isolation: 'Aislamiento',
  core: 'Core',
  power: 'Potencia',
  carry: 'Carga / arrastre',
  cardio: 'Cardio',
}
