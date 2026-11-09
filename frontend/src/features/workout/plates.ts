/** Discos olímpicos habituales en un gimnasio (kg). */
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const

export const BARS = [
  { kg: 20, label: 'Barra 20 kg' },
  { kg: 15, label: 'Barra 15 kg' },
  { kg: 10, label: 'Barra corta 10 kg' },
  { kg: 0, label: 'Sin barra' },
] as const

export type PlateLoad = {
  /** Discos de un lado, de más pesado a más ligero. */
  perSide: number[]
  /** Peso total que se consigue de verdad con esos discos. */
  achieved: number
  exact: boolean
}

const EPS = 1e-6

export function roundTo(value: number, step = 2.5) {
  return Math.round(value / step) * step
}

/** Reparto voraz por lado (los discos estándar lo hacen óptimo). */
export function loadPlates(target: number, bar: number): PlateLoad {
  if (!Number.isFinite(target) || target <= bar) {
    return { perSide: [], achieved: bar, exact: Math.abs(target - bar) < EPS }
  }
  let remaining = (target - bar) / 2
  const perSide: number[] = []
  for (const plate of PLATES) {
    while (remaining + EPS >= plate) {
      perSide.push(plate)
      remaining -= plate
    }
  }
  const achieved = bar + perSide.reduce((sum, p) => sum + p, 0) * 2
  return { perSide, achieved, exact: remaining < EPS }
}

export type WarmupSet = { weight: number; reps: number; label: string }

/**
 * Aproximación clásica: barra vacía y subidas al 40, 60 y 80 % del peso de trabajo.
 * Sin barra (máquinas, mancuernas) se empieza al 50 %.
 */
export function warmupSets(working: number, bar: number): WarmupSet[] {
  if (!Number.isFinite(working) || working <= 0) return []
  const steps = bar > 0
    ? [
        { pct: 0, reps: 10 },
        { pct: 0.4, reps: 8 },
        { pct: 0.6, reps: 5 },
        { pct: 0.8, reps: 3 },
      ]
    : [
        { pct: 0.5, reps: 10 },
        { pct: 0.7, reps: 5 },
        { pct: 0.85, reps: 2 },
      ]

  const result: WarmupSet[] = []
  for (const step of steps) {
    const weight = step.pct === 0 ? bar : Math.max(bar, roundTo(working * step.pct))
    if (weight <= 0 || weight >= working - EPS) continue
    if (result.some((set) => Math.abs(set.weight - weight) < EPS)) continue
    result.push({
      weight,
      reps: step.reps,
      label: step.pct === 0 ? 'Barra vacía' : `${Math.round(step.pct * 100)} %`,
    })
  }
  return result
}

export function formatPlateKg(value: number) {
  return value.toLocaleString('es-ES', { maximumFractionDigits: 2 })
}
