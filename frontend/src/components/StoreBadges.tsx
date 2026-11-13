const STORES = [
  {
    name: 'App Store',
    // Móvil con muesca.
    icon: (
      <>
        <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" />
        <path d="M10.5 5.5h3" />
      </>
    ),
  },
  {
    name: 'Google Play',
    // Triángulo de «reproducir».
    icon: <path d="M7 4.5v15a.8.8 0 0 0 1.2.7l12-7.5a.8.8 0 0 0 0-1.4l-12-7.5A.8.8 0 0 0 7 4.5Z" />,
  },
] as const

/** Aviso de que la app llegará a las tiendas. No son enlaces: todavía no está publicada. */
export function StoreBadges({ className = '' }: { className?: string }) {
  return (
    <ul className={['flex flex-wrap gap-2', className].join(' ')} aria-label="Próximamente en las tiendas de apps">
      {STORES.map((store) => (
        <li
          key={store.name}
          className="flex items-center gap-2.5 rounded-[1rem_0.4rem] border border-evo-border/60 bg-evo-surface-2 py-2 pl-3 pr-4"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-evo-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {store.icon}
          </svg>
          <span className="leading-tight">
            <span className="block text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-evo-muted">Próximamente en</span>
            <span className="block text-sm font-extrabold text-evo-text">{store.name}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
