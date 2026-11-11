import { useMemo } from 'react'
import type { PostSummary } from '../../lib/feed'

const COLORS = ['#ffffff', '#ffd166', '#b6f36a', '#1a120c', '#ffb088', '#7dd3fc']

/** Generador pseudoaleatorio con semilla: el confeti de cada publicación es siempre el mismo. */
function seeded(seed: number) {
  let s = seed % 2147483647 || 1
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function formatVolume(kg: number) {
  return kg >= 10000 ? `${(kg / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} t` : `${kg.toLocaleString('es-ES')} kg`
}

/**
 * Portada para entrenos compartidos sin foto: fondo de marca con confeti, "¡Nuevo entreno!"
 * y las cifras en grande. Si hay récord, la portada lo celebra.
 */
export function WorkoutCover({ summary, seed }: { summary: PostSummary; seed: number }) {
  const pieces = useMemo(() => {
    const rand = seeded(seed * 9973 + 17)
    // El confeti va por los bordes: el centro queda libre para que el texto se lea bien.
    const spot = () => {
      for (;;) {
        const x = rand() * 100
        const y = rand() * 100
        if (x < 12 || x > 88 || y < 16 || y > 84) return { x, y }
      }
    }
    return Array.from({ length: 34 }, (_, i) => ({
      id: i,
      ...spot(),
      size: 6 + rand() * 9,
      rotate: rand() * 360,
      color: COLORS[Math.floor(rand() * COLORS.length)]!,
      shape: rand() > 0.55 ? 'circle' : 'rect',
      delay: rand() * 1.2,
    }))
  }, [seed])

  const hasRecord = summary.records.length > 0
  const stats = [
    summary.duration_minutes ? { label: 'minutos', value: String(summary.duration_minutes) } : null,
    { label: summary.sets === 1 ? 'serie' : 'series', value: String(summary.sets) },
    summary.volume_kg > 0 ? { label: 'levantados', value: formatVolume(summary.volume_kg) } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>

  return (
    <div
      className={[
        'relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden px-6 text-center',
        hasRecord
          ? 'bg-gradient-to-br from-[#ffb347] via-[#ff8a4c] to-[#e8553d]'
          : 'bg-gradient-to-br from-[#ff9d68] via-[#ff8a4c] to-[#f0623c]',
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {pieces.map((p) => (
          <span
            key={p.id}
            className="absolute"
            style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `rotate(${p.rotate}deg)` }}
          >
            <span
              className="evo-confetti block"
              style={{
                animationDelay: `${p.delay}s`,
                width: p.size,
                height: p.shape === 'circle' ? p.size : p.size / 2.2,
                borderRadius: p.shape === 'circle' ? 999 : 2,
                background: p.color,
                opacity: 0.88,
              }}
            />
          </span>
        ))}
      </div>
      <div className="relative">
        <p className="text-5xl drop-shadow-sm" aria-hidden>
          {hasRecord ? '🏆' : '🎉'}
        </p>
        <p className="mt-2 text-sm font-extrabold uppercase tracking-[0.2em] text-[#1a120c]/70">
          {hasRecord ? '¡Nuevo récord!' : '¡Nuevo entreno!'}
        </p>
        <p className="mt-1 font-display text-4xl font-bold leading-tight text-[#1a120c] [text-wrap:balance]">{summary.title}</p>
        {hasRecord ? (
          <p className="mt-1 text-base font-bold text-[#1a120c]/80">
            {summary.records.length === 1 ? summary.records[0] : `${summary.records.length} récords personales`}
          </p>
        ) : null}
        <dl className="mt-5 flex justify-center gap-6">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dd className="font-display text-3xl font-bold tabular-nums text-[#1a120c]">{stat.value}</dd>
              <dt className="text-xs font-bold uppercase tracking-wide text-[#1a120c]/65">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
