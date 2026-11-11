import type { ExperienceLevel, ProfileVisibility, TrainingGoal, User } from '../../lib/api'

export const EXPERIENCE_LEVELS: Array<{ id: ExperienceLevel; label: string }> = [
  { id: 'beginner', label: 'Principiante' },
  { id: 'intermediate', label: 'Intermedio' },
  { id: 'advanced', label: 'Avanzado' },
]

export const TRAINING_GOALS: Array<{ id: TrainingGoal; label: string; emoji: string }> = [
  { id: 'strength', label: 'Fuerza', emoji: '🏋️' },
  { id: 'muscle', label: 'Ganar músculo', emoji: '💪' },
  { id: 'fat_loss', label: 'Perder grasa', emoji: '🔥' },
  { id: 'endurance', label: 'Resistencia', emoji: '🏃' },
  { id: 'health', label: 'Salud y bienestar', emoji: '🌿' },
]

export const VISIBILITY_OPTIONS: Array<{ id: ProfileVisibility; label: string; hint: string }> = [
  { id: 'public', label: 'Público', hint: 'Cualquiera en EvoFit ve tu perfil y tus entrenos.' },
  { id: 'friends', label: 'Solo amigos', hint: 'Solo las personas que añadas ven tus entrenos.' },
  { id: 'private', label: 'Privado', hint: 'Nadie ve tus entrenos; solo tu nombre y tu foto.' },
]

export function levelLabel(id: ExperienceLevel | null): string | null {
  return EXPERIENCE_LEVELS.find((o) => o.id === id)?.label ?? null
}

export function goalOption(id: TrainingGoal | null) {
  return TRAINING_GOALS.find((o) => o.id === id) ?? null
}

export function visibilityOption(id: ProfileVisibility) {
  return VISIBILITY_OPTIONS.find((o) => o.id === id) ?? VISIBILITY_OPTIONS[1]!
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

/** Cuántos de los datos opcionales del perfil están rellenos (para animar a completarlo). */
export function profileCompletion(user: User): { done: number; total: number } {
  const checks = [
    Boolean(user.avatar_url),
    Boolean(user.username),
    Boolean(user.bio),
    Boolean(user.location),
    Boolean(user.birth_date),
    Boolean(user.experience_level),
    Boolean(user.training_goal),
  ]
  return { done: checks.filter(Boolean).length, total: checks.length }
}
