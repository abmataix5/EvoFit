import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { BrandLogo } from '../../components/BrandLogo'
import { Icon, type IconName } from '../../components/icons/Icon'
import { firstName } from '../../lib/motivation'
import { useAuth } from '../auth/AuthContext'
import { closeGuide, markGuideSeen, shouldAutoShowGuide, useGuideRequested } from './guideState'

type Step = {
  icon: IconName | 'logo'
  title: string
  text: string
  /** Dónde está en la app, para encontrarlo después. */
  where?: string
  points?: string[]
}

const STEPS: Step[] = [
  {
    icon: 'logo',
    title: 'Bienvenido a EvoFit',
    text: 'Entrena, apunta lo que haces y mira cómo mejoras. Te enseñamos lo básico en menos de un minuto.',
  },
  {
    icon: 'dumbbell',
    title: 'Crea tu rutina',
    text: 'Elige qué días entrenas y los ejercicios de la biblioteca. Se colocan solos en tu agenda.',
    where: 'Pestaña Rutinas',
    points: ['Más de 200 ejercicios con fotos', 'Puedes cambiarla cuando quieras'],
  },
  {
    icon: 'check',
    title: 'Entrena y apunta',
    text: 'En Hoy aparece el entreno del día. Escribe kilos y repeticiones y marca cada serie.',
    where: 'Pestaña Hoy',
    points: ['El descanso se cuenta solo', 'Todo se guarda aunque pierdas cobertura', 'Te avisa cuando bates un récord'],
  },
  {
    icon: 'progress',
    title: 'Mira cómo mejoras',
    text: 'Tu fuerza en cada ejercicio, tus récords, tu peso y tus fotos, semana a semana.',
    where: 'Pestaña Progreso',
  },
  {
    icon: 'trophy',
    title: 'Entrena con amigos',
    text: 'Añade a tus amigos, dales fuerza en sus entrenos y competid en la liga de cada semana.',
    where: 'Lupa de arriba para buscarlos',
    points: ['Tú decides quién ve tus entrenos', 'La liga se reinicia cada lunes'],
  },
]

/** Decide cuándo se ve la guía: sola la primera vez, o al pedirla desde Configuración. */
export function WelcomeGuideGate() {
  const { user } = useAuth()
  const requested = useGuideRequested()
  const [auto, setAuto] = useState(() => (user ? shouldAutoShowGuide(user) : false))

  if (!user || (!requested && !auto)) return null

  return (
    <WelcomeGuide
      name={firstName(user.name)}
      onClose={() => {
        markGuideSeen(user.id)
        setAuto(false)
        closeGuide()
      }}
    />
  )
}

/**
 * Guía de uso en cinco pasos, a pantalla completa. Se puede saltar en cualquier momento
 * (botón, Escape) y se avanza con los botones, las flechas del teclado o deslizando.
 */
