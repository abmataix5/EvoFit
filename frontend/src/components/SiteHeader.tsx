import { Link, NavLink } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'

const navLink = 'flex min-h-11 items-center whitespace-nowrap rounded-2xl px-2.5 text-sm font-bold transition hover:bg-evo-surface-2 active:scale-95 sm:px-4 sm:text-base'

/** Cabecera de las páginas públicas: marca, precios y accesos a la cuenta. */
export function SiteHeader() {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-evo-border/30 bg-evo-bg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5" aria-label="EvoFit, inicio">
          <BrandLogo size="sm" decorative />
          {/* En móviles muy estrechos se queda solo el logo para que quepan los enlaces. */}
          <span className="font-display text-2xl font-extrabold uppercase max-[430px]:hidden">
            Evo<span className="text-evo-accent">Fit</span>
          </span>
        </Link>
        <nav aria-label="Principal" className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <NavLink to="/precios" className={({ isActive }) => `${navLink} ${isActive ? 'text-evo-accent' : ''}`}>
            Precios
          </NavLink>
          <Link to="/login" aria-label="Iniciar sesión" className={navLink}>
            <span className="sm:hidden">Entrar</span>
            <span className="hidden sm:inline">Iniciar sesión</span>
          </Link>
          <Link
            to="/register"
            className="flex min-h-11 items-center whitespace-nowrap rounded-2xl bg-evo-accent px-3.5 text-sm font-extrabold text-[#1a120c] transition active:scale-95 sm:px-4 sm:text-base"
          >
            Crear cuenta
          </Link>
        </nav>
      </div>
    </header>
  )
}
