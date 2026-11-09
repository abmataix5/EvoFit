import { isAxiosError } from 'axios'
import { api } from './api'

export type ReportResult = { ok: true } | { ok: false; message: string }

function timezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

function filenameFrom(disposition: string | undefined, fallback: string): string {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  return match?.[1] ? decodeURIComponent(match[1]) : fallback
}

/** iPhone/iPad (también iPad con "sitio de escritorio"): ahí descargar un blob funciona mal, sobre todo en la app instalada. */
function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

async function errorMessage(error: unknown): Promise<string> {
  if (isAxiosError(error)) {
    if (!error.response) return 'Sin conexión. Inténtalo cuando tengas cobertura.'
    const data: unknown = error.response.data
    try {
      const text = data instanceof Blob ? await data.text() : typeof data === 'string' ? data : JSON.stringify(data)
      const parsed = JSON.parse(text) as { message?: string }
      if (parsed.message) return parsed.message
    } catch {
      // respuesta no JSON
    }
    if (error.response.status === 429) return 'Demasiadas descargas seguidas. Espera un minuto.'
  }
  return 'No se pudo generar el informe. Inténtalo de nuevo.'
}

async function deliver(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'application/pdf' })

  if (isIos() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (error) {
      // El usuario cerró la hoja de compartir: no es un error.
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function download(path: string, params: Record<string, string | undefined>, fallback: string): Promise<ReportResult> {
  try {
    const response = await api.get<Blob>(path, {
      params: { ...params, tz: timezone() },
      responseType: 'blob',
      headers: { Accept: 'application/pdf, application/json' },
    })
    await deliver(response.data, filenameFrom(response.headers['content-disposition'] as string | undefined, fallback))
    return { ok: true }
  } catch (error) {
    return { ok: false, message: await errorMessage(error) }
  }
}

export function downloadRangeReport(from: string, to: string): Promise<ReportResult> {
  return download('/reports/workouts', { from, to }, `evofit-${from}_${to}.pdf`)
}

export function downloadSessionReport(sessionId: number): Promise<ReportResult> {
  return download(`/workout-sessions/${sessionId}/report`, {}, `evofit-sesion-${sessionId}.pdf`)
}

/** ¿La sesión tiene algo que contar en un informe? */
export function sessionHasReport(session: {
  completed_at?: string | null
  set_logs?: Array<{ weight_kg: string | number | null; reps: number | null; duration_seconds?: number | null }>
}): boolean {
  if (session.completed_at) return true
  return (session.set_logs ?? []).some(
    (log) => log.weight_kg != null || log.reps != null || log.duration_seconds != null,
  )
}
