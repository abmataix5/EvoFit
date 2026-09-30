import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, id, className = '', ...props }: Props) {
  const inputId = id ?? props.name
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <label className="block space-y-1.5" htmlFor={inputId}>
      <span className="text-sm font-semibold text-evo-text">{label}</span>
      <input
        id={inputId}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        className={[
          'w-full rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-4 py-3.5 text-base text-evo-text',
          'placeholder:text-evo-muted/80',
          'focus:border-evo-accent focus:outline-none focus:ring-4 focus:ring-evo-accent/25',
          error ? 'border-evo-danger' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {hint && !error ? (
        <span id={hintId} className="block text-xs text-evo-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="block text-xs font-semibold text-evo-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  )
}
