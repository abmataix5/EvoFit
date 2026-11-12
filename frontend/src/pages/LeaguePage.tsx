import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../components/feedback/LoadError'
import { Icon } from '../components/icons/Icon'
import { ButtonLink } from '../components/ui/Button'
import { Segmented } from '../components/ui/Segmented'
import { Avatar } from '../features/profile/Avatar'
import { formatShortDate } from '../lib/dates'
import { formatScore, leagueHistoryQuery, leagueQuery, METRICS, rank, readMetric, scoreDetail, storeMetric, type LeagueMetric, type LeagueWeek, type RankedEntry } from '../lib/league'
import { handle } from '../lib/social'

const MEDALS = ['bg-evo-warn text-[#1a120c]', 'bg-[#cfd8e3] text-[#1a120c]', 'bg-[#e0a070] text-[#1a120c]']

function Row({ entry, metric, top }: { entry: RankedEntry; metric: LeagueMetric; top: number }) {
  const medal = entry.position != null && entry.position <= 3 ? MEDALS[entry.position - 1] : null
  // Barra proporcional a quien va primero: se ve de un vistazo lo cerca o lejos que estás.
  const share = top > 0 ? Math.max(entry.score > 0 ? 0.06 : 0, entry.score / top) : 0

  return (
    <li>
      <Link
        to={entry.me ? '/profile' : `/u/${entry.user.id}`}
        aria-label={`${entry.position != null ? `Puesto ${entry.position}` : 'Sin puesto'}: ${entry.me ? 'tú' : handle(entry.user)}, ${formatScore(entry, metric)}`}
        className={[
          'relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 transition active:scale-[0.98]',
          entry.me ? 'border-evo-accent bg-evo-accent/10' : 'border-evo-border/50 bg-evo-surface',
        ].join(' ')}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-evo-accent/10 transition-[width] duration-700 ease-(--ease-evo)"
          style={{ width: `${share * 100}%` }}
        />
        <span
          aria-hidden
          className={[
            'evo-shape relative flex h-9 w-9 shrink-0 items-center justify-center font-display text-xl font-extrabold',
            medal ?? 'bg-evo-surface-2 text-evo-muted',
          ].join(' ')}
        >
          {entry.position ?? '–'}
        </span>
        <Avatar name={entry.user.name} url={entry.user.avatar_url} size="sm" className="relative" />
        <span className="relative min-w-0 flex-1">
          <span className="block truncate font-bold">
            {handle(entry.user)}
            {entry.me ? <span className="ml-1.5 rounded-full bg-evo-accent px-1.5 py-0.5 text-[0.65rem] font-extrabold uppercase text-[#1a120c]">Tú</span> : null}
          </span>
          <span className="block truncate text-xs text-evo-muted">{scoreDetail(entry, metric)}</span>
        </span>
        <span className="relative shrink-0 font-display text-2xl font-extrabold tabular-nums">{formatScore(entry, metric)}</span>
      </Link>
    </li>
  )
}

/** Una semana ya cerrada: cómo quedaste en la modalidad elegida. */
function PastWeek({ week, metric }: { week: LeagueWeek; metric: LeagueMetric }) {
  const position = week.positions[metric]
  const alone = week.participants <= 1
  const medal = !alone && position != null && position <= 3 ? MEDALS[position - 1] : null
  const result = alone
    ? 'Sin rivales esa semana'
    : position == null
      ? 'No puntuaste'
      : position === 1
        ? '¡Ganaste!'
        : `${position}.º de ${week.participants}`

  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <span
        aria-hidden
        className={['evo-shape flex h-9 w-9 shrink-0 items-center justify-center font-display text-xl font-extrabold', medal ?? 'bg-evo-surface-2 text-evo-muted'].join(' ')}
      >
        {!alone && position != null ? position : '–'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{result}</span>
        <span className="block truncate text-xs text-evo-muted">
          Del {formatShortDate(week.week_start)} al {formatShortDate(week.week_end)}
        </span>
      </span>
      <span className="shrink-0 font-display text-xl font-bold tabular-nums text-evo-muted">{formatScore(week, metric)}</span>
    </li>
  )
}

