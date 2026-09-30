type BrandLogoProps = {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
}

const sizes = {
  xs: 'h-8 w-8',
  sm: 'h-10 w-10',
  md: 'h-16 w-16',
  lg: 'h-28 w-28',
} as const

const px = { xs: 32, sm: 40, md: 64, lg: 112 } as const

export function BrandLogo({ size = 'md', showTagline = false, className = '' }: BrandLogoProps) {
  return (
    <div className={['inline-flex flex-col items-center text-center', className].join(' ')}>
      <img
        src="/logo.png"
        alt="EvoFit"
        className={[sizes[size], 'object-contain'].join(' ')}
        width={px[size]}
        height={px[size]}
        decoding="async"
      />
      {showTagline ? (
        <p className="mt-2 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-evo-muted">
          Entrena · Mejora · Evoluciona
        </p>
      ) : null}
    </div>
  )
}
