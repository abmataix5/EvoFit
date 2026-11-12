import { Link } from 'react-router-dom'
import { LEGAL, LEGAL_LINKS } from '../lib/legal'
import { BrandLogo } from './BrandLogo'

const ACCOUNT_LINKS = [
  { to: '/login', label: 'Iniciar sesión' },
  { to: '/register', label: 'Crear cuenta' },
  { to: '/instalar', label: 'Instalar en el móvil' },
] as const

function Column({ title, links }: { title: string; links: ReadonlyArray<{ to: string; label: string }> }) {
  return (
    <nav aria-label={title}>
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-evo-text">{title}</p>
      <ul className="mt-2">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="inline-flex min-h-10 items-center text-sm font-semibold text-evo-muted transition hover:text-evo-accent">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Pie de las páginas públicas: marca y copyright a un lado, enlaces en columnas al otro. */
export function SiteFooter({ showAccountLinks = true }: { showAccountLinks?: boolean }) {
  return (
    <footer className="bg-evo-surface/50">
      <div className="safe-bottom mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-4 pt-10 sm:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="col-span-2 sm:col-span-1">
          <Link to="/" className="flex w-fit items-center gap-2.5" aria-label="EvoFit, ir a la portada">
            <BrandLogo size="sm" decorative />
            <span className="font-display text-2xl font-extrabold uppercase">
              Evo<span className="text-evo-accent">Fit</span>
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-snug text-evo-muted">
            La app para apuntar tus entrenos, ver tu progreso y picarte con tus amigos.
          </p>
          <p className="mt-4 text-sm text-evo-muted">
            © {new Date().getFullYear()} EvoFit · {LEGAL.owner}
          </p>
        </div>

        {showAccountLinks ? <Column title="Cuenta" links={ACCOUNT_LINKS} /> : <span className="hidden sm:block" aria-hidden />}
        <Column title="Legal" links={LEGAL_LINKS} />
      </div>
    </footer>
  )
}
