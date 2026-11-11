import { useEffect, useState } from 'react'
import { Icon } from '../icons/Icon'

type Props = {
  urls: [string, string] | null | undefined
  name: string
  /** thumb: miniatura de lista. hero: grande, alterna inicio y final como una animación. */
  variant?: 'thumb' | 'hero'
  className?: string
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Foto del ejercicio (de la biblioteca) o un icono si no tiene. */
export function ExerciseImage({ urls, name, variant = 'thumb', className = '' }: Props) {
  const [failed, setFailed] = useState(false)

  if (!urls || failed) {
    return (
      <span
        aria-hidden
        className={[
          'flex shrink-0 items-center justify-center bg-evo-surface-2 text-evo-muted',
          variant === 'thumb' ? 'h-14 w-14 rounded-xl' : 'aspect-[3/2] w-full rounded-2xl',
          className,
        ].join(' ')}
      >
        <Icon name="catalog" className={variant === 'thumb' ? 'h-6 w-6' : 'h-12 w-12'} />
      </span>
    )
  }

  if (variant === 'thumb') {
    return (
      <img
        src={urls[0]}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={['h-14 w-14 shrink-0 rounded-xl bg-white object-cover', className].join(' ')}
      />
    )
  }

  return <HeroImage urls={urls} name={name} className={className} onError={() => setFailed(true)} />
}

function HeroImage({ urls, name, className, onError }: { urls: [string, string]; name: string; className: string; onError: () => void }) {
  const [frame, setFrame] = useState(0)
  const [still] = useState(prefersReducedMotion)

  // Alterna posición inicial y final: se entiende el movimiento sin vídeo.
  useEffect(() => {
    if (still) return
    const timer = window.setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 1100)
    return () => window.clearInterval(timer)
  }, [still])

  if (still) {
    return (
      <div className={['grid grid-cols-2 gap-2', className].join(' ')}>
        {urls.map((url, index) => (
          <figure key={url} className="overflow-hidden rounded-2xl bg-white">
            <img src={url} alt={`${name}: posición ${index === 0 ? 'inicial' : 'final'}`} onError={onError} className="aspect-[3/2] w-full object-cover" />
            <figcaption className="bg-evo-surface-2 py-1 text-center text-xs font-semibold text-evo-muted">
              {index === 0 ? 'Inicio' : 'Final'}
            </figcaption>
          </figure>
        ))}
      </div>
    )
  }

  return (
    <div className={['relative aspect-[3/2] w-full overflow-hidden rounded-2xl bg-white', className].join(' ')}>
      {urls.map((url, index) => (
        <img
          key={url}
          src={url}
          alt={index === 0 ? `${name}: posición inicial y final` : ''}
          aria-hidden={index === 1}
          onError={onError}
          className={[
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            frame === index ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
      ))}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white" aria-hidden>
        {frame === 0 ? 'Inicio' : 'Final'}
      </span>
    </div>
  )
}
