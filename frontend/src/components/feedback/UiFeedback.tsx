import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Button } from '../ui/Button'

type ToastTone = 'success' | 'error' | 'info'

type Toast = {
  id: number
  message: string
  tone: ToastTone
}

type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type UiFeedbackContextValue = {
  notify: (message: string, tone?: ToastTone) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const UiFeedbackContext = createContext<UiFeedbackContextValue | null>(null)

export function UiFeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 2800)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ options, resolve })
    })
  }, [])

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm])

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              'pointer-events-auto w-full max-w-md rounded-2xl border-2 px-4 py-3 text-sm font-semibold shadow-lg',
              toast.tone === 'success'
                ? 'border-evo-lime/40 bg-evo-lime text-[#102000]'
                : toast.tone === 'error'
                  ? 'border-evo-danger bg-evo-danger text-white'
                  : 'border-evo-border bg-evo-surface-2 text-evo-text',
            ].join(' ')}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>

      {confirmState ? (
        <ConfirmDialog
          options={confirmState.options}
          onAnswer={(answer) => {
            confirmState.resolve(answer)
            setConfirmState(null)
          }}
        />
      ) : null}
    </UiFeedbackContext.Provider>
  )
}

export function useUiFeedback() {
  const ctx = useContext(UiFeedbackContext)
  if (!ctx) {
    throw new Error('useUiFeedback debe usarse dentro de UiFeedbackProvider')
  }
  return ctx
}

/** Diálogo modal: foco dentro, Escape cancela y al cerrar el foco vuelve a donde estaba. */
function ConfirmDialog({
  options,
  onAnswer,
}: {
  options: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
  onAnswer: (answer: boolean) => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const answerRef = useRef(onAnswer)
  useEffect(() => {
    answerRef.current = onAnswer
  }, [onAnswer])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        answerRef.current(false)
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onClick={(event) => {
        if (event.target === event.currentTarget) onAnswer(false)
      }}
    >
      <div ref={panelRef} className="safe-bottom panel w-full max-w-md space-y-4 p-5">
        <div>
          <h2 id="confirm-title" className="font-display text-xl font-bold">
            {options.title}
          </h2>
          <p id="confirm-message" className="mt-2 text-sm text-evo-muted">
            {options.message}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button ref={cancelRef} variant="secondary" size="lg" fullWidth onClick={() => onAnswer(false)}>
            {options.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button variant={options.danger ? 'danger' : 'primary'} size="lg" fullWidth onClick={() => onAnswer(true)}>
            {options.confirmLabel ?? 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
