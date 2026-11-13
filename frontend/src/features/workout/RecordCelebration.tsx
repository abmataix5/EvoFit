import { useEffect } from 'react'
import { haptic } from '../../lib/haptics'

export type RecordEvent = { id: number; exercise: string; label: string; previous: string | null }

const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2
  const distance = 70 + (i % 3) * 18
  return {
    dx: `${Math.round(Math.cos(angle) * distance)}px`,
    dy: `${Math.round(Math.sin(angle) * distance)}px`,
    color: ['#ffd166', '#ff8a4c', '#b6f36a'][i % 3],
  }
})

/** Aviso grande y breve cuando una serie bate el récord de siempre. */
export function RecordCelebration({ event, onDone }: { event: RecordEvent; onDone: () => void }) {
  useEffect(() => {
    haptic([70, 50, 70, 50, 200], { always: true })
    const timer = window.setTimeout(onDone, 3600)
    return () => window.clearTimeout(timer)
  }, [event.id, onDone])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[75] flex justify-center px-4">
      <div
        key={event.id}
        role="status"
        aria-live="assertive"
        className="evo-record-toast pointer-events-auto relative w-full max-w-sm rounded-3xl border-2 border-evo-warn/70 bg-evo-surface px-5 py-4 text-center shadow-[0_18px_48px_rgba(0,0,0,0.45)]"
        onClick={onDone}
      >
        <div className="pointer-events-none absolute left-1/2 top-8" aria-hidden>
          {SPARKS.map((spark, i) => (
            <span
              key={i}
              className="evo-burst absolute h-2 w-2 rounded-full"
              style={{ background: spark.color, ['--dx' as string]: spark.dx, ['--dy' as string]: spark.dy, animationDelay: `${(i % 4) * 40}ms` }}
            />
          ))}
        </div>
        <p className="evo-pop text-4xl" aria-hidden>
          🏆
        </p>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-evo-warn">Nuevo récord personal</p>
        <p className="mt-0.5 truncate font-display text-xl font-bold">{event.exercise}</p>
        <p className="font-display text-2xl font-bold tabular-nums">{event.label}</p>
        {event.previous ? <p className="mt-0.5 text-sm text-evo-muted">Antes: {event.previous}</p> : null}
      </div>
    </div>
  )
}