/** Liga semanal: tú y tus amigos, ordenados por días entrenados, kilos movidos o récords. */
export function LeaguePage() {
  const [metric, setMetric] = useState<LeagueMetric>(readMetric)
  const [weeksAgo, setWeeksAgo] = useState<0 | 1>(0)
  const league = useQuery(leagueQuery(weeksAgo))
  const history = useQuery(leagueHistoryQuery)
  // Semanas con rivales: una semana sin amigos no cuenta ni como ganada ni como perdida.
  const played = (history.data?.weeks ?? []).filter((item) => item.participants > 1)
  const won = played.filter((item) => item.positions[metric] === 1).length

  function chooseMetric(next: LeagueMetric) {
    setMetric(next)
    storeMetric(next)
  }

  const ranked = league.data ? rank(league.data.entries, metric) : []
  const me = ranked.find((entry) => entry.me)
  const leader = ranked[0]
  const alone = league.data ? league.data.entries.length <= 1 : false
  const week = league.data?.week

  let headline = ''
  if (league.data && me && leader) {
    if (alone) headline = 'Añade amigos para competir'
    else if (leader.score === 0) headline = week?.current ? 'Nadie ha puntuado todavía. ¡Sé el primero!' : 'Nadie puntuó esa semana'
    else if (me.position === 1) headline = week?.current ? '¡Vas en cabeza!' : '¡Ganaste la semana!'
    else if (me.position != null) headline = week?.current ? `Vas ${me.position}.º de ${ranked.length}` : `Quedaste ${me.position}.º de ${ranked.length}`
    else headline = week?.current ? 'Entrena para entrar en la clasificación' : 'No puntuaste esa semana'
  }

  return (
    <div className="evo-stagger mx-auto max-w-2xl space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffb347] via-[#ff7a36] to-[#ee5a2c] p-5 text-[#1a120c]">
        <span className="evo-stripes pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative">
          <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">
            <Icon name="trophy" className="h-4 w-4" />
            {week ? `Del ${formatShortDate(week.from)} al ${formatShortDate(week.to)}` : 'Liga semanal'}
          </p>
          <h2 className="mt-1 min-h-[2.4rem] font-display text-4xl font-extrabold uppercase leading-none [text-wrap:balance]" aria-live="polite">
            {headline}
          </h2>
          <p className="mt-2 text-sm font-bold opacity-80">
            {week?.current
              ? week.days_left === 1
                ? 'Último día: se cierra esta noche.'
                : `Quedan ${week.days_left} días. Se reinicia el lunes.`
              : 'Semana cerrada.'}
          </p>
        </div>
      </section>

      <Segmented label="Clasificar por" value={metric} onChange={chooseMetric} options={METRICS} />

      <Segmented
        label="Semana"
        value={weeksAgo === 0 ? 'current' : 'previous'}
        onChange={(id) => setWeeksAgo(id === 'current' ? 0 : 1)}
        options={[
          { id: 'current', label: 'Esta semana' },
          { id: 'previous', label: 'Semana pasada' },
        ]}
      />

      {league.isError && !league.data ? (
        <LoadError onRetry={() => void league.refetch()} />
      ) : !league.data ? (
        <div className="space-y-2" role="status" aria-label="Cargando clasificación">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="evo-skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <ol className="space-y-2" aria-label="Clasificación">
            {ranked.map((entry) => (
              <Row key={entry.user.id} entry={entry} metric={metric} top={leader?.score ?? 0} />
            ))}
          </ol>

          {alone ? (
            <div className="space-y-3 rounded-3xl border-2 border-dashed border-evo-border p-6 text-center">
              <p className="font-display text-2xl font-bold">La liga es mejor con amigos</p>
              <p className="text-sm text-evo-muted">Añade a la gente con la que entrenas y cada semana veréis quién va primero.</p>
              <ButtonLink to="/search">Buscar amigos</ButtonLink>
            </div>
          ) : null}

          <p className="px-1 text-center text-xs text-evo-muted">
            {metric === 'days'
              ? 'Gana quien entrena más días; a igualdad, quien hace más series.'
              : metric === 'volume'
                ? 'Kilos movidos: peso × repeticiones de todas tus series.'
                : 'Récords: ejercicios en los que superas tu mejor peso anterior.'}{' '}
            Participan los amigos que comparten su actividad contigo.
          </p>
        </>
      )}

      {played.length > 0 ? (
        <section aria-label="Semanas anteriores" className="space-y-2">
          <div className="flex min-h-9 items-center justify-between gap-3 px-1">
            <h2 className="evo-kicker">Semanas anteriores</h2>
            <p className="flex items-center gap-1 text-sm font-bold text-evo-accent">
              <Icon name="trophy" className="h-4 w-4" />
              {won} {won === 1 ? 'ganada' : 'ganadas'} de {played.length}
            </p>
          </div>
          <ul className="divide-y divide-evo-border/40 overflow-hidden rounded-3xl border border-evo-border/60 bg-evo-surface">
            {played.map((item) => (
              <PastWeek key={item.week_start} week={item} metric={metric} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
