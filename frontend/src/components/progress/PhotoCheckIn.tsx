import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { ProgressPhoto } from '../../lib/api'

function formatShortDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function formatLongDate(iso: string) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function daysBetween(a: string, b: string) {
  const ms = Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime())
  return Math.round(ms / 86_400_000)
}

type Props = {
  photos: ProgressPhoto[]
  recordedOn: string
  caption: string
  photoFile: File | null
  uploading: boolean
  onRecordedOn: (value: string) => void
  onCaption: (value: string) => void
  onPhotoFile: (file: File | null) => void
  onUpload: () => void
}

export function PhotoCheckIn({
  photos,
  recordedOn,
  caption,
  photoFile,
  uploading,
  onRecordedOn,
  onCaption,
  onPhotoFile,
  onUpload,
}: Props) {
  const [mode, setMode] = useState<'gallery' | 'compare'>('gallery')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [leftId, setLeftId] = useState<number | null>(null)
  const [rightId, setRightId] = useState<number | null>(null)
  const [slider, setSlider] = useState(50)
  const [picking, setPicking] = useState<'left' | 'right' | null>(null)

  useEffect(() => {
    if (photos.length < 2) return
    const sorted = [...photos].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on))
    setLeftId((current) => current ?? sorted[0]!.id)
    setRightId((current) => current ?? sorted[sorted.length - 1]!.id)
  }, [photos])

  const left = photos.find((p) => p.id === leftId) ?? null
  const right = photos.find((p) => p.id === rightId) ?? null
  const gapDays = left && right ? daysBetween(left.recorded_on, right.recorded_on) : null

  function handleThumbClick(photo: ProgressPhoto, index: number) {
    if (mode === 'compare' && picking) {
      if (picking === 'left') {
        setLeftId(photo.id)
        if (photo.id === rightId) {
          const other = photos.find((p) => p.id !== photo.id)
          if (other) setRightId(other.id)
        }
      } else {
        setRightId(photo.id)
        if (photo.id === leftId) {
          const other = photos.find((p) => p.id !== photo.id)
          if (other) setLeftId(other.id)
        }
      }
      setPicking(null)
      return
    }
    if (mode === 'gallery') setLightboxIndex(index)
  }

  function startCompareFrom(photoId: number) {
    const sorted = [...photos].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on))
    if (sorted.length < 2) return
    const current = sorted.find((p) => p.id === photoId) ?? sorted[sorted.length - 1]!
    const oldest = sorted[0]!
    const newest = sorted[sorted.length - 1]!
    if (current.id === newest.id) {
      setLeftId(oldest.id)
      setRightId(newest.id)
    } else {
      setLeftId(current.id)
      setRightId(newest.id)
    }
    setSlider(50)
    setLightboxIndex(null)
    setMode('compare')
  }

  return (
    <section className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-evo-surface-2 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('gallery')
              setPicking(null)
            }}
            className={[
              'min-h-12 rounded-xl text-base font-bold transition',
              mode === 'gallery' ? 'bg-evo-accent text-[#1a120c]' : 'text-evo-muted',
            ].join(' ')}
          >
            Galería
          </button>
          <button
            type="button"
            onClick={() => setMode('compare')}
            disabled={photos.length < 2}
            className={[
              'min-h-12 rounded-xl text-base font-bold transition disabled:opacity-40',
              mode === 'compare' ? 'bg-evo-accent text-[#1a120c]' : 'text-evo-muted',
            ].join(' ')}
          >
            Comparar
          </button>
      </div>

      <div className="grid min-w-0 gap-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onUpload()
          }}
          className="panel min-w-0 space-y-4 p-4"
        >
          <p className="font-display text-xl font-bold">Nueva foto</p>
          <Input
            label="Fecha"
            type="date"
            value={recordedOn}
            onChange={(e) => onRecordedOn(e.target.value)}
            required
          />
          <label className="block min-w-0 max-w-full space-y-1.5">
            <span className="text-sm font-semibold text-evo-text">Imagen</span>
            <input
              type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic"
            onChange={(e) => onPhotoFile(e.target.files?.[0] ?? null)}
            className="box-border block w-full min-w-0 max-w-full text-base text-evo-text file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-evo-accent file:px-4 file:py-2 file:text-sm file:font-bold file:text-[#1a120c]"
              required
            />
            {photoFile ? (
              <p className="text-sm text-evo-lime">Lista para subir · se comprime automáticamente</p>
            ) : (
              <p className="text-xs text-evo-muted">Galería o cámara. En iPhone también vale HEIC.</p>
            )}
          </label>
          <Input
            label="Nota (opcional)"
            value={caption}
            onChange={(e) => onCaption(e.target.value)}
            placeholder="Frontal · lateral · espalda…"
          />
          <Button type="submit" fullWidth disabled={uploading || !photoFile}>
            {uploading ? 'Subiendo…' : 'Subir foto'}
          </Button>
        </form>

        <div className="space-y-3">
          {mode === 'compare' ? (
            <CompareStage
              left={left}
              right={right}
              slider={slider}
              onSlider={setSlider}
              gapDays={gapDays}
              onPickLeft={() => setPicking('left')}
              onPickRight={() => setPicking('right')}
              onSwap={() => {
                setLeftId(rightId)
                setRightId(leftId)
                setSlider(50)
              }}
              picking={picking}
            />
          ) : null}

          {photos.length === 0 ? (
            <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-evo-border px-4 py-6 text-center text-sm text-evo-muted">
              Aún no hay fotos. Sube la primera esta semana.
            </div>
          ) : (
            <div>
              {mode === 'compare' && picking ? (
                <p className="mb-2 rounded-xl border border-evo-accent/40 bg-evo-accent/10 px-3 py-2 text-xs font-semibold text-evo-accent">
                  Elige la foto para el lado {picking === 'left' ? 'ANTES' : 'DESPUÉS'}
                </p>
              ) : null}
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((photo, index) => {
                  const selected = mode === 'compare' && (photo.id === leftId || photo.id === rightId)
                  const role =
                    mode === 'compare'
                      ? photo.id === leftId
                        ? 'Antes'
                        : photo.id === rightId
                          ? 'Después'
                          : null
                      : null
                  return (
                    <li key={photo.id}>
                      <button
                        type="button"
                        onClick={() => handleThumbClick(photo, index)}
                        className={[
                          'group relative w-full overflow-hidden rounded-2xl border text-left transition',
                          selected
                            ? 'border-evo-accent ring-2 ring-evo-accent/40'
                            : picking
                              ? 'border-dashed border-evo-accent/50'
                              : 'border-evo-border hover:border-evo-accent/60',
                        ].join(' ')}
                      >
                        <img
                          src={photo.url}
                          alt={photo.caption ?? `Check-in ${photo.recorded_on}`}
                          className="aspect-[3/4] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-8">
                          <p className="text-xs font-bold text-white">{formatShortDate(photo.recorded_on)}</p>
                          {photo.caption ? (
                            <p className="truncate text-xs text-white/75">{photo.caption}</p>
                          ) : null}
                        </div>
                        {mode === 'gallery' ? (
                          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-1 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100 sm:opacity-100">
                            Ampliar
                          </span>
                        ) : null}
                        {role ? (
                          <span className="absolute left-2 top-2 rounded-full bg-evo-accent px-2 py-1 text-xs font-bold text-[#111]">
                            {role}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {lightboxIndex != null ? (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
          onCompare={startCompareFrom}
        />
      ) : null}
    </section>
  )
}

function CompareStage({
  left,
  right,
  slider,
  onSlider,
  gapDays,
  onPickLeft,
  onPickRight,
  onSwap,
  picking,
}: {
  left: ProgressPhoto | null
  right: ProgressPhoto | null
  slider: number
  onSlider: (n: number) => void
  gapDays: number | null
  onPickLeft: () => void
  onPickRight: () => void
  onSwap: () => void
  picking: 'left' | 'right' | null
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  function setFromClientX(clientX: number) {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    onSlider(Math.min(100, Math.max(0, pct)))
  }

  return (
    <div className="panel overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-evo-border/60 px-4 py-3">
        <div>
          <p className="text-sm font-bold">Antes vs después</p>
          <p className="text-xs text-evo-muted">
            {gapDays != null ? `${gapDays} día${gapDays === 1 ? '' : 's'} entre fotos` : 'Elige dos fotos'}
            {picking ? ` · eligiendo ${picking === 'left' ? 'ANTES' : 'DESPUÉS'}` : ''}
          </p>
        </div>
        <Button variant="ghost" className="!min-h-9 !px-3 !text-xs" onClick={onSwap} disabled={!left || !right}>
          Intercambiar
        </Button>
      </div>

      {!left || !right ? (
        <div className="px-4 py-10 text-center text-sm text-evo-muted">
          Necesitas al menos 2 fotos para comparar.
        </div>
      ) : (
        <>
          <div
            ref={trackRef}
            className="relative aspect-[3/4] w-full touch-none select-none overflow-hidden bg-black sm:aspect-[4/5] md:max-h-[420px] md:aspect-[16/11]"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              setFromClientX(e.clientX)
            }}
            onPointerMove={(e) => {
              if (e.buttons !== 1) return
              setFromClientX(e.clientX)
            }}
          >
            <img src={right.url} alt="Después" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
            >
              <img src={left.url} alt="Antes" className="h-full w-full object-cover" draggable={false} />
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.55)]"
              style={{ left: `${slider}%` }}
            >
              <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-evo-accent text-sm font-bold text-[#111] shadow-lg">
                ↔
              </div>
            </div>
            <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
              Antes
            </span>
            <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
              Después
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-evo-border/60 p-3">
            <button
              type="button"
              onClick={onPickLeft}
              className={[
                'rounded-xl border px-3 py-2 text-left transition',
                picking === 'left' ? 'border-evo-accent bg-evo-accent/10' : 'border-evo-border bg-evo-bg/40',
              ].join(' ')}
            >
              <p className="text-xs font-bold uppercase text-evo-muted">Antes</p>
              <p className="text-sm font-semibold">{formatLongDate(left.recorded_on)}</p>
              {left.caption ? <p className="truncate text-xs text-evo-muted">{left.caption}</p> : null}
            </button>
            <button
              type="button"
              onClick={onPickRight}
              className={[
                'rounded-xl border px-3 py-2 text-left transition',
                picking === 'right' ? 'border-evo-accent bg-evo-accent/10' : 'border-evo-border bg-evo-bg/40',
              ].join(' ')}
            >
              <p className="text-xs font-bold uppercase text-evo-muted">Después</p>
              <p className="text-sm font-semibold">{formatLongDate(right.recorded_on)}</p>
              {right.caption ? <p className="truncate text-xs text-evo-muted">{right.caption}</p> : null}
            </button>
          </div>

          <div className="px-4 pb-4">
            <input
              type="range"
              min={0}
              max={100}
              value={slider}
              onChange={(e) => onSlider(Number(e.target.value))}
              className="w-full accent-[#ff6b2c]"
              aria-label="Deslizar comparación"
            />
          </div>
        </>
      )}
    </div>
  )
}

function PhotoLightbox({
  photos,
  index,
  onClose,
  onChange,
  onCompare,
}: {
  photos: ProgressPhoto[]
  index: number
  onClose: () => void
  onChange: (index: number) => void
  onCompare: (photoId: number) => void
}) {
  const photo = photos[index]
  const canPrev = index > 0
  const canNext = index < photos.length - 1

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && canPrev) onChange(index - 1)
      if (e.key === 'ArrowRight' && canNext) onChange(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [index, canPrev, canNext, onClose, onChange])

  if (!photo) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-black/92 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
      onClick={onClose}
    >
      <div
        className="safe-top flex items-center justify-between gap-3 px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-white">
            {formatLongDate(photo.recorded_on)}
          </p>
          {photo.caption ? <p className="truncate text-sm text-white/70">{photo.caption}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {photos.length >= 2 ? (
            <button
              type="button"
              onClick={() => onCompare(photo.id)}
              className="rounded-xl bg-evo-accent px-3 py-2 text-xs font-bold text-[#111]"
            >
              Comparar
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white"
          >
            Cerrar
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-12 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Anterior"
          disabled={!canPrev}
          onClick={() => onChange(index - 1)}
          className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl text-white disabled:opacity-30"
        >
          ←
        </button>
        <img
          src={photo.url}
          alt={photo.caption ?? photo.recorded_on}
          className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
        />
        <button
          type="button"
          aria-label="Siguiente"
          disabled={!canNext}
          onClick={() => onChange(index + 1)}
          className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl text-white disabled:opacity-30"
        >
          →
        </button>
      </div>

      <p className="safe-bottom pb-3 text-center text-xs text-white/60">
        {index + 1} / {photos.length} · ← → o Esc para cerrar
      </p>
    </div>,
    document.body,
  )
}
