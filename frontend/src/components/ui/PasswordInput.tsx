import { useId, useState, type InputHTMLAttributes } from 'react'
import { Icon } from '../icons/Icon'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  error?: string
  hint?: string
}

/** Campo de contraseña con botón para verla: evita tener que escribirla dos veces. */
export function PasswordInput({ label, error, hint, id, className = '', ...props }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const [visible, setVisible] = useState(false)

  return (
    <div className="block min-w-0 max-w-full space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-semibold text-evo-text">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className={[
            'box-border w-full min-w-0 rounded-2xl border-2 border-evo-border bg-evo-surface-2 py-3.5 pl-4 pr-14 text-base text-evo-text',
            'placeholder:text-evo-muted/80 focus:border-evo-accent focus:outline-none focus:ring-4 focus:ring-evo-accent/25',
            error ? 'border-evo-danger' : '',
            className,
          ].join(' ')}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-13 items-center justify-center rounded-2xl text-evo-muted transition hover:text-evo-text active:scale-90"
        >
          <span className="relative flex">
            <Icon name="eye" className="h-5 w-5" />
            {/* Tachado cuando la contraseña está oculta. */}
            {!visible ? <span aria-hidden className="absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded bg-current" /> : null}
          </span>
        </button>
      </div>
      {hint && !error ? (
        <p id={hintId} className="text-xs text-evo-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-semibold text-evo-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
