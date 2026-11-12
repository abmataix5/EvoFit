import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Icon } from '../../components/icons/Icon'
import { apiErrorMessage, validationErrors } from '../../lib/api'
import { prepareProgressPhoto } from '../../lib/preparePhoto'
import { STORY_BACKGROUNDS, publishStory, stickersQuery, type StoryBackground } from '../../lib/stories'
import { StoryCanvas } from './StoryCanvas'

function Toggle({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-bold transition active:scale-95 disabled:opacity-35',
        on ? 'border-evo-accent bg-evo-accent text-[#1a120c]' : 'border-white/25 bg-white/10 text-white',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** Crear una historia: foto o fondo, texto y stickers fitness ("Hoy toca", racha, gimnasio). */
export function StoryComposer({ onClose }: { onClose: () => void }) {
  const { notify } = useUiFeedback()
  const stickers = useQuery(stickersQuery)
  const fileInput = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [background, setBackground] = useState<StoryBackground>('energy')
  const [text, setText] = useState('')
  const [showToday, setShowToday] = useState(true)
  const [showStreak, setShowStreak] = useState(true)
  const [showGym, setShowGym] = useState(true)
  const [gym, setGym] = useState<string | null>(null)

  const values = stickers.data
  const gymValue = gym ?? values?.gym ?? ''

  useEffect(() => {
    if (!photo) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const publish = useMutation({
    mutationFn: async () =>
      publishStory({
        photo: photo ? await prepareProgressPhoto(photo) : null,
        background,
        text: text.trim(),
        gym: showGym ? gymValue.trim() : '',
        showToday: showToday && Boolean(values?.today),
        showStreak: showStreak && Boolean(values?.streak),
      }),
    onSuccess: () => {
      notify('Historia publicada · dura 24 h', 'success')
      onClose()
    },
    onError: (error) => notify(Object.values(validationErrors(error))[0] ?? apiErrorMessage(error, 'No se ha podido publicar.'), 'error'),
  })

  return createPortal(
    <div className="fixed inset-0 z-[65] flex flex-col bg-[#05080c]" role="dialog" aria-modal="true" aria-label="Nueva historia">
      <div className="flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center text-white">
          <Icon name="close" className="h-7 w-7" />
        </button>
        <p className="font-bold text-white">Nueva historia</p>
        <span className="w-11" aria-hidden />
      </div>

      <div className="relative mx-auto my-2 min-h-0 w-full max-w-sm flex-1 overflow-hidden rounded-3xl">
        <StoryCanvas
          photoUrl={preview}
          background={background}
          text={text || null}
          stickers={{
            today: showToday ? (values?.today ?? null) : null,
            streak: showStreak ? (values?.streak ?? null) : null,
            gym: showGym && gymValue.trim() ? gymValue.trim() : null,
          }}
        />
        {!text ? (
          <p className="pointer-events-none absolute inset-x-6 top-[38%] -translate-y-1/2 text-center font-display text-2xl font-bold text-white/60 drop-shadow">
            Escribe abajo tu mensaje
          </p>
        ) : null}
      </div>

      <div className="space-y-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
            if (file) setPhoto(file)
          }}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (photo ? setPhoto(null) : fileInput.current?.click())}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-[#111923]"
          >
            {photo ? 'Quitar foto' : '📷 Foto'}
          </button>
          {!photo ? (
            <div className="flex gap-2" role="radiogroup" aria-label="Fondo">
              {(Object.keys(STORY_BACKGROUNDS) as StoryBackground[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={background === key}
                  aria-label={`Fondo ${STORY_BACKGROUNDS[key].label}`}
                  onClick={() => setBackground(key)}
                  className={[
                    'h-10 w-10 rounded-full border-2 transition',
                    STORY_BACKGROUNDS[key].className,
                    background === key ? 'scale-110 border-white' : 'border-white/30',
                  ].join(' ')}
                />
              ))}
            </div>
          ) : null}
        </div>

        <label className="block">
          <span className="sr-only">Texto de la historia</span>
          <input
            value={text}
            maxLength={160}
            onChange={(e) => setText(e.target.value)}
            placeholder="¿Qué toca hoy? ¡Cuéntalo! 💪"
            className="h-12 w-full rounded-full border border-white/25 bg-white/10 px-5 text-base text-white placeholder:text-white/55 focus:border-evo-accent focus:outline-none"
          />
        </label>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Stickers">
          <Toggle on={showToday && Boolean(values?.today)} disabled={!values?.today} onClick={() => setShowToday((v) => !v)}>
            🏋️ {values?.today ? `Hoy toca: ${values.today}` : 'Hoy no toca rutina'}
          </Toggle>
          <Toggle on={showStreak && Boolean(values?.streak)} disabled={!values?.streak} onClick={() => setShowStreak((v) => !v)}>
            🔥 {values?.streak ? `${values.streak} sem de racha` : 'Sin racha aún'}
          </Toggle>
          <Toggle on={showGym && Boolean(gymValue.trim())} onClick={() => setShowGym((v) => !v)}>
            📍 Gimnasio
          </Toggle>
        </div>
        {showGym ? (
          <input
            value={gymValue}
            maxLength={80}
            onChange={(e) => setGym(e.target.value)}
            placeholder="¿Dónde entrenas hoy?"
            className="h-11 w-full rounded-full border border-white/20 bg-white/5 px-5 text-base text-white placeholder:text-white/50 focus:border-evo-accent focus:outline-none"
          />
        ) : null}

        <button
          type="button"
          disabled={publish.isPending}
          onClick={() => publish.mutate()}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-evo-accent text-base font-bold text-[#1a120c] disabled:opacity-50"
        >
          {publish.isPending ? 'Publicando…' : 'Compartir en tu historia'}
        </button>
      </div>
    </div>,
    document.body,
  )
}
