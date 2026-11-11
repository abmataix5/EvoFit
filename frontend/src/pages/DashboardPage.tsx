import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Button, ButtonLink } from '../components/ui/Button'
import {
  api,
  type ProgressInsight,
  type Routine,
  type RoutineExercise,
  type TrainingHighlights,
  type WorkoutSession,
} from '../lib/api'
import { addDays, formatDayLabel, localDateKey, relativeDayLabel, startOfWeek } from '../lib/dates'
import { invalidateTraining } from '../lib/queryClient'
import { PostList } from '../features/feed/PostList'
import { feedQuery } from '../lib/feed'
import { StoriesBar } from '../features/stories/StoriesBar'
import { friendsQuery } from '../lib/social'

const WEEK_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Minutos aproximados: cada serie ~40 s de trabajo más su descanso. */
function estimateMinutes(exercises: RoutineExercise[]): number {
  const seconds = exercises.reduce((sum, exercise) => {
    const sets = exercise.default_sets || 1
    const work = exercise.default_duration_seconds ?? 40
    return sum + sets * (work + (exercise.rest_seconds ?? 90))
  }, 0)
  return Math.max(10, Math.round(seconds / 60 / 5) * 5)
}

function kg(value: number) {
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })} kg`
}

/** Lo de siempre: entreno de hoy, racha, semana y último récord. */
function MyDayView() {
  const navigate = useNavigate()
  const { notify } = useUiFeedback()
  const weekStart = startOfWeek()
  const weekFrom = localDateKey(weekStart)
  const weekTo = localDateKey(addDays(weekStart, 6))
  const todayKey = localDateKey()

  const routinesQuery = useQuery({
    queryKey: ['routines'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Routine[] }>('/routines')
      return data.data
    },
  })

  const calendarQuery = useQuery({
    queryKey: ['calendar-week', weekFrom, weekTo],
    queryFn: async () => {
      const { data } = await api.get<{ data: WorkoutSession[] }>('/workout-sessions/calendar', {
        params: { from: weekFrom, to: weekTo },
      })
      return data.data
    },
  })

  const highlightsQuery = useQuery({
    queryKey: ['progress-highlights'],
    queryFn: async () => {
      const { data } = await api.get<TrainingHighlights>('/progress/highlights')
      return data
    },
  })

  const insightsQuery = useQuery({
    queryKey: ['progress-insights'],
    queryFn: async () => {
      const { data } = await api.get<ProgressInsight>('/progress/insights')
      return data
    },
  })

  const trainAnyway = useMutation({
    mutationFn: async (payload: { routineId: number; dayId: number }) => {
      const { data } = await api.post<{ session: WorkoutSession }>('/workout-sessions', {
        routine_id: payload.routineId,
        routine_day_id: payload.dayId,
        scheduled_date: todayKey,
      })
      return data.session
    },
    onSuccess: (session) => {
      void invalidateTraining()
      navigate(`/workout/${session.id}`)
    },
    onError: () => notify('No se pudo empezar la sesión. Revisa la conexión.', 'error'),
  })

  const activeRoutines = routinesQuery.data?.filter((r) => r.is_active) ?? []
  const weekSessions = calendarQuery.data ?? []
  const completed = weekSessions.filter((s) => s.completed_at).length
  const planned = Math.max(
    activeRoutines.reduce((sum, r) => sum + (r.sessions_per_week || 0), 0),
    weekSessions.length,
  )
  const todaySessions = weekSessions.filter((s) => s.scheduled_date === todayKey)
  const nextSession = weekSessions.find((s) => s.scheduled_date > todayKey && !s.completed_at)
  const highlights = highlightsQuery.data
  const mood = insightsQuery.data?.summary.mood
  const pickableDays = activeRoutines.flatMap((routine) =>
    (routine.days ?? [])
      .filter((day) => (day.exercises?.length ?? 0) > 0)
      .map((day) => ({ routine, day })),
  )

  return (
    <div className="space-y-5">
      {/* Hoy toca */}
      <section aria-label="Hoy" className="space-y-3">
        {calendarQuery.isLoading ? (
          <div className="panel h-48 animate-pulse" aria-label="Cargando" />
        ) : todaySessions.length > 0 ? (
          todaySessions.map((session) => <TodayCard key={session.id} session={session} />)
        ) : (
          <div className="panel space-y-4 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-evo-muted">
                Hoy
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold">Día de descanso</h2>
              <p className="mt-1 text-sm text-evo-muted">
                {nextSession
                  ? `Próxima sesión: ${nextSession.day?.name ?? 'Entrenamiento'} · ${formatDayLabel(nextSession.scheduled_date)}`
                  : 'No hay nada planificado. Recuperar también es entrenar.'}
              </p>
            </div>
            {pickableDays.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">¿Te apetece entrenar igualmente?</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {pickableDays.map(({ routine, day }) => (
                    <button
                      key={day.id}
                      type="button"
                      disabled={trainAnyway.isPending}
                      onClick={() => trainAnyway.mutate({ routineId: routine.id, dayId: day.id })}
                      className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-4 text-left transition hover:border-evo-accent disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{day.name}</span>
                        <span className="block truncate text-xs text-evo-muted">
                          {day.exercises?.length ?? 0} ejercicios
                          {activeRoutines.length > 1 ? ` · ${routine.name}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 font-bold text-evo-accent" aria-hidden>
                        Empezar →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : activeRoutines.length === 0 && !routinesQuery.isLoading ? (
              <ButtonLink to="/routines/new">Crear mi primera rutina</ButtonLink>
            ) : null}
          </div>
        )}
      </section>

      {/* Racha · semana · récord */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Tu progreso">
        <div className="panel p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">Racha</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl" aria-hidden>
              {highlights && highlights.streak.weeks > 0 ? '🔥' : '🌱'}
            </span>
            <span className="font-display text-3xl font-bold tabular-nums sm:text-4xl">{highlights?.streak.weeks ?? '—'}</span>
            <span className="text-sm font-semibold text-evo-muted">
              {highlights?.streak.weeks === 1 ? 'semana' : 'semanas'}
            </span>
          </p>
          <p className="mt-1 text-sm text-evo-muted">
            {!highlights
              ? 'Semanas seguidas entrenando'
              : highlights.streak.weeks === 0
                ? 'Entrena esta semana para empezarla.'
                : highlights.streak.this_week === 0
                  ? '¡No la pierdas! Entrena esta semana.'
                  : highlights.streak.best > highlights.streak.weeks
                    ? `Tu mejor racha: ${highlights.streak.best} semanas`
                    : 'Es tu mejor racha. Sigue así.'}
          </p>
        </div>

        <div className="panel order-last col-span-2 p-4 sm:order-none sm:col-span-1">
          <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">Esta semana</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-bold tabular-nums text-evo-accent">{completed}</span>
            <span className="font-display text-xl font-bold text-evo-muted">/{planned || 0}</span>
            <span className="ml-1 text-sm font-semibold text-evo-muted">sesiones</span>
          </p>
          <ol className="mt-2.5 grid grid-cols-7 gap-1" aria-label="Días de la semana">
            {WEEK_LETTERS.map((letter, index) => {
              const key = localDateKey(addDays(weekStart, index))
              const sessions = weekSessions.filter((s) => s.scheduled_date === key)
              const done = sessions.some((s) => s.completed_at)
              const pending = !done && sessions.length > 0
              const isToday = key === todayKey
              return (
                <li
                  key={key}
                  className="flex flex-col items-center gap-1"
                  aria-label={`${letter}: ${done ? 'hecha' : pending ? (key < todayKey ? 'sin hacer' : 'pendiente') : 'descanso'}`}
                >
                  <span className={['text-[0.7rem] font-bold', isToday ? 'text-evo-text' : 'text-evo-muted'].join(' ')}>
                    {letter}
                  </span>
                  <span
                    className={[
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                      done
                        ? 'bg-evo-lime text-[#102000]'
                        : pending
                          ? key < todayKey
                            ? 'border-2 border-dashed border-evo-border'
                            : 'border-2 border-evo-accent'
                          : 'bg-evo-surface-2',
                      isToday ? 'ring-2 ring-evo-accent/50 ring-offset-2 ring-offset-evo-surface' : '',
                    ].join(' ')}
                    aria-hidden
                  >
                    {done ? '✓' : ''}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="panel p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">Último récord</p>
          {highlights?.last_record ? (
            <Link
              to={`/exercise-history/${highlights.last_record.routine_exercise_id}`}
              className="group mt-1 block rounded-xl"
            >
              <p className="truncate font-display text-base font-bold group-hover:text-evo-accent sm:text-lg">
                🏆 {highlights.last_record.exercise}
              </p>
              <p className="font-display text-xl font-bold tabular-nums sm:text-2xl">
                {kg(highlights.last_record.weight_kg)}
                {highlights.last_record.reps ? (
                  <span className="text-lg text-evo-muted"> × {highlights.last_record.reps}</span>
                ) : null}
              </p>
              <p className="text-sm text-evo-muted">
                <span className="font-semibold text-evo-lime">
                  +{kg(Math.round((highlights.last_record.weight_kg - highlights.last_record.previous_kg) * 100) / 100)}
                </span>{' '}
                · {relativeDayLabel(highlights.last_record.date)}
              </p>
            </Link>
          ) : (
            <p className="mt-2 text-sm text-evo-muted">
              Cuando superes el peso máximo de un ejercicio lo verás aquí.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel flex flex-col justify-between gap-3 p-5 lg:order-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">Pulso semanal</p>
            <p
              className={[
                'mt-1 font-display text-2xl font-bold',
                mood === 'green' ? 'text-evo-lime' : mood === 'red' ? 'text-evo-danger' : 'text-evo-warn',
              ].join(' ')}
            >
              {mood === 'green' ? 'Subiendo' : mood === 'red' ? 'Ajustar' : 'Estable'}
            </p>
            <p className="mt-1 text-sm text-evo-muted">
              {insightsQuery.data?.summary.label ?? 'Registra kilos para ver tu tendencia.'}
            </p>
          </div>
          <ButtonLink to="/progress" variant="secondary">
            Ver progreso
          </ButtonLink>
        </section>

        <section className="space-y-3 lg:order-1 lg:col-span-2">
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
                  <Link to={`/routines/${routine.id}`} className="panel block px-4 py-4 transition hover:border-evo-accent">
                    <p className="font-display text-lg font-bold">{routine.name}</p>
                    <p className="mt-1 text-sm text-evo-muted">
                      {routine.days_count ?? routine.days?.length ?? 0} días · {routine.exercises_count ?? 0} ejercicios
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function TodayCard({ session }: { session: WorkoutSession }) {
  const navigate = useNavigate()
  const exercises = session.day?.exercises ?? []
  const totalSets = exercises.reduce((sum, e) => sum + (e.default_sets || 1), 0)
  const loggedSets = (session.set_logs ?? []).filter(
    (log) => log.completed && (log.weight_kg != null || log.reps != null || log.duration_seconds != null),
  ).length
  const done = Boolean(session.completed_at)
  const started = !done && loggedSets > 0
  const progress = totalSets > 0 ? Math.min(1, loggedSets / totalSets) : 0

  return (
    <article
      className={[
        'panel overflow-hidden border-2 p-0',
        done ? 'border-evo-lime/50' : 'border-evo-accent/60',
      ].join(' ')}
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={['text-xs font-bold uppercase tracking-[0.14em]', done ? 'text-evo-lime' : 'text-evo-accent'].join(' ')}
            >
              {done ? 'Hoy · completada' : started ? 'Hoy · a medias' : 'Hoy toca'}
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold leading-tight">{session.day?.name ?? 'Entrenamiento'}</h2>
            <p className="mt-0.5 text-sm text-evo-muted">{session.routine?.name}</p>
          </div>
          {done ? (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-evo-lime text-2xl font-bold text-[#102000]" aria-hidden>
              ✓
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-evo-surface-2 px-2 py-2.5">
            <dt className="text-[0.7rem] font-bold uppercase tracking-wide text-evo-muted">Ejercicios</dt>
            <dd className="font-display text-xl font-bold tabular-nums">{exercises.length}</dd>
          </div>
          <div className="rounded-2xl bg-evo-surface-2 px-2 py-2.5">
            <dt className="text-[0.7rem] font-bold uppercase tracking-wide text-evo-muted">Series</dt>
            <dd className="font-display text-xl font-bold tabular-nums">
              {started || done ? `${loggedSets}/${totalSets}` : totalSets}
            </dd>
          </div>
          <div className="rounded-2xl bg-evo-surface-2 px-2 py-2.5">
            <dt className="text-[0.7rem] font-bold uppercase tracking-wide text-evo-muted">Duración</dt>
            <dd className="font-display text-xl font-bold tabular-nums">~{estimateMinutes(exercises)}′</dd>
          </div>
        </dl>

        {exercises.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Ejercicios de hoy">
            {exercises.slice(0, 6).map((exercise) => (
              <li key={exercise.id} className="rounded-full bg-evo-bg/50 px-3 py-1 text-xs font-semibold text-evo-muted">
                {exercise.name}
              </li>
            ))}
            {exercises.length > 6 ? (
              <li className="rounded-full px-2 py-1 text-xs font-semibold text-evo-muted">+{exercises.length - 6}</li>
            ) : null}
          </ul>
        ) : null}

        {started ? (
          <div className="h-2 overflow-hidden rounded-full bg-evo-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-evo-lime" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}

        <Button
          size="lg"
          fullWidth
          variant={done ? 'secondary' : 'primary'}
          className="!min-h-16 text-lg"
          onClick={() => navigate(`/workout/${session.id}`)}
        >
          {done ? 'Ver entrenamiento' : started ? 'Continuar entrenamiento →' : 'Empezar entrenamiento →'}
        </Button>
      </div>
    </article>
  )
}

type HomeView = 'friends' | 'day'
const VIEW_KEY = 'evofit:home-view'

function readView(): HomeView | null {
  try {
    const value = localStorage.getItem(VIEW_KEY)
    return value === 'friends' || value === 'day' ? value : null
  } catch {
    return null
  }
}

/** Inicio: el feed de amigos y "Mi día", en dos vistas. Recuerda la última elegida. */
export function DashboardPage() {
  const friends = useQuery(friendsQuery)
  const [chosen, setChosen] = useState<HomeView | null>(readView)
  // Sin elegir aún: el feed si ya tienes amigos; si no, tu día.
  const view: HomeView = chosen ?? ((friends.data?.length ?? 0) > 0 ? 'friends' : 'day')

  function choose(next: HomeView) {
    setChosen(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Sin almacenamiento (modo privado): solo dura esta visita.
    }
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Inicio" className="mx-auto grid max-w-2xl grid-cols-2 gap-1 rounded-2xl bg-evo-surface-2 p-1">
        {(
          [
            { id: 'friends', label: 'Amigos' },
            { id: 'day', label: 'Mi día' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            onClick={() => choose(item.id)}
            className={['min-h-11 rounded-xl text-sm font-bold transition', view === item.id ? 'bg-evo-surface text-evo-text shadow' : 'text-evo-muted'].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>
      {view === 'friends' ? <FriendsFeed hasFriends={(friends.data?.length ?? 0) > 0} /> : <MyDayView />}
    </div>
  )
}

function FriendsFeed({ hasFriends }: { hasFriends: boolean }) {
  const feed = useInfiniteQuery(feedQuery)

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <StoriesBar />
      <PostList
        query={feed}
        empty={
          <div className="space-y-3 rounded-3xl border-2 border-dashed border-evo-border p-6 text-center">
            <p className="text-3xl" aria-hidden>
              {hasFriends ? '🏋️' : '👋'}
            </p>
            <p className="font-display text-xl font-bold">{hasFriends ? 'Aún no hay entrenos' : 'Entrena con tus amigos'}</p>
            <p className="text-sm text-evo-muted">
              {hasFriends
                ? 'Cuando tú o tus amigos terminéis un entreno y lo compartáis, aparecerá aquí.'
                : 'Añade a tus amigos para ver sus entrenos, darles «me gusta» y comentar. Tus entrenos compartidos también salen aquí.'}
            </p>
            {!hasFriends ? (
              <ButtonLink to="/search" className="mt-1">
                Buscar amigos
              </ButtonLink>
            ) : null}
          </div>
        }
      />
    </div>
  )
}
