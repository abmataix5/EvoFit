import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { haptic } from '../../lib/haptics'
import { primeRestSound } from './RestTimer'
import { relativeDayLabel } from '../../lib/dates'
import { bestScoreLabel, formatDuration, formatScore, isTimeMode, joinDuration, splitDuration } from '../../lib/tracking'
import {
  formatKg,
  isRecordSet,
  MAX_SETS,
  newSetDraft,
  previousSetFor,
  progressionSuggestion,
  setLogged,
  type ExerciseGroup,
  type SetDraft,
} from './model'

type Props = {
  group: ExerciseGroup
  index: number
  open: boolean
  onToggle: () => void
  onNext: (() => void) | null
  updateDraft: (index: number, patch: Partial<SetDraft>) => void
  updateMany: (patches: Array<{ index: number; patch: Partial<SetDraft> }>) => void
  addSet: (draft: SetDraft) => void
  removeSet: (exerciseId: number, setNumber: number) => void
  onSetDone: (group: ExerciseGroup) => void
  /** La serie recién marcada supera el récord de siempre. */
  onRecord?: (group: ExerciseGroup, draft: SetDraft) => void
  /** Cambiar este ejercicio por otro solo para hoy. */
  onReplace?: (group: ExerciseGroup) => void
  /** Quitar un ejercicio cambiado o añadido hoy (vuelve el original si lo había). */
  onRemoveExtra?: (group: ExerciseGroup) => void
  /** Ver foto y claves de técnica (solo ejercicios de la biblioteca). */
  onShowTechnique?: (slug: string) => void
}

const cellInput =
  'h-12 w-full min-w-0 rounded-xl border-2 border-evo-border bg-evo-bg/60 px-1 text-center text-lg font-bold tabular-nums text-evo-text placeholder:font-semibold placeholder:text-evo-muted/55 focus:border-evo-accent focus:outline-none focus:ring-2 focus:ring-evo-accent/30'

function lastLine(group: ExerciseGroup) {
  const previous = group.previous
  if (!previous) return null
  return `${relativeDayLabel(previous.recorded_on)} · ${formatScore({
    mode: group.mode,
    weight: previous.best_weight_kg,
    reps: previous.best_reps,
    duration: previous.best_duration_seconds,
  })}`
}

/** Valores que se proponen en gris: la misma serie de la última vez o, si no hay, las reps objetivo. */
function placeholdersFor(group: ExerciseGroup, setNumber: number) {
  const prev = previousSetFor(group.previous, setNumber)
  const duration = splitDuration(prev?.duration_seconds ?? group.goalSeconds)
  return {
    weight_kg: prev?.weight_kg != null ? String(prev.weight_kg) : '',
    reps: prev?.reps != null ? String(prev.reps) : group.defaultReps > 0 ? String(group.defaultReps) : '',
    minutes: duration.minutes,
    seconds: duration.seconds === '' ? '' : duration.seconds.padStart(2, '0'),
  }
}

/** Completa con lo propuesto los huecos vacíos de una serie. */
function fillBlanks(group: ExerciseGroup, set: SetDraft): Partial<SetDraft> {
  const ph = placeholdersFor(group, set.set_number)
  const patch: Partial<SetDraft> = {}
  if (group.mode !== 'time' && set.weight_kg.trim() === '' && ph.weight_kg) patch.weight_kg = ph.weight_kg
  if (group.mode === 'weight_reps' && set.reps.trim() === '' && ph.reps) patch.reps = ph.reps
  if (isTimeMode(group.mode) && set.minutes.trim() === '' && set.seconds.trim() === '') {
    patch.minutes = ph.minutes
    patch.seconds = ph.seconds
  }
  return patch
}

