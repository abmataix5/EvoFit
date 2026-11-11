/** Grupos musculares, en el orden en que se muestran (las etiquetas coinciden con las del servidor). */
export const MUSCLES: Array<{ key: string; label: string }> = [
  { key: 'chest', label: 'Pecho' },
  { key: 'back', label: 'Espalda' },
  { key: 'shoulders', label: 'Hombro' },
  { key: 'traps', label: 'Trapecio' },
  { key: 'biceps', label: 'Bíceps' },
  { key: 'triceps', label: 'Tríceps' },
  { key: 'forearms', label: 'Antebrazo' },
  { key: 'quads', label: 'Cuádriceps' },
  { key: 'hamstrings', label: 'Femoral' },
  { key: 'glutes', label: 'Glúteo' },
  { key: 'calves', label: 'Gemelo' },
  { key: 'adductors', label: 'Aductores' },
  { key: 'abductors', label: 'Abductores' },
  { key: 'core', label: 'Core' },
  { key: 'lower_back', label: 'Lumbar' },
  { key: 'full_body', label: 'Cuerpo completo' },
  { key: 'cardio', label: 'Cardio' },
]

/** Para elegir el músculo de un ejercicio propio (texto libre, con estas sugerencias). */
export const MUSCLE_GROUPS = MUSCLES.map((m) => m.label)

export function muscleKeyLabel(key: string): string {
  return MUSCLES.find((m) => m.key === key)?.label ?? key
}

export const EQUIPMENT: Record<string, string> = {
  barbell: 'Barra',
  dumbbell: 'Mancuernas',
  machine: 'Máquina',
  cable: 'Polea',
  smith: 'Multipower',
  bodyweight: 'Peso corporal',
  kettlebell: 'Kettlebell',
  ez_bar: 'Barra Z',
  trap_bar: 'Barra hexagonal',
  band: 'Goma',
  plate: 'Disco',
  medicine_ball: 'Balón medicinal',
  cardio_machine: 'Máquina de cardio',
  other: 'Otros',
}

/** Filtros de material agrupados (los poco frecuentes van en "Otros"). */
export const EQUIPMENT_FILTERS: Array<{ id: string; label: string; matches: string[] }> = [
  { id: 'barbell', label: 'Barra', matches: ['barbell', 'ez_bar', 'trap_bar'] },
  { id: 'dumbbell', label: 'Mancuernas', matches: ['dumbbell'] },
  { id: 'machine', label: 'Máquina', matches: ['machine', 'smith'] },
  { id: 'cable', label: 'Polea', matches: ['cable'] },
  { id: 'bodyweight', label: 'Sin material', matches: ['bodyweight'] },
  { id: 'kettlebell', label: 'Kettlebell', matches: ['kettlebell'] },
  { id: 'other', label: 'Otros', matches: ['band', 'plate', 'medicine_ball', 'cardio_machine', 'other'] },
]

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

/** Orden de los grupos por músculo: el de MUSCLES y, al final, los escritos a mano y "Sin grupo". */
export function compareMuscleLabels(a: string, b: string): number {
  const rank = (label: string) => {
    if (label === 'Sin grupo') return 1000
    const index = MUSCLES.findIndex((m) => normalizeText(m.label) === normalizeText(label))
    return index === -1 ? 500 : index
  }
  return rank(a) - rank(b) || a.localeCompare(b, 'es')
}
