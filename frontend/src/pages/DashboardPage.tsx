import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { ButtonLink } from '../components/ui/Button'
import { Icon } from '../components/icons/Icon'
import {
  api,
  type ProgressInsight,
  type Routine,
  type RoutineExercise,
  type TrainingHighlights,
  type WorkoutSession,
} from '../lib/api'
import { addDays, localDateKey, relativeDayLabel, startOfWeek, upcomingDayLabel } from '../lib/dates'
import { routinesQuery } from '../lib/queries'
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

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-evo-muted">{children}</h2>
      {action}
    </div>
  )
}

/** Mi día: lo que toca hoy, cómo va la semana y tu progreso. Solo lo necesario. */
function MyDayView() {
  const weekStart = startOfWeek()
  const weekFrom = localDateKey(weekStart)
  const weekTo = localDateKey(addDays(weekStart, 6))
  const todayKey = localDateKey()

  const routines = useQuery(routinesQuery)
  const calendarQuery = useQuery({
    queryKey: ['calendar-week', weekFrom, weekTo],
    queryFn: async () =>
      (await api.get<{ data: WorkoutSession[] }>('/workout-sessions/calendar', { params: { from: weekFrom, to: weekTo } })).data.data,
  })
  const highlightsQuery = useQuery({
    queryKey: ['progress-highlights'],
    queryFn: async () => (await api.get<TrainingHighlights>('/progress/highlights')).data,
  })
  const insightsQuery = useQuery({
    queryKey: ['progress-insights'],
    queryFn: async () => (await api.get<ProgressInsight>('/progress/insights')).data,
  })

  const activeRoutines = routines.data?.filter((r) => r.is_active) ?? []
  const weekSessions = calendarQuery.data ?? []
  const todaySessions = weekSessions.filter((s) => s.scheduled_date === todayKey)
  const nextSession = weekSessions.find((s) => s.scheduled_date > todayKey && !s.completed_at)
  const noRoutines = !routines.isLoading && activeRoutines.length === 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section aria-label="Hoy" className="space-y-3">
        {calendarQuery.isLoading || routines.isLoading ? (
          <div className="h-72 animate-pulse rounded-3xl bg-evo-surface" aria-label="Cargando" />
        ) : noRoutines ? (
          <GetStartedCard />
        ) : todaySessions.length > 0 ? (
          todaySessions.map((session) => <TodayCard key={session.id} session={session} />)
        ) : (
          <RestDayCard nextSession={nextSession ?? null} routines={activeRoutines} />
        )}
      </section>

      {!noRoutines ? (
        <WeekCard
          weekStart={weekStart}
          todayKey={todayKey}
          sessions={weekSessions}
          planned={Math.max(activeRoutines.reduce((sum, r) => sum + (r.sessions_per_week || 0), 0), weekSessions.length)}
          highlights={highlightsQuery.data}
        />
      ) : null}

      {!noRoutines ? <ProgressTiles highlights={highlightsQuery.data} insight={insightsQuery.data} /> : null}
    </div>
  )
}

