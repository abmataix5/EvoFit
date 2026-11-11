import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/icons/Icon'
import { catalogExercisesQuery, routinesQuery } from '../lib/queries'

/** Minúsculas y sin tildes: "press banca" encuentra "Press Banca" y "jalón" encuentra "jalon". */
function normalize(text: string | null | undefined) {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function ResultSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-evo-muted">{title}</h2>
      <ul className="overflow-hidden rounded-3xl border border-evo-border/60 bg-evo-surface">{children}</ul>
    </section>
  )
}

function ResultRow({ to, title, subtitle }: { to: string; title: string; subtitle?: string | null }) {
  return (
    <li className="border-b border-evo-border/40 last:border-b-0">
      <Link to={to} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition active:bg-evo-surface-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{title}</p>
          {subtitle ? <p className="truncate text-sm text-evo-muted">{subtitle}</p> : null}
        </div>
        <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
      </Link>
    </li>
  )
}

export function SearchPage() {
  // El texto vive en la URL: al volver atrás desde un resultado sigue la búsqueda.
  const [params, setParams] = useSearchParams()
  const text = params.get('q') ?? ''
  const term = normalize(useDeferredValue(text))

  const routines = useQuery(routinesQuery)
  const exercises = useQuery(catalogExercisesQuery)

  const results = useMemo(() => {
    if (!term) return null
    return {
      routines: (routines.data ?? []).filter((r) => normalize(`${r.name} ${r.description ?? ''}`).includes(term)).slice(0, 8),
      exercises: (exercises.data ?? [])
        .filter((e) => normalize(`${e.name} ${e.target_muscle ?? ''}`).includes(term))
        .slice(0, 12),
    }
  }, [term, routines.data, exercises.data])

  const loading = routines.isLoading || exercises.isLoading
  const empty = results && results.routines.length === 0 && results.exercises.length === 0

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <label className="relative block">
          <span className="sr-only">Buscar</span>
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-evo-muted" />
          <input
            type="search"
            autoFocus
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Rutinas, ejercicios, músculos…"
            value={text}
            onChange={(event) => setParams(event.target.value ? { q: event.target.value } : {}, { replace: true })}
            className="box-border w-full rounded-full border-2 border-evo-border bg-evo-surface-2 py-3.5 pl-12 pr-4 text-base text-evo-text placeholder:text-evo-muted/80 focus:border-evo-accent focus:outline-none focus:ring-4 focus:ring-evo-accent/25"
          />
        </label>
      </form>

      {!term ? (
        <div className="space-y-3">
          <div className="rounded-3xl border-2 border-dashed border-evo-border/70 p-5">
            <p className="font-bold">👥 Personas, muy pronto</p>
            <p className="mt-1 text-sm text-evo-muted">
              Podrás buscar a tus amigos por su @usuario, seguirles y ver sus entrenos.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/routines" className="rounded-2xl bg-evo-surface-2 px-4 py-3 font-bold transition active:scale-[0.98]">
              Mis rutinas
            </Link>
            <Link to="/exercises" className="rounded-2xl bg-evo-surface-2 px-4 py-3 font-bold transition active:scale-[0.98]">
              Catálogo
            </Link>
          </div>
        </div>
      ) : loading ? (
        <p className="px-1 text-sm text-evo-muted">Buscando…</p>
      ) : empty ? (
        <p className="px-1 text-center text-sm text-evo-muted">Nada que coincida con «{text.trim()}».</p>
      ) : (
        <div className="space-y-5">
          {results!.routines.length > 0 ? (
            <ResultSection title="Rutinas">
              {results!.routines.map((routine) => (
                <ResultRow
                  key={routine.id}
                  to={`/routines/${routine.id}`}
                  title={routine.name}
                  subtitle={`${routine.sessions_per_week} días/semana${routine.is_active ? '' : ' · archivada'}`}
                />
              ))}
            </ResultSection>
          ) : null}
          {results!.exercises.length > 0 ? (
            <ResultSection title="Ejercicios del catálogo">
              {results!.exercises.map((exercise) => (
                <ResultRow key={exercise.id} to="/exercises" title={exercise.name} subtitle={exercise.target_muscle} />
              ))}
            </ResultSection>
          ) : null}
        </div>
      )}
    </div>
  )
}
