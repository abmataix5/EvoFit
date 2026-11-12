type BrandLogoProps = {
  size?: 'xs' | 'sm' | 'nav' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
  /** Solo adorno (el nombre ya se lee al lado): se oculta a lectores de pantalla. */
  decorative?: boolean
}

const sizes = {
  xs: 'h-8 w-8',
  sm: 'h-10 w-10',
  nav: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-28 w-28',
} as const

const px = { xs: 32, sm: 40, nav: 48, md: 64, lg: 112 } as const

export function BrandLogo({ size = 'md', showTagline = false, className = '', decorative = false }: BrandLogoProps) {
  return (
    <div className={['inline-flex flex-col items-center text-center', className].join(' ')}>
      <img
        src="/logo.png"
        alt={decorative ? '' : 'EvoFit'}
        className={[sizes[size], 'rounded-[22%] object-contain'].join(' ')}
        width={px[size]}
        height={px[size]}
        decoding="async"
      />
      {showTagline ? (
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-evo-muted">
          Entrena · Mejora · Evoluciona
        </p>
      ) : null}
    </div>
  )
}
