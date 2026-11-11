import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Icon } from '../components/icons/Icon'
import { Button, ButtonLink } from '../components/ui/Button'
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
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-base text-evo-muted">Solo las activas salen en la agenda.</p>
          <Link
            to="/exercises"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-2xl bg-evo-surface-2 px-3 text-sm font-bold"
          >
            Catálogo
            <Icon name="chevron" className="h-4 w-4" />
          </Link>
        </div>
        <ButtonLink to="/routines/new" size="lg" fullWidth>
          Nueva rutina
        </ButtonLink>
      </div>

      {isLoading ? (
        <p className="text-base text-evo-muted">Cargando…</p>
      ) : (
        <>
          <RoutineGroup
            title={`Activas (${active.length})`}
            empty="No hay rutinas activas."
            routines={active}
            onToggle={(routine) => toggleActive.mutate({ id: routine.id, is_active: false })}
            busy={busy}
          />
          <RoutineGroup
            title={`Pausadas (${inactive.length})`}
            empty="No hay rutinas pausadas."
            routines={inactive}
            onToggle={(routine) => toggleActive.mutate({ id: routine.id, is_active: true })}
            busy={busy}
          />
        </>
      )}
    </div>
  )
}

function RoutineGroup({
  title,
  empty,
  routines,
  onToggle,
  busy,
}: {
  title: string
  empty: string
  routines: Routine[]
  onToggle: (routine: Routine) => void
  busy: boolean
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {routines.length === 0 ? (
        <p className="text-sm text-evo-muted">{empty}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {routines.map((routine) => (
            <li key={routine.id} className="panel overflow-hidden">
              <Link to={`/routines/${routine.id}`} className="block px-4 py-4 hover:bg-evo-surface-2/50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-xl font-bold">{routine.name}</p>
                    <p className="mt-1 text-sm text-evo-muted">
                      {routine.days_count ?? routine.days?.length ?? 0} días ·{' '}
                      {routine.exercises_count ?? 0} ejercicios · {formatRange(routine)}
                    </p>
                  </div>
                  <span
                    className={[
                      'chip',
                      routine.is_active
                        ? 'bg-evo-lime text-[#102000]'
                        : 'bg-evo-surface-2 text-evo-muted',
                    ].join(' ')}
                  >
                    {routine.is_active ? 'Activa' : 'Pausa'}
                  </span>
                </div>
              </Link>
              <div className="flex flex-wrap gap-2 border-t border-evo-border px-4 py-3">
                <Button
                  variant="secondary"
                  className="!min-h-11 flex-1"
                  disabled={busy}
                  onClick={() => onToggle(routine)}
                >
                  {routine.is_active ? 'Pausar' : 'Activar'}
                </Button>
                <ButtonLink to={`/routines/${routine.id}/edit`} variant="secondary" className="!min-h-11 flex-1">
                  Editar
                </ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
