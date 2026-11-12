import type { StoryBackground, StoryStickers } from '../../lib/stories'
import { STORY_BACKGROUNDS } from '../../lib/stories'

type Props = {
  photoUrl: string | null
  background: StoryBackground | null
  text: string | null
  stickers: StoryStickers
  className?: string
  /** La foto ya se ve (o ha fallado): el visor empieza a contar el tiempo entonces. */
  onPhotoReady?: () => void
}

/** Sticker fitness con el estilo de EvoFit (píldora blanca con sombra, como los de Instagram). */
function Sticker({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: 'accent' | 'lime' | 'white' }) {
  const tones = {
    accent: 'bg-evo-accent text-[#1a120c]',
    lime: 'bg-evo-lime text-[#102000]',
    white: 'bg-white text-[#111923]',
  }
  return (
    <span className={['inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)]', tones[tone]].join(' ')}>
      <span className="text-xl leading-none" aria-hidden>
        {icon}
      </span>
      <span className="text-left leading-tight">
        <span className="block text-[0.6rem] font-extrabold uppercase tracking-[0.14em] opacity-70">{label}</span>
        <span className="block text-base font-extrabold">{value}</span>
      </span>
    </span>
  )
}

/** Una historia en formato 9:16: foto o fondo de marca, texto grande y stickers. */
export function StoryCanvas({ photoUrl, background, text, stickers, className = '', onPhotoReady }: Props) {
  const bg = STORY_BACKGROUNDS[background ?? 'energy']
  const darkText = !photoUrl && bg.dark
  const hasStickers = Boolean(stickers.today || stickers.gym || stickers.streak)

  return (
    <div className={['relative h-full w-full overflow-hidden', photoUrl ? 'bg-black' : bg.className, className].join(' ')}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          onLoad={onPhotoReady}
          onError={onPhotoReady}
        />
      ) : null}
      {photoUrl ? <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45" aria-hidden /> : null}

      {text ? (
        <div className="absolute inset-x-6 top-[38%] -translate-y-1/2 text-center">
          <p
            className={[
              'whitespace-pre-line break-words font-display text-[1.9rem] font-bold leading-tight [text-wrap:balance]',
              darkText ? 'text-[#1a120c]' : 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]',
            ].join(' ')}
          >
            {text}
          </p>
        </div>
      ) : null}

      {hasStickers ? (
        <div className="absolute inset-x-5 bottom-[18%] flex flex-col items-start gap-2.5">
          {stickers.today ? <Sticker icon="🏋️" label="Hoy toca" value={stickers.today} tone="accent" /> : null}
          {stickers.streak ? (
            <Sticker icon="🔥" label="Racha" value={`${stickers.streak} ${stickers.streak === 1 ? 'semana' : 'semanas'}`} tone="lime" />
          ) : null}
          {stickers.gym ? <Sticker icon="📍" label="Entrenando en" value={stickers.gym} tone="white" /> : null}
        </div>
      ) : null}
    </div>
  )
}
