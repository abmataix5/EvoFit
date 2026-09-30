import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { api, type Routine, type WorkoutSession } from '../lib/api'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
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

export function CalendarPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const now = new Date()
  const [view, setView] = useState<ViewMode>('month')
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

  const selectedSessions = selectedDate ? (sessionsByDate.get(selectedDate) ?? []) : []
  const completedCount = (calendarQuery.data ?? []).filter((s) => s.completed_at).length
  const plannedCount = (calendarQuery.data ?? []).length

  const title =
    view === 'month'
      ? `${MONTHS[month]} ${year}`
      : `${range.from.slice(5)} → ${range.to.slice(5)}`

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + index)
      return { key: fmt(date), date, label: WEEKDAYS[index] }
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
      cells.push({ key, day, isToday: key === todayKey() })
    }
    return cells
  }, [year, month])

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-[1.25fr_0.75fr] lg:items-start lg:gap-6 lg:space-y-0">
      <section className="panel space-y-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Calendario</h2>
            <p className="text-xs text-evo-muted">
              Autoplan de rutinas activas · {completedCount}/{plannedCount} hechas
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-evo-border bg-evo-bg/50 p-1">
            <button
              type="button"
              onClick={() => setView('week')}
              className={[
                'rounded-lg px-3 py-2 text-xs font-semibold',
                view === 'week' ? 'bg-evo-accent text-evo-bg' : 'text-evo-muted',
              ].join(' ')}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setView('month')}
              className={[
                'rounded-lg px-3 py-2 text-xs font-semibold',
                view === 'month' ? 'bg-evo-accent text-evo-bg' : 'text-evo-muted',
              ].join(' ')}
            >
              Mes
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => shift(-1)}
            className="min-h-11 min-w-11 rounded-xl border border-evo-border text-lg text-evo-muted"
          >
            ←
          </button>
          <p className="font-display text-lg font-bold">{title}</p>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => shift(1)}
            className="min-h-11 min-w-11 rounded-xl border border-evo-border text-lg text-evo-muted"
          >
            →
          </button>
        </div>

        {activeRoutines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-evo-border p-4 text-sm text-evo-muted">
            No hay rutinas activas.{' '}
            <Link to="/routines" className="font-semibold text-evo-accent">
              Activa una
            </Link>{' '}
            para rellenar el calendario.
          </div>
        ) : null}

        {calendarQuery.isLoading ? (
          <p className="text-sm text-evo-muted">Sincronizando plan…</p>
        ) : view === 'week' ? (
          <ul className="space-y-2">
            {weekDays.map((item) => {
              const sessions = sessionsByDate.get(item.key) ?? []
              const selected = selectedDate === item.key
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(item.key)
                      setSwapSessionId(null)
                    }}
                    className={[
                      'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition',
                      selected ? 'border-evo-accent bg-evo-accent/15' : 'border-evo-border bg-evo-bg/40',
                    ].join(' ')}
                  >
                    <div className="w-12 text-center">
                      <p className="text-xs font-semibold text-evo-muted">{item.label}</p>
                      <p className="font-display text-xl font-bold">{item.date.getDate()}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      {sessions.length === 0 ? (
                        <p className="text-sm text-evo-muted">Descanso / libre</p>
                      ) : (
                        <div className="space-y-1">
                          {sessions.map((session) => (
                            <p key={session.id} className="truncate text-sm font-semibold">
                              <span
                                className={[
                                  'mr-2 inline-block h-2 w-2 rounded-full',
                                  session.completed_at
                                    ? 'bg-evo-lime'
                                    : 'bg-evo-accent',
                                ].join(' ')}
                              />
                              {session.day?.name ?? 'Sesión'}
                              <span className="ml-1 text-xs font-normal text-evo-muted">
                                · {session.routine?.name}
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] font-semibold text-evo-muted">
              {WEEKDAYS.map((label) => (
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
                      selected ? 'border-evo-accent bg-evo-accent/20' : 'border-evo-border bg-evo-bg/40',
                      cell.isToday ? 'ring-2 ring-evo-lime/50' : '',
                    ].join(' ')}
                  >
                    <span className="font-semibold">{cell.day}</span>
                    {sessions[0]?.day?.name ? (
                      <span className="mt-0.5 max-w-full truncate px-0.5 text-[0.55rem] text-evo-muted">
                        {sessions[0].day.name}
                      </span>
                    ) : null}
                    {sessions.length > 1 ? (
                      <span className="absolute right-1 top-1 text-[0.55rem] text-evo-accent">
                        +{sessions.length - 1}
                      </span>
                    ) : null}
                    {sessions.length > 0 ? (
                      <span
                        className={[
                          'absolute bottom-1.5 h-1.5 w-1.5 rounded-full',
                          completed ? 'bg-evo-lime' : pending ? 'bg-evo-accent' : 'bg-evo-muted',
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

      <section className="panel space-y-4 p-4 lg:sticky lg:top-24 lg:p-6">
        <div>
          <h3 className="font-display text-xl font-bold">{selectedDate ?? 'Elige un día'}</h3>
          <p className="text-sm text-evo-muted">
            Si no seguiste el plan, cambia el día real. El historial de pesos se conserva.
          </p>
        </div>

        {selectedSessions.length === 0 ? (
          <p className="text-sm text-evo-muted">Nada planificado este día.</p>
        ) : (
          <ul className="space-y-3">
            {selectedSessions.map((session) => {
              const routineDays =
                activeRoutines.find((r) => r.id === session.routine_id)?.days ??
                session.routine?.days ??
                []
              return (
                <li key={session.id} className="rounded-2xl border border-evo-border bg-evo-bg/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{session.day?.name ?? 'Sesión'}</p>
                      <p className="text-xs text-evo-muted">
                        {session.routine?.name}
                        {session.completed_at
                          ? ' · Completada'
                          : session.is_planned
                            ? ' · Planificada'
                            : ' · En curso'}
                        {session.was_swapped ? ' · editada' : ''}
                      </p>
                    </div>
                    <Button
                      className="!min-h-10 !px-3 !text-xs"
                      onClick={() => navigate(`/workout/${session.id}`)}
                    >
                      Abrir
                    </Button>
                  </div>

                  {routineDays.length > 0 ? (
                    <div className="mt-3 space-y-2 border-t border-evo-border pt-3">
                      <p className="text-xs font-medium text-evo-muted">¿Qué entrenaste realmente?</p>
                      <select
                        className="w-full rounded-xl border border-evo-border bg-evo-surface px-3 py-2.5 text-sm"
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
                          Guardar cambio real
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
