import { Link } from 'react-router-dom'
import { LEGAL, LEGAL_LINKS } from '../lib/legal'
import { BrandLogo } from './BrandLogo'

/** Pie de las páginas públicas: marca, enlaces legales y copyright. */
export function SiteFooter({ showAccountLinks = true }: { showAccountLinks?: boolean }) {
  return (
    <footer className="border-t border-evo-border/30">
      <div className="safe-bottom mx-auto max-w-6xl px-4 pt-8 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="flex items-center gap-2.5">
            <BrandLogo size="xs" decorative />
            <span className="font-display text-xl font-extrabold uppercase">
              Evo<span className="text-evo-accent">Fit</span>
            </span>
            <span className="text-sm text-evo-muted">Entrena · Mejora · Evoluciona</span>
          </p>
          {showAccountLinks ? (
            <nav aria-label="Cuenta" className="flex flex-wrap justify-center gap-x-5 text-sm font-bold text-evo-muted">
              <Link to="/login" className="flex min-h-11 items-center hover:text-evo-text">
                Iniciar sesión
              </Link>
              <Link to="/register" className="flex min-h-11 items-center hover:text-evo-text">
                Crear cuenta
              </Link>
              <Link to="/instalar" className="flex min-h-11 items-center hover:text-evo-text">
                Instalar en el móvil
              </Link>
            </nav>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col items-center gap-2 border-t border-evo-border/30 pt-4 text-center text-sm text-evo-muted sm:flex-row sm:justify-between sm:text-left">
          <p>
            © {new Date().getFullYear()} EvoFit · {LEGAL.owner}. Todos los derechos reservados.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-4">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="flex min-h-11 items-center font-semibold hover:text-evo-text">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
