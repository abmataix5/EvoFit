import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/BrandLogo'
import { Icon } from '../../components/icons/Icon'

type Props = {
  title: string
  subtitle: string
  children: ReactNode
  /** Texto bajo el formulario (p. ej. "¿Ya tienes cuenta? Iniciar sesión"). */
  footer: ReactNode
  /** Lo que se cuenta en el panel de marca (solo en pantallas anchas). */
  highlights: string[]
  panelTitle: ReactNode
}

/**
 * Marco común de entrar y crear cuenta: en el móvil, cabecera con la marca y el formulario;
 * en pantallas anchas, un panel de marca a la izquierda y el formulario a la derecha.
 */
export function AuthLayout({ title, subtitle, children, footer, highlights, panelTitle }: Props) {
  return (
    <div className="no-x-scroll min-h-svh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#ffb347] via-[#ff7a36] to-[#ee5a2c] p-12 text-[#1a120c] lg:flex lg:flex-col lg:justify-between">
        <span className="evo-stripes pointer-events-none absolute inset-0" aria-hidden />
        <Link to="/" className="relative flex w-fit items-center gap-3" aria-label="EvoFit, volver a la portada">
          <BrandLogo size="sm" decorative />
          <span className="font-display text-3xl font-extrabold uppercase">EvoFit</span>
        </Link>
        <div className="relative">
          <p className="font-display text-[clamp(3rem,5vw,4.6rem)] font-extrabold uppercase leading-[0.9]">{panelTitle}</p>
          <ul className="mt-8 space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3 text-lg font-bold">
                <span className="evo-shape flex h-8 w-8 shrink-0 items-center justify-center bg-[#1a120c] text-evo-lime">
                  <Icon name="check" className="h-5 w-5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm font-bold uppercase tracking-[0.18em] opacity-75">Entrena · Mejora · Evoluciona</p>
      </aside>

      <div className="flex min-h-svh flex-col">
        <header className="safe-top">
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-8">
            <Link to="/" className="flex items-center gap-2.5 lg:invisible" aria-label="EvoFit, volver a la portada">
              <BrandLogo size="sm" decorative />
              <span className="font-display text-2xl font-extrabold uppercase">
                Evo<span className="text-evo-accent">Fit</span>
              </span>
            </Link>
            <Link
              to="/"
              className="-mr-2 flex min-h-11 items-center gap-1 rounded-2xl px-3 text-sm font-bold text-evo-muted transition hover:bg-evo-surface-2 hover:text-evo-text active:scale-95"
            >
              <Icon name="back" className="h-4 w-4" />
              Volver
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 pb-10 pt-4">
          <div className="evo-enter w-full max-w-md">
            <h1 className="font-display text-[2.8rem] font-extrabold uppercase leading-[0.95]">{title}</h1>
            <p className="mt-2 text-lg text-evo-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
            <p className="mt-6 text-center text-base text-evo-muted">{footer}</p>
          </div>
        </main>
      </div>
    </div>
  )
}

/** Aviso de error general del formulario (sin conexión, credenciales incorrectas…). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="flex items-start gap-2.5 rounded-2xl border-2 border-evo-danger/50 bg-evo-danger/10 px-4 py-3 text-base font-semibold text-evo-danger" role="alert">
      <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-evo-danger text-sm font-extrabold text-evo-bg">
        !
      </span>
      {message}
    </p>
  )
}

/** Botón de enviar con indicador mientras se espera al servidor. */
export function SubmitButton({ busy, children, busyLabel }: { busy: boolean; children: ReactNode; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-evo-accent text-lg font-extrabold text-[#1a120c] shadow-[0_10px_28px_rgba(255,122,54,0.3)] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-evo-accent/40 disabled:opacity-70"
    >
      {busy ? (
        <>
          <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-current border-t-transparent" aria-hidden />
          {busyLabel}
        </>
      ) : (
        <>
          {children}
          <Icon name="chevron" className="h-5 w-5" />
        </>
      )}
    </button>
  )
}
