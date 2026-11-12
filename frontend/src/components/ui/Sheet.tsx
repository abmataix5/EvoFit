import { useCallback, useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
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

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const EXIT_MS = 200

/** Varias hojas pueden abrirse una sobre otra: el fondo solo vuelve a moverse al cerrar la última. */
let openSheets = 0
let savedOverflow = ''

/**
 * Hoja que sube desde abajo en el móvil (diálogo centrado en escritorio).
 * Se cierra con la X, tocando fuera, con Escape o arrastrándola hacia abajo desde la cabecera.
 * El foco se queda dentro, el fondo no hace scroll y al cerrar el foco vuelve a donde estaba.
 */
export function Sheet({ title, onClose, children, footer, onBack }: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  const drag = useRef<{ startY: number; startTime: number; offset: number } | null>(null)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  /** Cierra con la animación de salida; el padre desmonta la hoja cuando termina. */
  const dismiss = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    window.setTimeout(() => {
      // Si el padre ya la quitó (p. ej. abrió otra hoja), no se le vuelve a avisar.
      if (mountedRef.current) closeRef.current()
    }, EXIT_MS)
  }, [])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    if (openSheets === 0) {
      savedOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openSheets += 1
    // Si el contenido trae su propio autofocus (un buscador), se respeta.
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus()

    function onKey(event: KeyboardEvent) {
      const panel = panelRef.current
      if (!panel) return
      // Solo responde la hoja de arriba (puede haber un diálogo o un visor encima).
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]')
      if (dialogs[dialogs.length - 1] !== panel) return

      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
        return
      }
      if (event.key !== 'Tab') return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        event.preventDefault()
        return
      }
      const current = document.activeElement
      if (event.shiftKey && (current === first || current === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      } else if (!panel.contains(current)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      openSheets -= 1
      if (openSheets === 0) document.body.style.overflow = savedOverflow
      previousFocus?.focus?.()
    }
  }, [dismiss])

  // Arrastrar la cabecera hacia abajo cierra la hoja (gesto natural en el móvil).
  function onDragStart(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' || (event.target as HTMLElement).closest('button')) return
    drag.current = { startY: event.clientY, startTime: event.timeStamp, offset: 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onDragMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    const panel = panelRef.current
    if (!state || !panel) return
    state.offset = Math.max(0, event.clientY - state.startY)
    panel.style.transition = 'none'
    panel.style.transform = `translateY(${state.offset}px)`
  }

  function onDragEnd(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    const panel = panelRef.current
    drag.current = null
    if (!state || !panel) return
    const speed = state.offset / Math.max(1, event.timeStamp - state.startTime)
    if (state.offset > 110 || (state.offset > 30 && speed > 0.6)) {
      panel.style.setProperty('--evo-drag', `${state.offset}px`)
      panel.style.transform = ''
      dismiss()
    } else {
      panel.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
      panel.style.transform = ''
    }
  }

  const headerButton =
    'flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-evo-surface-2 active:scale-90 active:bg-evo-surface-2'

  return createPortal(
    <div
      className={[
        'fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center sm:p-4',
        closing ? 'evo-backdrop-out' : 'evo-backdrop',
      ].join(' ')}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.6rem] border border-b-0 border-evo-border/60 bg-evo-surface shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl sm:border-b',
          closing ? 'evo-sheet-out' : 'evo-sheet',
        ].join(' ')}
      >
        <div
          className="touch-none"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
            <span className="h-1.5 w-11 rounded-full bg-evo-border" />
          </div>
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-1 px-2 pb-2 pt-1 sm:pt-3">
            {onBack ? (
              <button type="button" onClick={onBack} aria-label="Volver" className={headerButton}>
                <Icon name="back" className="h-5 w-5" />
              </button>
            ) : (
              <span aria-hidden />
            )}
            <h2 id={titleId} className="truncate text-center text-xl font-bold">
              {title}
            </h2>
            <button type="button" onClick={dismiss} aria-label="Cerrar" className={headerButton}>
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer ? <div className="safe-bottom border-t border-evo-border/50 bg-evo-surface px-4 pt-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
