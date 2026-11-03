import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { ButtonLink } from '../components/ui/Button'
import { useAuth } from '../features/auth/AuthContext'
import { api, type Routine, type WorkoutSession, type ProgressInsight } from '../lib/api'
import { addDays, localDateKey, startOfWeek } from '../lib/dates'
import { firstName, getDayMotivation, helloLine } from '../lib/motivation'
import { invalidateTraining } from '../lib/queryClient'

export function DashboardPage() {
  const { user } = useAuth()
  const motivation = getDayMotivation()
  const name = firstName(user?.name)

  const routinesQuery = useQuery({
    queryKey: ['routines'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Routine[] }>('/routines')
      return data.data
    },
  })

  const navigate = useNavigate()
  const { notify } = useUiFeedback()
  const weekFrom = localDateKey(startOfWeek())
  const weekTo = localDateKey(addDays(startOfWeek(), 6))

  const calendarQuery = useQuery({
    queryKey: ['calendar-week', weekFrom, weekTo],
    queryFn: async () => {
      const { data } = await api.get<{ data: WorkoutSession[] }>('/workout-sessions/calendar', {
        params: { from: weekFrom, to: weekTo },
      })
      return data.data
    },
  })

  const trainAnyway = useMutation({
    mutationFn: async (payload: { routineId: number; dayId: number }) => {
      const { data } = await api.post<{ session: WorkoutSession }>('/workout-sessions', {
        routine_id: payload.routineId,
        routine_day_id: payload.dayId,
        scheduled_date: localDateKey(),
      })
      return data.session
    },
    onSuccess: (session) => {
      void invalidateTraining()
      navigate(`/workout/${session.id}`)
    },
    onError: () => notify('No se pudo empezar la sesión. Revisa la conexión.', 'error'),
  })

  const insightsQuery = useQuery({
    queryKey: ['progress-insights'],
    queryFn: async () => {
      const { data } = await api.get<ProgressInsight>('/progress/insights')
      return data
    },
  })

  const activeRoutines = routinesQuery.data?.filter((r) => r.is_active) ?? []
  const weekSessions = calendarQuery.data ?? []
  const completed = weekSessions.filter((s) => s.completed_at).length
  const planned = Math.max(
    activeRoutines.reduce((sum, r) => sum + (r.sessions_per_week || 0), 0),
    weekSessions.length,
  )
  const todayKey = localDateKey()
  const todaySessions = weekSessions.filter((s) => s.scheduled_date === todayKey)
  const mood = insightsQuery.data?.summary.mood

  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden p-0">
        <div className="bg-gradient-to-br from-[#ff8a4c] via-[#ff9d68] to-[#ffd0a8] p-5 text-[#1a120c]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a120c]/70">
            {helloLine(user?.name)} · {motivation.label}
          </p>
          <h2 className="mt-1 font-display text-[1.65rem] font-bold leading-tight sm:text-3xl">
            {motivation.headline}
          </h2>
          <p className="mt-2 max-w-xl text-base font-semibold leading-snug text-[#1a120c]/90">
            {name === 'atleta' ? motivation.line : `${name}, ${motivation.line.charAt(0).toLowerCase()}${motivation.line.slice(1)}`}
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel overflow-hidden p-0 lg:col-span-2">
          <div className="border-b border-evo-border/60 bg-evo-surface-2/60 px-5 py-4">
            <p className="text-sm font-bold uppercase tracking-wide text-evo-muted">Esta semana</p>
            <p className="mt-1 font-display text-5xl font-bold tracking-tight text-evo-accent">
              {completed}/{planned || 0}
            </p>
            <p className="text-sm font-semibold text-evo-muted">sesiones hechas</p>
          </div>
          <div className="space-y-3 p-5">
            {todaySessions.length > 0 ? (
              todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-4 py-3"
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-evo-accent">Hoy toca</p>
                    <p className="font-display text-lg font-bold">
                      {session.day?.name ?? 'Entrenamiento'}
                    </p>
                    <p className="text-sm text-evo-muted">{session.routine?.name}</p>
                  </div>
                  <ButtonLink to={`/workout/${session.id}`} size="lg">
                    {session.completed_at ? 'Ver' : (session.set_logs?.length ?? 0) > 0 ? 'Continuar' : 'Empezar'}
                  </ButtonLink>
                </div>
              ))
            ) : (
              <div className="space-y-3 rounded-2xl border-2 border-dashed border-evo-border p-4">
                <p className="font-semibold">Hoy no hay sesión planificada</p>
                {activeRoutines.some((r) => (r.days?.length ?? 0) > 0) ? (
                  <div className="space-y-2">
                    <p className="text-sm text-evo-muted">¿Entrenas igualmente? Elige el día:</p>
                    <div className="flex flex-wrap gap-2">
                      {activeRoutines.flatMap((routine) =>
                        (routine.days ?? [])
                          .filter((day) => (day.exercises?.length ?? 0) > 0)
                          .map((day) => (
                            <button
                              key={day.id}
                              type="button"
                              disabled={trainAnyway.isPending}
                              onClick={() => trainAnyway.mutate({ routineId: routine.id, dayId: day.id })}
                              className="min-h-12 rounded-2xl bg-evo-surface-2 px-4 text-left text-sm font-bold disabled:opacity-50"
                            >
                              {day.name}
                              {activeRoutines.length > 1 ? (
                                <span className="block text-xs font-semibold text-evo-muted">{routine.name}</span>
                              ) : null}
                            </button>
                          )),
                      )}
                    </div>
                  </div>
                ) : null}
                <ButtonLink to="/calendar" variant="secondary">
                  Ver agenda
                </ButtonLink>
              </div>
            )}
          </div>
        </section>

        <section className="panel flex flex-col items-center justify-center gap-3 p-5 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-evo-muted">Pulso semanal</p>
          <p
            className={[
              'font-display text-3xl font-bold',
              mood === 'green' ? 'text-evo-lime' : mood === 'red' ? 'text-evo-danger' : 'text-evo-warn',
            ].join(' ')}
          >
            {mood === 'green' ? 'Subiendo' : mood === 'red' ? 'Ajustar' : 'Estable'}
          </p>
          <p className="text-sm text-evo-text">
            {insightsQuery.data?.summary.label ?? 'Registra kilos para ver tu tendencia.'}
          </p>
          <ButtonLink to="/progress" variant="lime">
            Ver progreso
          </ButtonLink>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Tus rutinas</h2>
          <ButtonLink to="/routines/new" variant="secondary">
            + Nueva
          </ButtonLink>
        </div>
        {routinesQuery.isLoading ? (
          <p className="text-sm text-evo-muted">Cargando rutinas…</p>
        ) : activeRoutines.length === 0 ? (
          <div className="panel border-dashed p-5 text-center">
            <p className="font-semibold">No hay rutinas activas</p>
            <ButtonLink to="/routines/new" className="mt-3">
              Crear rutina
            </ButtonLink>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {activeRoutines.slice(0, 4).map((routine) => (
              <li key={routine.id}>
                <Link
                  to={`/routines/${routine.id}`}
                  className="panel block px-4 py-4 transition hover:border-evo-accent"
                >
                  <p className="font-display text-lg font-bold">{routine.name}</p>
                  <p className="mt-1 text-sm text-evo-muted">
                    {routine.days_count ?? routine.days?.length ?? 0} días ·{' '}
                    {routine.exercises_count ?? 0} ejercicios
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