function WelcomeGuide({ name, onClose }: { name: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  const touchStart = useRef<number | null>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  const step = STEPS[index]!
  const last = index === STEPS.length - 1
  const go = (next: number) => setIndex(Math.min(STEPS.length - 1, Math.max(0, next)))

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current()
      else if (event.key === 'ArrowRight') setIndex((i) => Math.min(STEPS.length - 1, i + 1))
      else if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else if (event.key === 'Tab' && panel.current) {
        // El foco no sale de la guía mientras está abierta.
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
        const first = items[0]
        const lastItem = items[items.length - 1]
        if (!first || !lastItem) return
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          event.preventDefault()
          lastItem.focus()
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [])

  function onTouchStart(event: TouchEvent) {
    touchStart.current = event.touches[0]?.clientX ?? null
  }

  function onTouchEnd(event: TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    const end = event.changedTouches[0]?.clientX
    if (start == null || end == null || Math.abs(end - start) < 50) return
    go(index + (end < start ? 1 : -1))
  }

  function finish(to?: string) {
    onClose()
    if (to) navigate(to)
  }

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label="Guía de uso de EvoFit"
      tabIndex={-1}
      className="evo-backdrop fixed inset-0 z-[85] flex flex-col bg-evo-bg outline-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="safe-top">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <p className="text-sm font-bold text-evo-muted" aria-live="polite">
            Paso {index + 1} de {STEPS.length}
          </p>
          <button
            type="button"
            onClick={() => finish()}
            className="-mr-2 min-h-11 rounded-full px-4 text-sm font-bold text-evo-text transition hover:bg-evo-surface-2 active:scale-95"
          >
            Saltar guía
          </button>
        </div>
        <div className="flex gap-1.5 px-4" aria-hidden>
          {STEPS.map((item, i) => (
            <span key={item.title} className="h-1.5 flex-1 overflow-hidden rounded-full bg-evo-surface-2">
              <span
                className="block h-full rounded-full bg-evo-accent transition-transform duration-300 ease-(--ease-evo)"
                style={{ transform: `translateX(${i <= index ? 0 : -101}%)` }}
              />
            </span>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-6 text-center">
        {/* La clave reinicia la animación de entrada en cada paso. */}
        <div key={index} className="evo-enter mx-auto flex w-full max-w-md flex-col items-center">
          {step.icon === 'logo' ? (
            <BrandLogo size="lg" decorative />
          ) : (
            <span
              className="evo-shape relative flex h-28 w-28 items-center justify-center overflow-hidden bg-gradient-to-br from-[#ffb347] via-[#ff7a36] to-[#ee5a2c] text-[#1a120c] shadow-[0_18px_40px_rgba(255,122,54,0.25)]"
              aria-hidden
            >
              <span className="evo-stripes absolute inset-0" />
              <Icon name={step.icon} className="relative h-14 w-14" />
            </span>
          )}

          <h2 className="mt-6 font-display text-[2.6rem] font-extrabold uppercase leading-[0.95] [text-wrap:balance]">
            {index === 0 && name !== 'atleta' ? `Hola, ${name}` : step.title}
          </h2>
          {index === 0 && name !== 'atleta' ? <p className="mt-1 font-display text-2xl font-bold text-evo-accent">{step.title}</p> : null}
          <p className="mt-3 text-lg leading-snug text-evo-muted [text-wrap:pretty]">{step.text}</p>

          {step.points ? (
            <ul className="mt-5 w-full space-y-2 text-left">
              {step.points.map((point) => (
                <li key={point} className="flex items-center gap-3 rounded-2xl bg-evo-surface px-4 py-3 font-semibold">
                  <Icon name="check" className="h-5 w-5 shrink-0 text-evo-lime" />
                  {point}
                </li>
              ))}
            </ul>
          ) : null}

          {step.where ? (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-evo-surface-2 px-4 py-2 text-sm font-bold">
              <span className="h-2.5 w-3.5 -skew-x-[24deg] rounded-[2px] bg-evo-accent" aria-hidden />
              {step.where}
            </p>
          ) : null}
        </div>
      </div>

      <div className="safe-bottom border-t border-evo-border/40 px-4 pt-3">
        <div className="mx-auto max-w-md space-y-2">
          {last ? (
            <>
              <button
                type="button"
                onClick={() => finish('/routines/new')}
                className="flex min-h-14 w-full items-center justify-center gap-1.5 rounded-2xl bg-evo-accent text-lg font-extrabold text-[#1a120c] transition active:scale-[0.97]"
              >
                Crear mi primera rutina
                <Icon name="chevron" className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => finish()}
                className="min-h-12 w-full rounded-2xl text-base font-bold text-evo-text transition active:scale-[0.98]"
              >
                Ahora no, explorar la app
              </button>
            </>
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button
                type="button"
                onClick={() => go(index - 1)}
                disabled={index === 0}
                aria-label="Paso anterior"
                className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-evo-border bg-evo-surface-2 transition active:scale-95 disabled:opacity-30"
              >
                <Icon name="back" className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                className="flex min-h-14 items-center justify-center gap-1.5 rounded-2xl bg-evo-accent text-lg font-extrabold text-[#1a120c] transition active:scale-[0.97]"
              >
                {index === 0 ? 'Empezar' : 'Siguiente'}
                <Icon name="chevron" className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
