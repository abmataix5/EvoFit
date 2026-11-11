import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Icon } from '../components/icons/Icon'
import { WeekStrip } from '../components/routines/WeekStrip'
import { ButtonLink } from '../components/ui/Button'
import { routinesQuery } from '../lib/queries'
import { api, type Routine } from '../lib/api'
import { formatShortDate } from '../lib/dates'

function formatRange(routine: Routine) {
  if (!routine.starts_on && !routine.ends_on) return 'Indefinida'
  if (routine.starts_on && !routine.ends_on) return `Desde ${formatShortDate(routine.starts_on)}`
  if (!routine.starts_on && routine.ends_on) return `Hasta ${formatShortDate(routine.ends_on)}`
  return `${formatShortDate(routine.starts_on)} → ${formatShortDate(routine.ends_on)}`
}

export function RoutinesPage() {
  const queryClient = useQueryClient()
  const { notify } = useUiFeedback()
  const { data, isLoading } = useQuery(routinesQuery)

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      await api.patch(`/routines/${id}`, { is_active })
    },
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['routines'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar-week'] })
      notify(vars.is_active ? 'Rutina activada' : 'Rutina pausada', 'success')
    },
  })

  const active = (data ?? []).filter((r) => r.is_active)
  const inactive = (data ?? []).filter((r) => !r.is_active)
  const busy = toggleActive.isPending

  if (!isLoading && !data?.length) {
    return (
      <div className="flex min-h-[68dvh] items-center">
        <section className="panel w-full space-y-5 p-6 text-center">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">Aún no tienes ninguna</h1>
            <p className="text-base leading-relaxed text-evo-muted">
              Crea la primera. Los días que elijas se colocan solos en la agenda.
            </p>
          </div>
          <ButtonLink to="/routines/new" size="lg" fullWidth>
            Crear rutina
          </ButtonLink>
          <Link to="/exercises" className="inline-flex text-base font-bold text-evo-accent">
            Ver catálogo de ejercicios
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <ButtonLink to="/routines/new" size="lg">
          + Nueva rutina
        </ButtonLink>
        <ButtonLink to="/exercises" size="lg" variant="secondary">
          Catálogo
        </ButtonLink>
      </div>

      {isLoading ? (
        <p className="text-base text-evo-muted">Cargando…</p>
      ) : (
        <>
          <RoutineGroup
            title="Activas"
            hint="Salen en tu agenda."
            empty="Ninguna activa: actívala para que salga en la agenda."
            routines={active}
            onToggle={(routine) => toggleActive.mutate({ id: routine.id, is_active: false })}
            busy={busy}
          />
          {inactive.length > 0 ? (
            <RoutineGroup
              title="En pausa"
              empty=""
              routines={inactive}
              onToggle={(routine) => toggleActive.mutate({ id: routine.id, is_active: true })}
              busy={busy}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function RoutineGroup({
  title,
  hint,
  empty,
  routines,
  onToggle,
  busy,
}: {
  title: string
  hint?: string
  empty: string
  routines: Routine[]
  onToggle: (routine: Routine) => void
  busy: boolean
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-evo-muted">
          {title} · {routines.length}
        </h2>
        {hint ? <p className="text-xs text-evo-muted">{hint}</p> : null}
      </div>
      {routines.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-evo-border/70 px-4 py-5 text-center text-sm text-evo-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {routines.map((routine) => {
            const days = [...(routine.days ?? [])].sort((a, b) => (a.weekday ?? 9) - (b.weekday ?? 9))
            const exercises = days.reduce((sum, day) => sum + (day.exercises?.length ?? 0), 0)
            return (
              <li key={routine.id} className={['panel overflow-hidden', routine.is_active ? '' : 'opacity-80'].join(' ')}>
                <Link to={`/routines/${routine.id}`} className="block space-y-3 p-4 transition active:bg-evo-surface-2/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-xl font-bold">{routine.name}</p>
                      <p className="mt-0.5 truncate text-sm text-evo-muted">
                        {days.length} {days.length === 1 ? 'día' : 'días'} · {exercises} ejercicios
                        {routine.starts_on || routine.ends_on ? ` · ${formatRange(routine)}` : ''}
                      </p>
                    </div>
                    <Icon name="chevron" className="mt-1.5 h-4 w-4 shrink-0 text-evo-muted" />
                  </div>
                  <WeekStrip weekdays={days.map((day) => day.weekday)} size="sm" />
                  {days.length > 0 ? (
                    <p className="truncate text-sm font-semibold">{days.map((day) => day.name).join(' · ')}</p>
                  ) : null}
                </Link>
                <div className="flex items-center justify-between gap-2 border-t border-evo-border/50 px-4 py-2">
                  <span className={['text-xs font-bold', routine.is_active ? 'text-evo-lime' : 'text-evo-muted'].join(' ')}>
                    {routine.is_active ? '● Activa' : 'En pausa'}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggle(routine)}
                    className="min-h-10 rounded-xl px-3 text-sm font-bold text-evo-muted transition hover:bg-evo-surface-2 hover:text-evo-text disabled:opacity-40"
                  >
                    {routine.is_active ? 'Pausar' : 'Activar'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
