import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { api, type Routine, type WorkoutSession } from '../lib/api'

const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const WEEKDAYS_MINI = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

type ViewMode = 'week' | 'month'

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek(base: Date) {
  const d = new Date(base)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function monthBounds(year: number, month: number) {
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 0)
  return {
    from: fmt(from),
    to: fmt(to),
    daysInMonth: to.getDate(),
    startWeekday: (from.getDay() + 6) % 7,
  }
}

function todayKey() {
  return fmt(new Date())
}

function formatHumanDate(iso: string) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  } catch {
    return iso
  }
}

function sessionStatus(session: WorkoutSession) {
  if (session.completed_at) return { label: 'Hecha', tone: 'lime' as const }
  if (session.is_planned) return { label: 'Pendiente', tone: 'accent' as const }
  return { label: 'En curso', tone: 'warn' as const }
}

export function CalendarPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const now = new Date()
  const [view, setView] = useState<ViewMode>('week')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now))
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey())
  const [swapSessionId, setSwapSessionId] = useState<number | null>(null)
  const [swapDayId, setSwapDayId] = useState<number | ''>('')

  const range = useMemo(() => {
    if (view === 'month') {
      return monthBounds(year, month)
    }
    const from = new Date(weekStart)
    const to = new Date(weekStart)
    to.setDate(from.getDate() + 6)
    return { from: fmt(from), to: fmt(to), daysInMonth: 7, startWeekday: 0 }
  }, [view, year, month, weekStart])

  const calendarQuery = useQuery({
    queryKey: ['calendar', range.from, range.to],
    queryFn: async () => {
      const { data } = await api.get<{ data: WorkoutSession[] }>('/workout-sessions/calendar', {
        params: { from: range.from, to: range.to },
      })
      return data.data
    },
  })

  const routinesQuery = useQuery({
    queryKey: ['routines'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Routine[] }>('/routines')
      return data.data
    },
  })

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>()
    for (const session of calendarQuery.data ?? []) {
      if (session.routine && session.routine.is_active === false) continue
      const list = map.get(session.scheduled_date) ?? []
      list.push(session)
      map.set(session.scheduled_date, list)
    }
    return map
  }, [calendarQuery.data])

  const activeRoutines = (routinesQuery.data ?? []).filter((r) => r.is_active)

  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!swapSessionId || !swapDayId) return
      await api.patch(`/workout-sessions/${swapSessionId}`, {
        routine_day_id: Number(swapDayId),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      setSwapSessionId(null)
      setSwapDayId('')
    },
  })

  function shift(delta: number) {
    if (view === 'month') {
      const date = new Date(year, month + delta, 1)
      setYear(date.getFullYear())
      setMonth(date.getMonth())
      return
    }
    const next = new Date(weekStart)
    next.setDate(weekStart.getDate() + delta * 7)
    setWeekStart(next)
  }

  function goToday() {
    const today = new Date()
    setSelectedDate(todayKey())
    setWeekStart(startOfWeek(today))
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const selectedSessions = selectedDate ? (sessionsByDate.get(selectedDate) ?? []) : []
  const completedCount = (calendarQuery.data ?? []).filter((s) => s.completed_at).length
  const plannedCount = (calendarQuery.data ?? []).length
  const today = todayKey()

  const weekLabel = useMemo(() => {
    const from = weekStart
    const to = new Date(weekStart)
    to.setDate(from.getDate() + 6)
    const sameMonth = from.getMonth() === to.getMonth()
    if (sameMonth) {
      return `${from.getDate()}–${to.getDate()} ${MONTHS[from.getMonth()]}`
    }
    return `${from.getDate()} ${MONTHS[from.getMonth()].slice(0, 3)} – ${to.getDate()} ${MONTHS[to.getMonth()].slice(0, 3)}`
  }, [weekStart])

  const title = view === 'month' ? `${MONTHS[month]} ${year}` : weekLabel

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + index)
      return { key: fmt(date), date, label: WEEKDAYS_SHORT[index] }
    })
  }, [weekStart])

  const monthCells = useMemo(() => {
    const bounds = monthBounds(year, month)
    const cells: Array<{ key: string; day: number | null; isToday: boolean }> = []
    for (let i = 0; i < bounds.startWeekday; i += 1) {
      cells.push({ key: `pad-${i}`, day: null, isToday: false })
    }
    for (let day = 1; day <= bounds.daysInMonth; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      cells.push({ key, day, isToday: key === today })
    }
    return cells
  }, [year, month, today])

  return (
    <div className="no-x-scroll space-y-4 lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:items-start lg:gap-5 lg:space-y-0">
      <section className="panel space-y-4 p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Agenda</h2>
            <p className="mt-0.5 text-sm text-evo-muted">
              {completedCount}/{plannedCount || 0} sesiones hechas esta {view === 'week' ? 'semana' : 'mes'}
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-evo-border bg-evo-surface-2 p-1">
            <button
              type="button"
              onClick={() => setView('week')}
              className={[
                'rounded-lg px-3.5 py-2 text-xs font-bold transition',
                view === 'week' ? 'bg-evo-accent text-[#111]' : 'text-evo-muted',
              ].join(' ')}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setView('month')}
              className={[
                'rounded-lg px-3.5 py-2 text-xs font-bold transition',
                view === 'month' ? 'bg-evo-accent text-[#111]' : 'text-evo-muted',
              ].join(' ')}
            >
              Mes
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => shift(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-evo-border bg-evo-surface-2 text-lg font-bold text-evo-text"
          >
            ←
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-display truncate text-base font-bold sm:text-lg">{title}</p>
            <button
              type="button"
              onClick={goToday}
              className="mt-0.5 text-xs font-bold text-evo-accent"
            >
              Ir a hoy
            </button>
          </div>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => shift(1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-evo-border bg-evo-surface-2 text-lg font-bold text-evo-text"
          >
            →
          </button>
        </div>

        <div className="flex flex-wrap gap-3 text-[0.7rem] font-semibold text-evo-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-evo-accent" /> Pendiente
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-evo-lime" /> Hecha
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-evo-border" /> Libre
          </span>
        </div>

        {activeRoutines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-evo-border p-4 text-sm text-evo-muted">
            No hay rutinas activas.{' '}
            <Link to="/routines" className="font-semibold text-evo-accent">
              Activa una
            </Link>{' '}
            para rellenar la agenda.
          </div>
        ) : null}

        {calendarQuery.isLoading ? (
          <p className="text-sm text-evo-muted">Cargando plan…</p>
        ) : view === 'week' ? (
          <ul className="space-y-2">
            {weekDays.map((item) => {
              const sessions = sessionsByDate.get(item.key) ?? []
              const selected = selectedDate === item.key
              const isToday = item.key === today
              const allDone = sessions.length > 0 && sessions.every((s) => s.completed_at)
              const hasPending = sessions.some((s) => !s.completed_at)

              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(item.key)
                      setSwapSessionId(null)
                    }}
                    className={[
                      'flex w-full items-stretch gap-3 rounded-2xl border-2 px-3 py-3 text-left transition',
                      selected
                        ? 'border-evo-accent bg-evo-accent/15'
                        : isToday
                          ? 'border-evo-lime/50 bg-evo-surface-2'
                          : 'border-evo-border bg-evo-surface-2/60',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'flex w-14 shrink-0 flex-col items-center justify-center rounded-xl px-1 py-1',
                        isToday ? 'bg-evo-lime text-[#102000]' : 'bg-evo-bg text-evo-text',
                      ].join(' ')}
                    >
                      <p className="text-[0.65rem] font-bold uppercase tracking-wide opacity-80">
                        {item.label}
                      </p>
                      <p className="font-display text-2xl font-bold leading-none">{item.date.getDate()}</p>
                      {isToday ? <p className="mt-0.5 text-[0.6rem] font-bold">HOY</p> : null}
                    </div>

                    <div className="min-w-0 flex-1 self-center">
                      {sessions.length === 0 ? (
                        <p className="text-sm font-medium text-evo-muted">Descanso · sin sesión</p>
                      ) : (
                        <div className="space-y-1.5">
                          {sessions.map((session) => {
                            const status = sessionStatus(session)
                            return (
                              <div key={session.id} className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold">
                                    {session.day?.name ?? 'Sesión'}
                                  </p>
                                  <p className="truncate text-xs text-evo-muted">
                                    {session.routine?.name}
                                  </p>
                                </div>
                                <span
                                  className={[
                                    'shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold',
                                    status.tone === 'lime'
                                      ? 'bg-evo-lime/20 text-evo-lime'
                                      : status.tone === 'warn'
                                        ? 'bg-evo-warn/20 text-evo-warn'
                                        : 'bg-evo-accent/20 text-evo-accent',
                                  ].join(' ')}
                                >
                                  {status.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {sessions.length > 0 ? (
                      <div
                        className={[
                          'w-1.5 shrink-0 rounded-full self-stretch',
                          allDone ? 'bg-evo-lime' : hasPending ? 'bg-evo-accent' : 'bg-evo-border',
                        ].join(' ')}
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] font-bold text-evo-muted">
              {WEEKDAYS_MINI.map((label) => (
                <div key={label} className="py-1">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {monthCells.map((cell) => {
                if (cell.day === null) return <div key={cell.key} className="aspect-square" />
                const sessions = sessionsByDate.get(cell.key) ?? []
                const completed = sessions.some((s) => s.completed_at)
                const pending = sessions.some((s) => !s.completed_at)
                const selected = selectedDate === cell.key
                return (
                  <button
                    key={cell.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedDate(cell.key)
                      setSwapSessionId(null)
                    }}
                    className={[
                      'relative flex aspect-square flex-col items-center justify-center rounded-2xl border text-sm transition',
                      selected ? 'border-evo-accent bg-evo-accent/20' : 'border-evo-border bg-evo-surface-2/70',
                      cell.isToday ? 'ring-2 ring-evo-lime/60' : '',
                    ].join(' ')}
                  >
                    <span className="font-semibold">{cell.day}</span>
                    {sessions[0]?.day?.name ? (
                      <span className="mt-0.5 max-w-full truncate px-0.5 text-[0.55rem] text-evo-muted">
                        {sessions[0].day.name}
                      </span>
                    ) : null}
                    {sessions.length > 0 ? (
                      <span
                        className={[
                          'absolute bottom-1.5 h-1.5 w-1.5 rounded-full',
                          completed && !pending ? 'bg-evo-lime' : pending ? 'bg-evo-accent' : 'bg-evo-muted',
                        ].join(' ')}
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </section>

      <section className="panel space-y-4 p-4 lg:sticky lg:top-24 lg:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-evo-accent">Detalle del día</p>
          <h3 className="mt-1 font-display text-xl font-bold capitalize">
            {selectedDate ? formatHumanDate(selectedDate) : 'Elige un día'}
          </h3>
          <p className="mt-1 text-sm text-evo-muted">
            Toca Abrir para entrenar. Si hiciste otro día del plan, cámbialo aquí.
          </p>
        </div>

        {selectedSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-evo-border bg-evo-surface-2/40 px-4 py-6 text-center">
            <p className="font-semibold">Día libre</p>
            <p className="mt-1 text-sm text-evo-muted">No hay sesión planificada.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {selectedSessions.map((session) => {
              const routineDays =
                activeRoutines.find((r) => r.id === session.routine_id)?.days ??
                session.routine?.days ??
                []
              const status = sessionStatus(session)
              return (
                <li key={session.id} className="rounded-2xl border border-evo-border bg-evo-surface-2 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-lg font-bold">{session.day?.name ?? 'Sesión'}</p>
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-[0.65rem] font-bold',
                            status.tone === 'lime'
                              ? 'bg-evo-lime/20 text-evo-lime'
                              : status.tone === 'warn'
                                ? 'bg-evo-warn/20 text-evo-warn'
                                : 'bg-evo-accent/20 text-evo-accent',
                          ].join(' ')}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-evo-muted">
                        {session.routine?.name}
                        {session.was_swapped ? ' · editada' : ''}
                      </p>
                    </div>
                    <Button
                      className="!min-h-10 shrink-0 !px-3 !text-xs"
                      onClick={() => navigate(`/workout/${session.id}`)}
                    >
                      {session.completed_at ? 'Ver' : 'Empezar'}
                    </Button>
                  </div>

                  {!session.completed_at && routineDays.length > 1 ? (
                    <div className="mt-3 space-y-2 border-t border-evo-border pt-3">
                      <p className="text-xs font-semibold text-evo-muted">¿Entrenaste otro día del plan?</p>
                      <select
                        className="w-full"
                        value={swapSessionId === session.id ? swapDayId : session.routine_day_id ?? ''}
                        onChange={(e) => {
                          setSwapSessionId(session.id)
                          setSwapDayId(e.target.value ? Number(e.target.value) : '')
                        }}
                      >
                        {routineDays.map((day) => (
                          <option key={day.id} value={day.id}>
                            {day.name}
                          </option>
                        ))}
                      </select>
                      {swapSessionId === session.id &&
                      swapDayId &&
                      Number(swapDayId) !== session.routine_day_id ? (
                        <Button
                          variant="secondary"
                          fullWidth
                          disabled={swapMutation.isPending}
                          onClick={() => swapMutation.mutate()}
                        >
                          Guardar cambio
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