export function ExerciseCard({
  group,
  index,
  open,
  onToggle,
  onNext,
  updateDraft,
  updateMany,
  addSet,
  removeSet,
  onSetDone,
  onRecord,
  onReplace,
  onRemoveExtra,
  onShowTechnique,
}: Props) {
  const [detailsFor, setDetailsFor] = useState<number | null>(null)
  const { confirm } = useUiFeedback()
  const doneSets = group.sets.filter((set) => set.done && setLogged(set, group.mode)).length
  const allDone = group.sets.length > 0 && doneSets === group.sets.length
  const previous = group.previous
  const suggestion = progressionSuggestion(group)
  const timed = isTimeMode(group.mode)
  const showPrevColumn = group.mode !== 'weight_time'
  const last = lastLine(group)

  const columns =
    group.mode === 'weight_reps'
      ? 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_4rem_3rem]'
      : group.mode === 'time'
        ? 'grid-cols-[2.25rem_minmax(0,1fr)_3.75rem_3.75rem_3rem]'
        : 'grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_3.5rem_3rem]'

  function toggleDone(set: SetDraft & { draftIndex: number }) {
    if (set.done) {
      updateDraft(set.draftIndex, { done: false })
      return
    }
    const patch = { ...fillBlanks(group, set), done: true }
    const merged = { ...set, ...patch }
    if (!setLogged(merged, group.mode)) {
      // Sin dato no se puede dar por hecha: se lleva el foco al campo que falta (el tiempo, si va por tiempo).
      const missing = group.mode === 'weight_time' ? 'time' : 'main'
      document.getElementById(`set-${group.id}-${set.set_number}-${missing}`)?.focus()
      return
    }
    // Dentro del toque: activa el sonido del descanso (el iPhone lo exige) y confirma con una vibración.
    primeRestSound()
    haptic()
    updateDraft(set.draftIndex, patch)
    onSetDone(group)
    if (onRecord && isRecordSet(group, merged)) onRecord(group, merged)
  }

  /** Quitar la última serie; si ya tiene datos se pregunta antes (está pegada a "Añadir serie"). */
  async function removeLastSet() {
    const target = group.sets[group.sets.length - 1]
    if (!target) return
    if (setLogged(target, group.mode)) {
      const ok = await confirm({
        title: `¿Quitar la serie ${target.set_number}?`,
        message: 'Tiene datos apuntados y se borrarán.',
        confirmLabel: 'Quitar serie',
        cancelLabel: 'Cancelar',
        danger: true,
      })
      if (!ok) return
    }
    removeSet(group.id, target.set_number)
  }

  function repeatLastTime() {
    if (!previous) return
    updateMany(
      group.sets
        .filter((set) => !set.done)
        .map((set) => {
          const prev = previousSetFor(previous, set.set_number)
          const duration = splitDuration(prev?.duration_seconds)
          return {
            index: set.draftIndex,
            patch: {
              weight_kg: prev?.weight_kg != null ? String(prev.weight_kg) : set.weight_kg,
              reps: prev?.reps != null ? String(prev.reps) : set.reps,
              minutes: prev?.duration_seconds != null ? duration.minutes : set.minutes,
              seconds: prev?.duration_seconds != null ? duration.seconds : set.seconds,
            },
          }
        }),
    )
  }

  function applySuggestion() {
    if (!suggestion) return
    updateMany(
      group.sets
        .filter((set) => !set.done)
        .map((set) => ({
          index: set.draftIndex,
          patch: { weight_kg: String(suggestion.weight), reps: set.reps || String(suggestion.reps) },
        })),
    )
  }

  function addOneSet() {
    const lastSet = group.sets[group.sets.length - 1]
    const nextNumber = (lastSet?.set_number ?? 0) + 1
    if (nextNumber > MAX_SETS) return
    addSet(newSetDraft(group.exercise, nextNumber))
  }


  return (
    <li id={`exercise-${group.id}`} className="panel scroll-mt-24 overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`exercise-body-${group.id}`}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-evo-surface-2/40"
      >
        <span
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
            allDone ? 'bg-evo-lime text-[#102000]' : 'bg-evo-accent/20 text-evo-accent',
          ].join(' ')}
          aria-hidden
        >
          {allDone ? '✓' : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-display text-lg font-bold">{group.name}</span>
            {group.exercise.session_only ? (
              <span className="shrink-0 rounded-full bg-evo-warn/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-evo-warn">
                {group.exercise.replaces_routine_exercise_id ? 'Cambio' : 'Extra'}
              </span>
            ) : null}
          </span>
          {last ? (
            <span className="mt-0.5 block text-sm font-semibold text-evo-accent">Última {last}</span>
          ) : (
            <span className="mt-0.5 block text-sm text-evo-muted">Primera vez · apunta tu marca</span>
          )}
          <span className="block text-xs text-evo-muted">
            {doneSets}/{group.sets.length} series hechas
            {group.rest ? ` · descanso ${formatDuration(group.rest)}` : ''}
          </span>
        </span>
        <span className="text-evo-muted" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div id={`exercise-body-${group.id}`} className="space-y-3 border-t border-evo-border bg-evo-bg/30 px-3 py-3">
          {onReplace || onShowTechnique || (group.exercise.session_only && onRemoveExtra) ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {onShowTechnique && group.exercise.library_slug ? (
                <button type="button" onClick={() => onShowTechnique(group.exercise.library_slug!)} className={smallAction}>
                  ⓘ Técnica
                </button>
              ) : null}
              {onReplace ? (
                <button type="button" onClick={() => onReplace(group)} className={smallAction}>
                  ⇄ Cambiar
                </button>
              ) : null}
              {group.exercise.session_only && onRemoveExtra ? (
                <button type="button" onClick={() => onRemoveExtra(group)} className={smallAction}>
                  {group.exercise.replaces_routine_exercise_id ? '↺ Deshacer cambio' : '✕ Quitar de hoy'}
                </button>
              ) : null}

            </div>
          ) : null}
          {timed ? (
            <p className="px-1 text-sm text-evo-muted">
              {group.direction === 'longer' ? 'Más tiempo es mejor.' : 'Menos tiempo es mejor.'}
              {group.goalSeconds ? ` Objetivo ${formatDuration(group.goalSeconds)}.` : ''}
            </p>
          ) : null}

          {previous ? (
            <div className="rounded-2xl bg-evo-surface px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-evo-muted">
                    Última vez · {relativeDayLabel(previous.recorded_on)}
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {bestScoreLabel(group.mode, group.direction)}{' '}
                    {formatScore({
                      mode: group.mode,
                      weight: previous.best_weight_kg,
                      reps: previous.best_reps,
                      duration: previous.best_duration_seconds,
                    })}
                  </p>
                  <RecordLine group={group} />
                </div>
                <Link
                  to={`/exercise-history/${group.id}`}
                  className="shrink-0 rounded-xl bg-evo-surface-2 px-3 py-2.5 text-sm font-bold text-evo-text"
                >
                  Historial
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionChip onClick={repeatLastTime}>↺ Repetir última vez</ActionChip>
                {suggestion?.kind === 'up' ? (
                  <ActionChip onClick={applySuggestion} highlight>
                    ↑ Subir a {formatKg(suggestion.weight)}
                  </ActionChip>
                ) : null}
              </div>
              {suggestion?.kind === 'up' ? (
                <p className="mt-2 text-xs text-evo-muted">
                  La última vez completaste todas las reps con {formatKg(previous.best_weight_kg)}: toca subir.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-evo-surface px-3 py-3">
              <p className="text-sm text-evo-muted">Aún no hay marcas de este ejercicio.</p>
              <Link
                to={`/exercise-history/${group.id}`}
                className="shrink-0 rounded-xl bg-evo-surface-2 px-3 py-2.5 text-sm font-bold"
              >
                Historial
              </Link>
            </div>
          )}

          <div role="table" aria-label={`Series de ${group.name}`} className="space-y-2">
            <div role="row" className={`grid ${columns} items-end gap-1.5 px-1 text-[0.7rem] font-bold uppercase tracking-wide text-evo-muted`}>
              <span role="columnheader">Serie</span>
              <span role="columnheader" className={showPrevColumn ? '' : 'text-center'}>{showPrevColumn ? 'Anterior' : 'Kg'}</span>
              {group.mode === 'weight_reps' ? (
                <>
                  <span role="columnheader" className="text-center">Kg</span>
                  <span role="columnheader" className="text-center">Reps</span>
                </>
              ) : group.mode === 'time' ? (
                <>
                  <span role="columnheader" className="text-center">Min</span>
                  <span role="columnheader" className="text-center">Seg</span>
                </>
              ) : (
                <>
                  <span role="columnheader" className="text-center">Min</span>
                  <span role="columnheader" className="text-center">Seg</span>
                </>
              )}
              <span role="columnheader" className="text-center">Hecha</span>
            </div>

            {group.sets.map((set) => {
              const prev = previousSetFor(previous, set.set_number)
              const ph = placeholdersFor(group, set.set_number)
              const record = isRecordSet(group, set)
              const detailsOpen = detailsFor === set.set_number
              const hasDetails = set.rpe.trim() !== '' || set.notes.trim() !== ''
              return (
                <div
                  key={`${group.id}-${set.set_number}`}
                  role="row"
                  className={[
                    'rounded-2xl border-2 p-1.5 transition-colors',
                    set.done ? 'border-evo-lime/60 bg-evo-lime/10' : 'border-transparent bg-evo-surface-2',
                  ].join(' ')}
                >
                  <div className={`grid ${columns} items-center gap-1.5`}>
                    <button
                      type="button"
                      role="cell"
                      aria-expanded={detailsOpen}
                      aria-label={`Serie ${set.set_number}: RPE y notas`}
                      onClick={() => setDetailsFor(detailsOpen ? null : set.set_number)}
                      className="relative flex h-12 items-center justify-center rounded-xl bg-evo-bg/50 font-display text-base font-bold text-evo-accent"
                    >
                      {set.set_number}
                      {hasDetails ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-evo-warn" aria-hidden /> : null}
                    </button>

                    <span role="cell" className="min-w-0 truncate text-sm font-semibold text-evo-muted">
                      {showPrevColumn && prev ? (
                        <button
                          type="button"
                          className="w-full truncate rounded-lg px-1 py-2 text-left hover:bg-evo-bg/40"
                          title="Copiar a esta serie"
                          onClick={() => {
                            const duration = splitDuration(prev.duration_seconds)
                            updateDraft(set.draftIndex, {
                              weight_kg: prev.weight_kg != null ? String(prev.weight_kg) : set.weight_kg,
                              reps: prev.reps != null ? String(prev.reps) : set.reps,
                              minutes: prev.duration_seconds != null ? duration.minutes : set.minutes,
                              seconds: prev.duration_seconds != null ? duration.seconds : set.seconds,
                            })
                          }}
                        >
                          {formatScore({ mode: group.mode, weight: prev.weight_kg, reps: prev.reps, duration: prev.duration_seconds })}
                        </button>
                      ) : showPrevColumn ? (
                        <span className="px-1">—</span>
                      ) : (
                        <span className="block">
                          <input
                            id={`set-${group.id}-${set.set_number}-main`}
                            aria-label={`Kg serie ${set.set_number}`}
                            inputMode="decimal"
                            enterKeyHint="next"
                            className={cellInput}
                            value={set.weight_kg}
                            placeholder={ph.weight_kg ? `${ph.weight_kg} kg` : 'kg'}
                            onChange={(e) => updateDraft(set.draftIndex, { weight_kg: e.target.value })}
                          />
                        </span>
                      )}
                    </span>

                    {group.mode === 'weight_reps' ? (
                      <>
                        <input
                          id={`set-${group.id}-${set.set_number}-main`}
                          role="cell"
                          aria-label={`Kg serie ${set.set_number}`}
                          inputMode="decimal"
                          enterKeyHint="next"
                          className={cellInput}
                          value={set.weight_kg}
                          placeholder={ph.weight_kg || 'kg'}
                          onChange={(e) => updateDraft(set.draftIndex, { weight_kg: e.target.value })}
                        />
                        <input
                          role="cell"
                          aria-label={`Reps serie ${set.set_number}`}
                          inputMode="numeric"
                          enterKeyHint="done"
                          className={cellInput}
                          value={set.reps}
                          placeholder={ph.reps || 'reps'}
                          onChange={(e) => updateDraft(set.draftIndex, { reps: e.target.value })}
                        />
                      </>
                    ) : (
                      <>
                        <input
                          id={`set-${group.id}-${set.set_number}-${group.mode === 'time' ? 'main' : 'time'}`}
                          role="cell"
                          aria-label={`Minutos serie ${set.set_number}`}
                          inputMode="numeric"
                          className={cellInput}
                          value={set.minutes}
                          placeholder={ph.minutes || '0'}
                          onChange={(e) => updateDraft(set.draftIndex, { minutes: e.target.value })}
                        />
                        <input
                          role="cell"
                          aria-label={`Segundos serie ${set.set_number}`}
                          inputMode="numeric"
                          className={cellInput}
                          value={set.seconds}
                          placeholder={ph.seconds || '00'}
                          onChange={(e) => updateDraft(set.draftIndex, { seconds: e.target.value })}
                          onBlur={() => {
                            const total = joinDuration(set.minutes, set.seconds)
                            if (total == null) return
                            updateDraft(set.draftIndex, splitDuration(total))
                          }}
                        />
                      </>
                    )}

                    <button
                      type="button"
                      role="cell"
                      aria-pressed={set.done}
                      aria-label={set.done ? `Desmarcar serie ${set.set_number}` : `Marcar serie ${set.set_number} como hecha`}
                      onClick={() => toggleDone(set)}
                      className={[
                        'flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold transition active:scale-95',
                        set.done ? 'bg-evo-lime text-[#102000]' : 'border-2 border-evo-border bg-evo-bg/50 text-evo-muted',
                      ].join(' ')}
                    >
                      ✓
                    </button>
                  </div>

                  {record ? (
                    <p className="evo-pop mt-1.5 inline-flex items-center gap-1 rounded-full bg-evo-warn/15 px-2.5 py-1 text-xs font-bold text-evo-warn">
                      <span aria-hidden>🏆</span> ¡Nuevo récord personal!
                    </p>
                  ) : null}

                  {detailsOpen ? (
                    <div className="mt-2 grid grid-cols-[5rem_minmax(0,1fr)] gap-2 px-1 pb-1">
                      <label className="block text-xs font-bold text-evo-muted">
                        RPE
                        <input
                          inputMode="decimal"
                          className={`${cellInput} mt-1 text-base`}
                          placeholder="1-10"
                          value={set.rpe}
                          onChange={(e) => updateDraft(set.draftIndex, { rpe: e.target.value })}
                        />
                      </label>
                      <label className="block text-xs font-bold text-evo-muted">
                        Nota
                        <input
                          className={`${cellInput} mt-1 px-3 text-left text-base font-medium`}
                          placeholder="Ej: buena técnica, molestia hombro…"
                          maxLength={255}
                          value={set.notes}
                          onChange={(e) => updateDraft(set.draftIndex, { notes: e.target.value })}
                        />
                      </label>
                      <p className="col-span-2 text-xs text-evo-muted">
                        RPE: esfuerzo de 1 a 10 (10 = no podías ni una más).
                      </p>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="min-h-12 rounded-2xl border-2 border-dashed border-evo-border text-sm font-bold text-evo-text disabled:opacity-40"
              onClick={addOneSet}
              disabled={group.sets.length >= MAX_SETS}
            >
              + Añadir serie
            </button>
            <button
              type="button"
              className="min-h-12 rounded-2xl border-2 border-dashed border-evo-border text-sm font-bold text-evo-muted disabled:opacity-40"
              onClick={() => void removeLastSet()}
              disabled={group.sets.length <= 1}
            >
              − Quitar última
            </button>
          </div>

          {onNext ? (
            <button
              type="button"
              className="min-h-12 w-full rounded-2xl bg-evo-surface-2 text-base font-bold text-evo-text"
              onClick={onNext}
            >
              Siguiente ejercicio →
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

const smallAction =
  'min-h-10 rounded-full border border-evo-border bg-evo-surface px-3.5 text-sm font-bold text-evo-text transition active:scale-95'

function ActionChip({ children, onClick, highlight }: { children: ReactNode; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-h-11 rounded-full px-4 text-sm font-bold transition active:scale-95',
        highlight ? 'bg-evo-lime text-[#102000]' : 'bg-evo-surface-2 text-evo-text',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function RecordLine({ group }: { group: ExerciseGroup }) {
  const previous = group.previous
  if (!previous) return null
  if (isTimeMode(group.mode)) {
    if (previous.record_duration_seconds == null) return null
    return <p className="text-xs font-semibold text-evo-muted">Récord: {formatDuration(previous.record_duration_seconds)}</p>
  }
  if (previous.record_weight_kg == null) return null
  return (
    <p className="text-xs font-semibold text-evo-muted">
      Récord: {formatKg(previous.record_weight_kg)}
      {previous.record_reps ? ` × ${previous.record_reps}` : ''}
      {previous.record_est_1rm ? ` · 1RM est. ${formatKg(previous.record_est_1rm)}` : ''}
    </p>
  )
}
