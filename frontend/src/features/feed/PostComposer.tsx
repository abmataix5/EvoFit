import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/icons/Icon'

export type ComposerValue = {
  caption: string
  gym: string
  /** Foto nueva elegida (aún sin subir). */
  photo: File | null
  /** Foto ya publicada (si no se ha quitado ni cambiado). */
  existingPhotoUrl: string | null
  removePhoto: boolean
}

export function composerFrom(post: { caption: string | null; gym_name: string | null; photo_url: string | null } | null, defaultGym = ''): ComposerValue {
  return {
    caption: post?.caption ?? '',
    gym: post?.gym_name ?? defaultGym,
    photo: null,
    existingPhotoUrl: post?.photo_url ?? null,
    removePhoto: false,
  }
}

const CAPTION_MAX = 500

/** Foto, pie de foto y gimnasio de una publicación, al estilo "Nueva publicación" de Instagram. */
export function PostComposer({ value, onChange }: { value: ComposerValue; onChange: (next: ComposerValue) => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!value.photo) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(value.photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value.photo])

  const shown = preview ?? (value.removePhoto ? null : value.existingPhotoUrl)
  const set = (patch: Partial<ComposerValue>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-3">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) set({ photo: file, removePhoto: false })
        }}
      />

      {shown ? (
        <div className="relative overflow-hidden rounded-2xl bg-evo-surface-2">
          <img src={shown} alt="Foto de la publicación" className="aspect-[4/5] w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="rounded-full bg-white/90 px-3.5 py-2 text-sm font-bold text-[#111923] backdrop-blur"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => set({ photo: null, removePhoto: true })}
              className="rounded-full bg-black/60 px-3.5 py-2 text-sm font-bold text-white backdrop-blur"
            >
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-evo-border bg-evo-surface-2/50 text-evo-muted transition active:scale-[0.99]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-evo-accent/15 text-2xl" aria-hidden>
            📸
          </span>
          <span className="font-bold text-evo-text">Añadir foto</span>
          <span className="text-xs">Opcional · sin foto se muestra la tarjeta del entreno</span>
        </button>
      )}

      <div className="overflow-hidden rounded-2xl border-2 border-evo-border bg-evo-surface-2 focus-within:border-evo-accent">
        <label className="block">
          <span className="sr-only">Pie de foto</span>
          <textarea
            rows={3}
            maxLength={CAPTION_MAX}
            value={value.caption}
            onChange={(e) => set({ caption: e.target.value })}
            placeholder="Escribe un pie de foto… ¿qué tal ha ido?"
            className="block w-full resize-none bg-transparent px-4 pt-3 text-base text-evo-text placeholder:text-evo-muted/80 focus:outline-none"
          />
        </label>
        <p className="px-4 pb-2 text-right text-xs tabular-nums text-evo-muted">
          {value.caption.length}/{CAPTION_MAX}
        </p>
        <label className="flex items-center gap-2 border-t border-evo-border/70 px-4">
          <span aria-hidden>📍</span>
          <span className="sr-only">Gimnasio</span>
          <input
            value={value.gym}
            maxLength={80}
            onChange={(e) => set({ gym: e.target.value })}
            placeholder="Añadir gimnasio"
            className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-evo-text placeholder:text-evo-muted/80 focus:outline-none"
          />
          {value.gym ? (
            <button type="button" onClick={() => set({ gym: '' })} aria-label="Quitar gimnasio" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-evo-muted">
              <Icon name="close" className="h-4 w-4" />
            </button>
          ) : null}
        </label>
      </div>
    </div>
  )
}

/** ¿Ha cambiado algo respecto a lo publicado? */
export function composerDirty(value: ComposerValue, original: ComposerValue): boolean {
  return (
    value.caption.trim() !== original.caption.trim() ||
    value.gym.trim() !== original.gym.trim() ||
    value.photo !== null ||
    value.removePhoto
  )
}