/** El entreno de hoy, en grande: es lo primero que se viene a hacer a la app. */
function TodayCard({ session }: { session: WorkoutSession }) {
  const navigate = useNavigate()
  const exercises = session.exercises ?? session.day?.exercises ?? []
  const totalSets = exercises.reduce((sum, e) => sum + (e.default_sets || 1), 0)
  const loggedSets = (session.set_logs ?? []).filter(
    (log) => log.completed && (log.weight_kg != null || log.reps != null || log.duration_seconds != null),
  ).length
  const done = Boolean(session.completed_at)
  const started = !done && loggedSets > 0
  const progress = totalSets > 0 ? Math.min(1, loggedSets / totalSets) : 0
  const thumbs = exercises.filter((e) => e.image_urls).slice(0, 4)

  return (
    <article
      className={[
        'relative overflow-hidden rounded-3xl p-5 text-[#1a120c] shadow-[0_18px_40px_rgba(255,138,76,0.18)]',
        done ? 'bg-gradient-to-br from-[#d9fb8f] via-[#b6f36a] to-[#7fd94a]' : 'bg-gradient-to-br from-[#ffb347] via-[#ff8a4c] to-[#f0623c]',
      ].join(' ')}
    >
      <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15" aria-hidden />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-70">
              {done ? '¡Hecho por hoy!' : started ? 'A medias · sigue' : 'Hoy toca'}
            </p>
            <h2 className="mt-1 font-display text-4xl font-bold leading-none [text-wrap:balance]">{session.day?.name ?? 'Entrenamiento'}</h2>
            {session.routine?.name && session.routine.name !== session.day?.name ? (
              <p className="mt-1.5 text-sm font-semibold opacity-75">{session.routine.name}</p>
            ) : null}
          </div>
          {done ? (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#102000]/90 text-2xl font-bold text-evo-lime" aria-hidden>
              ✓
            </span>
          ) : null}
        </div>

        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
          <span>{exercises.length} ejercicios</span>
          <span>{started || done ? `${loggedSets}/${totalSets}` : totalSets} series</span>
          {!done ? <span>~{estimateMinutes(exercises)} min</span> : null}
        </p>

        {thumbs.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="flex shrink-0" aria-hidden>
              {thumbs.map((exercise, index) => (
                <img
                  key={exercise.id}
                  src={exercise.image_urls![0]}
                  alt=""
                  className={['h-11 w-11 rounded-full bg-white object-cover ring-[3px] ring-white/80', index > 0 ? '-ml-3' : ''].join(' ')}
                />
              ))}
            </span>
            <span className="min-w-0 truncate text-sm font-semibold opacity-80">
              {exercises
                .slice(0, 2)
                .map((e) => e.name)
                .join(', ')}
              {exercises.length > 2 ? ` y ${exercises.length - 2} más` : ''}
            </span>
          </div>
        ) : null}

        {started ? (
          <div className="h-2.5 overflow-hidden rounded-full bg-[#1a120c]/15" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso del entreno">
            <div className="h-full rounded-full bg-[#1a120c]" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => navigate(`/workout/${session.id}`)}
          className={[
            'flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold transition active:scale-[0.98]',
            done ? 'bg-[#102000]/90 text-evo-lime' : 'bg-[#1a120c] text-white',
          ].join(' ')}
        >
          {done ? 'Ver entrenamiento' : started ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}
          <span aria-hidden>→</span>
        </button>
      </div>
    </article>
  )
}

