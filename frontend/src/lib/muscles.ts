/** Grupos musculares sugeridos (el campo admite cualquier texto). */
export const MUSCLE_GROUPS = [
  'Pecho',
  'Espalda',
  'Hombro',
  'Bíceps',
  'Tríceps',
  'Cuádriceps',
  'Femoral',
  'Glúteo',
  'Gemelo',
  'Core',
  'Cardio',
  'Cuerpo completo',
] as const

/** Minúsculas y sin tildes, para buscar y agrupar sin que importe cómo se escribió. */
export function normalizeText(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** "pecho" → "Pecho"; vacío → "Sin grupo". */
export function muscleLabel(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return 'Sin grupo'
  return value.charAt(0).toUpperCase() + value.slice(1)
}
