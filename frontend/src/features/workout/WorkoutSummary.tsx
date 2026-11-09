import { Button } from '../../components/ui/Button'
import { SessionReportButton } from '../reports/SessionReportButton'
import type { SessionStats } from './model'

export function WorkoutSummary({
  sessionId,
  title,
  stats,
  minutes,
  onDone,
}: {
  sessionId: number
  title: string
  stats: SessionStats
  minutes: number | null
  onDone: () => void
}) {
  const hasRecords = stats.records.length > 0
  return (
    <div className="space-y-4">
      <div className="panel space-y-1 p-5 text-center">
        <p className="text-5xl" aria-hidden>
          {hasRecords ? '🔥' : '💪'}
        </p>
        <h1 className="font-display text-3xl font-bold">Sesión completada</h1>
        <p className="text-evo-muted">{title}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Series" value={`${stats.doneSets}`} />
        <Stat label="Volumen" value={stats.volumeKg > 0 ? `${stats.volumeKg.toLocaleString('es-ES')} kg` : '—'} />
        <Stat label="Duración" value={minutes != null ? `${minutes} min` : '—'} />
      </div>

      <div className="panel space-y-3 p-5">
        <h2 className="font-display text-xl font-bold">{hasRecords ? 'Récords de hoy' : 'Récords'}</h2>
        {hasRecords ? (
          <ul className="space-y-2">
            {stats.records.map((record) => (
              <li key={record.exercise} className="rounded-2xl bg-evo-warn/10 px-4 py-3">
                <p className="font-bold">{record.exercise}</p>
                <p className="text-sm text-evo-warn">{record.label}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-evo-muted">Hoy no ha caído ningún récord. La constancia también cuenta.</p>
        )}
      </div>

      <div className="space-y-2">
        <Button size="lg" fullWidth onClick={onDone}>
          Ir a la agenda
        </Button>
        <SessionReportButton sessionId={sessionId} size="lg" fullWidth label="Descargar resumen en PDF" />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
