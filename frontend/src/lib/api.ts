import axios from 'axios'

// Same-origin: el proxy de Vite reenvía a Laravel y evita fallos CSRF entre puertos.
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
})

export async function ensureCsrfCookie(): Promise<void> {
  await axios.get('/sanctum/csrf-cookie', {
    withCredentials: true,
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
}

export type User = {
  id: number
  name: string
  email: string
  role: string
  tenant?: {
    id: number
    name: string
    slug: string
    plan: string
  }
}

export type RoutineExercise = {
  id: number
  routine_day_id?: number
  catalog_exercise_id?: number | null
  name: string
  sort_order: number
  default_sets: number
  default_reps: number
  rest_seconds?: number | null
  target_muscle?: string | null
  notes?: string | null
}

export type CatalogExercise = {
  id: number
  name: string
  target_muscle?: string | null
  default_sets: number
  default_reps: number
  rest_seconds: number
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type RoutineDay = {
  id: number
  day_index: number
  weekday?: number | null
  name: string
  focus?: string | null
  notes?: string | null
  exercises?: RoutineExercise[]
}

export type Routine = {
  id: number
  name: string
  description?: string | null
  sessions_per_week: number
  is_active: boolean
  starts_on?: string | null
  ends_on?: string | null
  days?: RoutineDay[]
  days_count?: number
  exercises_count?: number
}

export type ExerciseSetLog = {
  id: number
  routine_exercise_id: number
  set_number: number
  weight_kg: string | number | null
  reps: number | null
  completed: boolean
  exercise?: RoutineExercise
}

export type WorkoutSession = {
  id: number
  routine_id: number
  routine_day_id?: number | null
  scheduled_date: string
  started_at?: string | null
  completed_at?: string | null
  notes?: string | null
  is_planned?: boolean
  was_swapped?: boolean
  routine?: Routine
  day?: RoutineDay
  set_logs?: ExerciseSetLog[]
}

export type ProgressInsight = {
  summary: {
    mood: 'green' | 'orange' | 'red'
    label: string
    improved: number
    maintained: number
    declined: number
    new: number
    current_week: { from: string; to: string }
    previous_week: { from: string; to: string }
  }
  training: {
    sessions_completed: number
    sessions_planned: number
    adherence_pct: number
    volume_this_week: number
    volume_prev_week: number
    volume_delta_pct: number | null
  }
  coach: {
    tip: string
    focus: string
    wins: ProgressExerciseRow[]
    watch: ProgressExerciseRow[]
  }
  body: {
    latest_kg: number | null
    previous_kg: number | null
    delta_kg: number | null
    trend: 'up' | 'down' | 'stable' | 'none'
    recorded_on: string | null
  }
  exercises: ProgressExerciseRow[]
  chart: Array<{
    name: string
    semana_anterior: number
    esta_semana: number
  }>
}

export type ProgressExerciseRow = {
  catalog_exercise_id?: number | null
  name: string
  status: 'improved' | 'maintained' | 'declined' | 'new'
  current_best_kg: number | null
  previous_best_kg: number | null
  current_volume: number | null
  previous_volume: number | null
  delta_kg: number | null
  delta_pct: number | null
  coach_note?: string
}

export const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** Defaults ISO weekday (1=Lun … 7=Dom) según nº de días */
export function defaultWeekdays(count: number): number[] {
  const map: Record<number, number[]> = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [1, 2, 3, 4, 5, 6, 7],
  }
  return map[count] ?? map[3]
}

export type BodyWeightEntry = {
  id: number
  recorded_on: string
  weight_kg: string | number
  notes?: string | null
}

export type ProgressPhoto = {
  id: number
  recorded_on: string
  caption?: string | null
  url: string
}

/** Plantillas de entrenador según días/semana */
export type DayTemplate = {
  name: string
  focus: string
}

export const TRAINING_TEMPLATES: Record<number, { label: string; tip: string; days: DayTemplate[] }> = {
  1: {
    label: 'Full body 1x',
    tip: 'Ideal para empezar o mantener. Prioriza básicos compuestos.',
    days: [{ name: 'Full body', focus: 'full' }],
  },
  2: {
    label: 'Full body 2x',
    tip: 'Buen equilibrio vida/gym. Repite el mismo estímulo con 48–72h de descanso.',
    days: [
      { name: 'Full body A', focus: 'full' },
      { name: 'Full body B', focus: 'full' },
    ],
  },
  3: {
    label: 'Full body / PPL light',
    tip: 'Clásico principiante-intermedio. 3 estímulos semanales bien recuperados.',
    days: [
      { name: 'Full body A', focus: 'full' },
      { name: 'Full body B', focus: 'full' },
      { name: 'Full body C', focus: 'full' },
    ],
  },
  4: {
    label: 'Upper / Lower',
    tip: 'Excelente para hipertrofia: cada grupo 2x/semana con volumen manejable.',
    days: [
      { name: 'Upper A', focus: 'upper' },
      { name: 'Lower A', focus: 'lower' },
      { name: 'Upper B', focus: 'upper' },
      { name: 'Lower B', focus: 'lower' },
    ],
  },
  5: {
    label: 'PPL + Upper/Lower',
    tip: 'Alto volumen. Vigila el sueño y la proteína; no fuerces fallos todos los sets.',
    days: [
      { name: 'Push', focus: 'push' },
      { name: 'Pull', focus: 'pull' },
      { name: 'Legs', focus: 'legs' },
      { name: 'Upper', focus: 'upper' },
      { name: 'Lower', focus: 'lower' },
    ],
  },
  6: {
    label: 'Push / Pull / Legs ×2',
    tip: 'Estándar avanzado. Cada grupo 2x/semana. Descansa al menos 1 día completo.',
    days: [
      { name: 'Push A', focus: 'push' },
      { name: 'Pull A', focus: 'pull' },
      { name: 'Legs A', focus: 'legs' },
      { name: 'Push B', focus: 'push' },
      { name: 'Pull B', focus: 'pull' },
      { name: 'Legs B', focus: 'legs' },
    ],
  },
  7: {
    label: 'Especialización diaria',
    tip: 'Solo si recuperas bien. Alterna intensidad alta/media y protege articulaciones.',
    days: [
      { name: 'Push', focus: 'push' },
      { name: 'Pull', focus: 'pull' },
      { name: 'Legs', focus: 'legs' },
      { name: 'Upper', focus: 'upper' },
      { name: 'Lower', focus: 'lower' },
      { name: 'Arms / Core', focus: 'arms' },
      { name: 'Activo / movilidad', focus: 'mobility' },
    ],
  },
}

export const FOCUS_LABELS: Record<string, string> = {
  full: 'Cuerpo completo',
  upper: 'Tren superior',
  lower: 'Tren inferior',
  push: 'Empuje',
  pull: 'Tirón',
  legs: 'Piernas',
  arms: 'Brazos',
  core: 'Core',
  mobility: 'Movilidad',
}
