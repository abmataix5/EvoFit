import { useState } from 'react'
import { initials } from './profileOptions'

const sizes = {
  xs: 'h-7 w-7 text-[0.65rem]',
  sm: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-lg',
  lg: 'h-24 w-24 text-3xl',
  xl: 'h-28 w-28 text-4xl',
} as const

type Props = {
  name: string | null | undefined
  url: string | null | undefined
  size?: keyof typeof sizes
  className?: string
}

/** Foto de perfil con la silueta de EvoFit (esquinas asimétricas); si no hay foto (o no carga), las iniciales. */
export function Avatar({ name, url, size = 'md', className = '' }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(url) && failedUrl !== url

  return (
    <span
      className={[
        'evo-shape relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden',
        'bg-gradient-to-br from-evo-accent to-evo-accent-soft font-display font-bold text-[#1a120c]',
        sizes[size],
        className,
      ].join(' ')}
    >
      {showImage ? (
        <img
          src={url!}
          alt={name ? `Foto de ${name}` : 'Foto de perfil'}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(url ?? null)}
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  )
}