/** Día sin entreno: tranquilo, con la próxima sesión y la opción de entrenar igualmente. */
function RestDayCard({ nextSession, routines }: { nextSession: WorkoutSession | null; routines: Routine[] }) {
  const navigate = useNavigate()
  const { notify } = useUiFeedback()
  const [open, setOpen] = useState(false)
  const todayKey = localDateKey()
  const pickable = routines.flatMap((routine) =>
    (routine.days ?? []).filter((day) => (day.exercises?.length ?? 0) > 0).map((day) => ({ routine, day })),
  )

  const trainAnyway = useMutation({
    mutationFn: async (payload: { routineId: number; dayId: number }) =>
      (
        await api.post<{ session: WorkoutSession }>('/workout-sessions', {
          routine_id: payload.routineId,
          routine_day_id: payload.dayId,
          scheduled_date: todayKey,
        })
      ).data.session,
    onSuccess: (session) => {
      void invalidateTraining()
      navigate(`/workout/${session.id}`)
    },
    onError: () => notify('No se pudo empezar la sesión. Revisa la conexión.', 'error'),
  })

  return (
    <article className="overflow-hidden rounded-3xl border border-evo-border/60 bg-evo-surface">
      <div className="flex items-center gap-4 p-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-evo-surface-2 text-4xl" aria-hidden>
          😴
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-evo-muted">Hoy</p>
          <h2 className="font-display text-2xl font-bold leading-tight">Toca descansar</h2>
          <p className="mt-0.5 text-sm text-evo-muted">
            {nextSession
              ? `Próximo: ${nextSession.day?.name ?? 'entreno'}, ${upcomingDayLabel(nextSession.scheduled_date)}`
              : 'El descanso también construye músculo.'}
          </p>
        </div>
      </div>

      {pickable.length > 0 ? (
        <div className="border-t border-evo-border/50">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex min-h-14 w-full items-center justify-between gap-3 px-5 text-left font-bold"
          >
            ¿Te apetece entrenar igualmente?
            <Icon name="chevron" className={['h-4 w-4 text-evo-muted transition', open ? 'rotate-90' : ''].join(' ')} />
          </button>
          {open ? (
            <ul className="space-y-2 px-4 pb-4">
              {pickable.map(({ routine, day }) => (
                <li key={day.id}>
                  <button
                    type="button"
                    disabled={trainAnyway.isPending}
                    onClick={() => trainAnyway.mutate({ routineId: routine.id, dayId: day.id })}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-evo-surface-2 px-4 text-left transition active:scale-[0.99] disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{day.name}</span>
                      <span className="block truncate text-xs text-evo-muted">
                        {day.exercises?.length ?? 0} ejercicios{routines.length > 1 ? ` · ${routine.name}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-evo-accent">Empezar</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

/** Primera vez: tres pasos claros en lugar de pantallas vacías. */
function GetStartedCard() {
  const steps = [
    { icon: '🗓️', title: 'Crea tu rutina', text: 'Elige tus días y ejercicios de la biblioteca.' },
    { icon: '🏋️', title: 'Entrena y apunta', text: 'Kilos y repeticiones, con descansos y récords.' },
    { icon: '📈', title: 'Mira cómo mejoras', text: 'Tu progreso semana a semana.' },
  ]
  return (
    <article className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffb347] via-[#ff8a4c] to-[#f0623c] p-5 text-[#1a120c]">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-70">Bienvenido a EvoFit</p>
      <h2 className="mt-1 font-display text-3xl font-bold leading-tight">Empieza en 1 minuto</h2>
      <ol className="mt-4 space-y-2.5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-center gap-3 rounded-2xl bg-white/25 px-3 py-2.5">
            <span className="text-2xl" aria-hidden>
              {step.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">
                {index + 1}. {step.title}
              </span>
              <span className="block text-sm opacity-80">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link to="/routines/new" className="mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#1a120c] text-lg font-bold text-white">
        Crear mi primera rutina →
      </Link>
    </article>
  )
}

/** La semana de un vistazo y la racha, en un solo bloque. */
function WeekCard({
  weekStart,
  todayKey,
  sessions,
  planned,
  highlights,
}: {
  weekStart: Date
  todayKey: string
  sessions: WorkoutSession[]
  planned: number
  highlights: TrainingHighlights | undefined
}) {
  const completed = sessions.filter((s) => s.completed_at).length
  const streak = highlights?.streak
  const streakText = !streak
    ? ''
    : streak.weeks === 0
      ? 'Entrena esta semana para empezar tu racha'
      : streak.this_week === 0
        ? '¡Entrena esta semana para no perder la racha!'
        : streak.best > streak.weeks
          ? `Tu mejor racha: ${streak.best} semanas`
          : '¡Es tu mejor racha!'

  return (
    <section aria-label="Tu semana" className="space-y-2">
      <SectionTitle
        action={
          <Link to="/calendar" className="text-sm font-bold text-evo-accent">
            Agenda
          </Link>
        }
      >
        Tu semana
      </SectionTitle>
      <div className="rounded-3xl border border-evo-border/60 bg-evo-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-bold tabular-nums">{completed}</span>
            <span className="font-display text-xl font-bold text-evo-muted">/ {planned || 0}</span>
            <span className="ml-1 text-sm font-semibold text-evo-muted">entrenos</span>
          </p>
          {streak ? (
            <span
              className={[
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold',
                streak.weeks > 0 ? 'bg-evo-accent/15 text-evo-accent' : 'bg-evo-surface-2 text-evo-muted',
              ].join(' ')}
            >
              <span aria-hidden>{streak.weeks > 0 ? '🔥' : '🌱'}</span>
              {streak.weeks} {streak.weeks === 1 ? 'semana' : 'semanas'}
            </span>
          ) : null}
        </div>

        <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Días de la semana">
          {WEEK_LETTERS.map((letter, index) => {
            const key = localDateKey(addDays(weekStart, index))
            const day = sessions.filter((s) => s.scheduled_date === key)
            const done = day.some((s) => s.completed_at)
            const pending = !done && day.length > 0
            const missed = pending && key < todayKey
            const isToday = key === todayKey
            const state = done ? 'hecho' : missed ? 'sin hacer' : pending ? 'planificado' : 'descanso'
            return (
              <li key={key} className="flex flex-col items-center gap-1.5" aria-label={`${letter}${isToday ? ' (hoy)' : ''}: ${state}`}>
                <span className={['text-xs font-bold', isToday ? 'text-evo-accent' : 'text-evo-muted'].join(' ')}>{letter}</span>
                <span
                  aria-hidden
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition',
                    done
                      ? 'bg-evo-lime text-[#102000]'
                      : missed
                        ? 'border-2 border-dashed border-evo-border text-evo-muted'
                        : pending
                          ? 'border-2 border-evo-accent text-evo-accent'
                          : 'bg-evo-surface-2',
                    isToday && !done ? 'ring-2 ring-evo-accent/40 ring-offset-2 ring-offset-evo-surface' : '',
                  ].join(' ')}
                >
                  {done ? '✓' : pending && !missed ? '•' : ''}
                </span>
              </li>
            )
          })}
        </ol>
        {streakText ? <p className="mt-3 text-center text-sm text-evo-muted">{streakText}</p> : null}
      </div>
    </section>
  )
}

/** Último récord y tendencia: dos fichas que llevan a Progreso. */
function ProgressTiles({ highlights, insight }: { highlights: TrainingHighlights | undefined; insight: ProgressInsight | undefined }) {
  const record = highlights?.last_record
  const mood = insight?.summary.mood
  const trend =
    mood === 'green'
      ? { icon: '📈', label: 'Subiendo', tone: 'text-evo-lime' }
      : mood === 'red'
        ? { icon: '📉', label: 'A ajustar', tone: 'text-evo-danger' }
        : { icon: '➡️', label: 'Estable', tone: 'text-evo-warn' }

  return (
    <section aria-label="Tu progreso" className="space-y-2">
      <SectionTitle
        action={
          <Link to="/progress" className="text-sm font-bold text-evo-accent">
            Ver todo
          </Link>
        }
      >
        Tu progreso
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Link
          to={record ? `/exercise-history/${record.routine_exercise_id}` : '/progress'}
          className="flex min-h-36 flex-col justify-between rounded-3xl border border-evo-border/60 bg-evo-surface p-4 transition active:scale-[0.98]"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">Último récord</p>
          {record ? (
            <div className="min-w-0">
              <p className="truncate font-bold">🏆 {record.exercise}</p>
              <p className="font-display text-2xl font-bold tabular-nums">{kg(record.weight_kg)}</p>
              <p className="text-xs text-evo-muted">
                <span className="font-bold text-evo-lime">+{kg(Math.round((record.weight_kg - record.previous_kg) * 100) / 100)}</span> ·{' '}
                {relativeDayLabel(record.date)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-evo-muted">Supera un peso y lo celebrarás aquí.</p>
          )}
        </Link>
        <Link to="/progress" className="flex min-h-36 flex-col justify-between rounded-3xl border border-evo-border/60 bg-evo-surface p-4 transition active:scale-[0.98]">
          <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">Tendencia</p>
          <div>
            <p className={['font-display text-2xl font-bold', trend.tone].join(' ')}>
              <span aria-hidden>{trend.icon}</span> {trend.label}
            </p>
            <p className="line-clamp-2 text-xs text-evo-muted">{insight?.summary.label ?? 'Apunta kilos para ver tu tendencia.'}</p>
          </div>
        </Link>
      </div>
    </section>
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
