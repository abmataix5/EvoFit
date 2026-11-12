type Props = {
  onRetry: () => void
  title?: string
  message?: string
}

/**
 * Una pantalla no ha podido cargar sus datos (sin cobertura en el gimnasio, servidor caído).
 * Se dice claro y se ofrece reintentar, en vez de enseñar un "aún no tienes nada" que no es verdad.
 */
export function LoadError({ onRetry, title = 'Sin conexión', message = 'No se ha podido cargar. Comprueba la cobertura y vuelve a intentarlo.' }: Props) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border-2 border-dashed border-evo-border p-6 text-center" role="alert">
      <p className="font-display text-2xl font-bold">{title}</p>
      <p className="mt-1 text-sm text-evo-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-12 rounded-2xl bg-evo-accent px-6 font-bold text-[#1a120c] transition active:scale-95"
      >
        Reintentar
      </button>
    </div>
  )
}
