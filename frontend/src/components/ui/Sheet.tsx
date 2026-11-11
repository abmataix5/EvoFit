import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons/Icon'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  /** Barra fija abajo (botones de guardar…). */
  footer?: ReactNode
  /** Acción a la izquierda del título (p. ej. volver a la lista). */
  onBack?: () => void
}

/**
 * Hoja que sube desde abajo en el móvil (diálogo centrado en escritorio).
 * Foco dentro, Escape cierra, el fondo no hace scroll y el foco vuelve al cerrar.
 */
export function Sheet({ title, onClose, children, footer, onBack }: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Si el contenido trae su propio autofocus (un buscador), se respeta.
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="evo-sheet flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-evo-border/60 bg-evo-surface shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-evo-border" />
        </div>
        <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-1 px-2 pb-2 pt-1 sm:pt-3">
          {onBack ? (
            <button type="button" onClick={onBack} aria-label="Volver" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-evo-surface-2">
              <Icon name="back" className="h-5 w-5" />
            </button>
          ) : (
            <span aria-hidden />
          )}
          <h2 id={titleId} className="truncate text-center text-base font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-evo-surface-2">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer ? <div className="safe-bottom border-t border-evo-border/50 bg-evo-surface px-4 pt-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
