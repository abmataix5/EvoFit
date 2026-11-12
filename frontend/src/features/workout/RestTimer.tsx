import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../../lib/tracking'

export type RestTimerState = { endsAt: number; total: number; label: string } | null

let audio: AudioContext | null = null

/**
 * Prepara el sonido dentro de un toque del usuario (al marcar la serie). El iPhone solo deja sonar
 * si el audio se activó con un gesto: sin esto el aviso de fin de descanso era mudo.
 */
export function primeRestSound() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    if (!audio || audio.state === 'closed') audio = new AudioCtx()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    /* sin sonido */
  }
}

function beep() {
  try {
    primeRestSound()
    const ctx = audio
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.65)
  } catch {
    /* sin sonido */
  }
}

/** Barra fija de descanso: cuenta atrás, ±15 s, saltar. Vibra y pita al terminar. */
export function RestTimer({
  timer,
  onChange,
}: {
  timer: RestTimerState
  onChange: (next: RestTimerState) => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const firedFor = useRef<number | null>(null)

  useEffect(() => {
    if (!timer) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [timer])

  const remainingMs = timer ? timer.endsAt - now : 0
  const finished = timer != null && remainingMs <= 0

  useEffect(() => {
    if (!timer || !finished || firedFor.current === timer.endsAt) return
    firedFor.current = timer.endsAt
    try {
      navigator.vibrate?.([250, 120, 250, 120, 400])
    } catch {
      /* iOS no vibra */
    }
    beep()
    const id = window.setTimeout(() => onChange(null), 6000)
    return () => window.clearTimeout(id)
  }, [finished, timer, onChange])

  if (!timer) return null

  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const progress = timer.total > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / (timer.total * 1000))) : 1

  return (
    <div
      role="timer"
      aria-live="off"
      className={[
        'evo-enter mb-3 overflow-hidden rounded-2xl border-2 shadow-lg',
        finished ? 'border-evo-lime bg-evo-lime text-[#102000]' : 'border-evo-border bg-evo-surface text-evo-text',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className={['text-xs font-bold uppercase tracking-wide', finished ? '' : 'text-evo-muted'].join(' ')}>
            {finished ? '¡A por la siguiente!' : `Descanso · ${timer.label}`}
          </p>
          <p className="font-display text-3xl font-bold tabular-nums leading-tight" aria-live="polite">
            {finished ? '0:00' : formatDuration(seconds)}
          </p>
        </div>
        {!finished ? (
          <>
            <button
              type="button"
              className="h-12 min-w-12 rounded-xl bg-evo-surface-2 px-3 text-sm font-bold"
              onClick={() =>
                // Si quedan menos de 15 s, quitar 15 es terminar el descanso (antes lo alargaba).
                timer.endsAt - Date.now() <= 15_000 ? onChange(null) : onChange({ ...timer, endsAt: timer.endsAt - 15_000, total: Math.max(5, timer.total - 15) })
              }
              aria-label="Quitar 15 segundos"
            >
              −15
            </button>
            <button
              type="button"
              className="h-12 min-w-12 rounded-xl bg-evo-surface-2 px-3 text-sm font-bold"
              onClick={() => onChange({ ...timer, endsAt: timer.endsAt + 15_000, total: timer.total + 15 })}
              aria-label="Añadir 15 segundos"
            >
              +15
            </button>
          </>
        ) : null}
        <button
          type="button"
          className={[
            'h-12 rounded-xl px-4 text-sm font-bold',
            finished ? 'bg-black/15' : 'bg-evo-accent text-[#1a120c]',
          ].join(' ')}
          onClick={() => onChange(null)}
        >
          {finished ? 'Cerrar' : 'Saltar'}
        </button>
      </div>
      {!finished ? (
        <div className="h-1.5 bg-evo-surface-2">
          <div className="h-full bg-evo-accent transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      ) : null}
    </div>
  )
}
