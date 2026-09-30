import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'lime'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  fullWidth?: boolean
  size?: 'md' | 'lg'
}

const variants: Record<Variant, string> = {
  primary:
    'bg-evo-accent text-[#1a120c] shadow-[0_8px_24px_rgba(255,138,76,0.28)] hover:bg-evo-accent-soft',
  secondary:
    'bg-evo-surface-2 text-evo-text border-2 border-evo-border hover:border-evo-accent hover:bg-evo-surface',
  ghost: 'bg-transparent text-evo-text hover:bg-evo-surface-2',
  danger:
    'bg-evo-danger/15 text-evo-danger border-2 border-evo-danger/40 hover:bg-evo-danger hover:text-white',
  lime: 'bg-evo-lime text-[#102000] hover:brightness-110',
}

export function Button({
  variant = 'primary',
  fullWidth,
  size = 'md',
  className = '',
  disabled,
  ...props
}: Props) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-evo-accent/40',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
        'touch-manipulation',
        size === 'lg' ? 'min-h-14 px-5 text-base' : 'min-h-12 px-4 text-sm',
        variants[variant],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      disabled={disabled}
      {...props}
    />
  )
}
