import { useState } from 'react'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Icon } from '../../components/icons/Icon'
import { Button } from '../../components/ui/Button'
import { downloadSessionReport } from '../../lib/reports'

/** Descarga el PDF de una sesión concreta. */
export function SessionReportButton({
  sessionId,
  label = 'Descargar PDF',
  variant = 'secondary',
  size = 'md',
  fullWidth,
  compact,
}: {
  sessionId: number
  label?: string
  variant?: 'secondary' | 'ghost' | 'primary'
  size?: 'md' | 'lg'
  fullWidth?: boolean
  /** Solo icono + "PDF" (cabeceras estrechas). */
  compact?: boolean
}) {
  const { notify } = useUiFeedback()
  const [busy, setBusy] = useState(false)

  async function run() {
    if (busy) return
    setBusy(true)
    const result = await downloadSessionReport(sessionId)
    setBusy(false)
    notify(result.ok ? 'Informe descargado' : result.message, result.ok ? 'success' : 'error')
  }

  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      disabled={busy}
      aria-label={compact ? label : undefined}
      onClick={() => void run()}
    >
      {busy ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        <Icon name="download" />
      )}
      {compact ? 'PDF' : busy ? 'Generando…' : label}
    </Button>
  )
}
