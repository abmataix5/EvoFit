import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Icon } from '../../components/icons/Icon'
import { Sheet } from '../../components/ui/Sheet'
import { apiErrorMessage } from '../../lib/api'
import { handle, timeAgo } from '../../lib/social'
import { deleteStory, markStorySeen, replyToStory, storyViewersQuery, type StoryGroup } from '../../lib/stories'
import { Avatar } from '../profile/Avatar'
import { StoryCanvas } from './StoryCanvas'

const DURATION_MS = 5500
const REACTIONS = ['🔥', '💪', '👏', '😍', '😂', '😮', '❤️', '🏆']

type Props = {
  groups: StoryGroup[]
  startGroup: number
  onClose: () => void
}

/** Cada persona empieza por su primera historia sin ver (o la primera, si las ha visto todas). */
function firstUnseen(groups: StoryGroup[], index: number) {
  return Math.max(0, groups[index]?.stories.findIndex((s) => !s.seen) ?? 0)
}

/** Visor a pantalla completa, como el de Instagram. */
export function StoryViewer({ groups, startGroup, onClose }: Props) {
  const { notify, confirm } = useUiFeedback()
  const [groupIndex, setGroupIndex] = useState(startGroup)
  const [storyIndex, setStoryIndex] = useState(() => firstUnseen(groups, startGroup))
  const [progress, setProgress] = useState(0)
  const [held, setHeld] = useState(false)
  const [typing, setTyping] = useState(false)
  const [reactionsOpen, setReactionsOpen] = useState(false)
  const [viewersOpen, setViewersOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [sentFlash, setSentFlash] = useState<string | null>(null)
  const pressStart = useRef(0)
  const progressRef = useRef(0)
  const holdTimer = useRef<number | null>(null)

  const group = groups[groupIndex]
  const story = group?.stories[storyIndex]
  const paused = held || typing || reactionsOpen || viewersOpen

  const viewers = useQuery({ ...storyViewersQuery(story?.id ?? 0), enabled: Boolean(group?.mine && story) })

  const next = useCallback(() => {
    if (!group) return
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1)
      setStoryIndex(firstUnseen(groups, groupIndex + 1))
    } else {
      onClose()
    }
  }, [group, storyIndex, groupIndex, groups, onClose])

  const prev = useCallback(() => {
    if (storyIndex > 0) setStoryIndex((i) => i - 1)
    else if (groupIndex > 0) {
      const previous = groups[groupIndex - 1]!
      setGroupIndex((g) => g - 1)
      setStoryIndex(previous.stories.length - 1)
    } else {
      progressRef.current = 0
      setProgress(0)
    }
  }, [storyIndex, groupIndex, groups])

  // Al cambiar de historia: progreso a cero y se marca como vista (una vez por historia).
  const marked = useRef(new Set<number>())
  const storyId = story?.id
  const shouldMark = Boolean(story && group && !group.mine && !story.seen)
  useEffect(() => {
    progressRef.current = 0
    setProgress(0)
    setReply('')
    if (storyId && shouldMark && !marked.current.has(storyId)) {
      marked.current.add(storyId)
      markStorySeen(storyId)
    }
  }, [storyId, shouldMark])

  // Avance automático (se detiene al mantener pulsado, escribir o abrir algo). El progreso
  // vive en una ref para seguir donde estaba al reanudar; al llegar a 1 se para y avanza una vez.
  useEffect(() => {
    if (paused || !story) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      progressRef.current = Math.min(1, progressRef.current + (now - last) / DURATION_MS)
      last = now
      setProgress(progressRef.current)
      if (progressRef.current >= 1) {
        next()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, story, next])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') next()
      if (event.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, next, prev])

  const send = useMutation({
    mutationFn: (content: { body?: string; reaction?: string }) => replyToStory(story!.id, content),
    onSuccess: (_, content) => {
      setReply('')
      setReactionsOpen(false)
      setSentFlash(content.reaction ?? 'Enviado')
      window.setTimeout(() => setSentFlash(null), 1400)
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido enviar.'), 'error'),
  })

  const remove = useMutation({
    mutationFn: () => deleteStory(story!.id),
    onSuccess: () => {
      notify('Historia eliminada', 'success')
      onClose()
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido eliminar.'), 'error'),
  })

  if (!group || !story) return null

  function onPointerDown() {
    pressStart.current = Date.now()
    holdTimer.current = window.setTimeout(() => setHeld(true), 180)
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    const wasHold = Date.now() - pressStart.current > 250
    setHeld(false)
    if (wasHold) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX - rect.left < rect.width * 0.3) prev()
    else next()
  }

  function submitReply(event: FormEvent) {
    event.preventDefault()
    const text = reply.trim()
    if (text) send.mutate({ body: text })
  }

  async function confirmDelete() {
    setHeld(true)
    const ok = await confirm({
      title: '¿Eliminar esta historia?',
      message: 'Desaparece para todos ahora mismo.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    setHeld(false)
    if (ok) remove.mutate()
  }

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black" role="dialog" aria-modal="true" aria-label={`Historias de ${handle(group.user)}`}>
      <div className="relative h-full w-full sm:h-[min(92dvh,860px)] sm:w-auto sm:aspect-[9/16] sm:overflow-hidden sm:rounded-3xl">
        <div className="absolute inset-0 touch-none select-none" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={() => setHeld(false)}>
          <StoryCanvas photoUrl={story.photo_url} background={story.background} text={story.text} stickers={story.stickers} />
        </div>

        <div className={['pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent px-3 pb-8 pt-[max(0.6rem,env(safe-area-inset-top))] transition-opacity', held ? 'opacity-0' : ''].join(' ')}>
          <div className="flex gap-1" aria-hidden>
            {group.stories.map((s, index) => (
              <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
                <span
                  className="block h-full rounded-full bg-white"
                  style={{ width: `${index < storyIndex ? 100 : index === storyIndex ? progress * 100 : 0}%` }}
                />
              </span>
            ))}
          </div>
          <div className="pointer-events-auto mt-2.5 flex items-center gap-2.5">
            <Link to={`/u/${group.user.id}`} onClick={onClose} className="flex min-w-0 items-center gap-2.5">
              <Avatar name={group.user.name} url={group.user.avatar_url} size="sm" />
              <span className="truncate text-sm font-bold text-white">{group.mine ? 'Tu historia' : handle(group.user)}</span>
              <span className="shrink-0 text-sm text-white/70">{timeAgo(story.created_at)}</span>
            </Link>
            <span className="ml-auto flex items-center">
              {group.mine ? (
                <button type="button" onClick={() => void confirmDelete()} aria-label="Eliminar historia" className="flex h-10 w-10 items-center justify-center text-white">
                  <Icon name="more" className="h-6 w-6" />
                </button>
              ) : null}
              <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center text-white">
                <Icon name="close" className="h-7 w-7" />
              </button>
            </span>
          </div>
        </div>

        {sentFlash ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-live="polite">
            <span className={['evo-pop rounded-full bg-black/60 px-5 py-3 font-bold text-white', sentFlash.length <= 2 ? 'text-6xl' : 'text-base'].join(' ')}>
              {sentFlash}
            </span>
          </div>
        ) : null}

        <div className={['absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 transition-opacity', held ? 'opacity-0' : ''].join(' ')}>
          {group.mine ? (
            <button
              type="button"
              onClick={() => setViewersOpen(true)}
              className="flex items-center gap-2 rounded-full bg-black/40 px-4 py-2.5 text-sm font-bold text-white backdrop-blur"
            >
              <Icon name="eye" className="h-5 w-5" />
              {viewers.data ? `Visto por ${viewers.data.length}` : 'Actividad'}
            </button>
          ) : (
            <>
              {reactionsOpen ? (
                <div className="mb-3 grid grid-cols-4 gap-2 rounded-3xl bg-[#05080c]/85 p-3" role="group" aria-label="Reacciones">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      disabled={send.isPending}
                      onClick={() => send.mutate({ reaction: emoji })}
                      className="flex h-14 items-center justify-center text-4xl transition active:scale-75"
                      aria-label={`Reaccionar con ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
              <form onSubmit={submitReply} className="flex items-center gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Responder a {handle(group.user)}</span>
                  <input
                    value={reply}
                    maxLength={1000}
                    onChange={(e) => setReply(e.target.value)}
                    onFocus={() => setTyping(true)}
                    onBlur={() => setTyping(false)}
                    placeholder={`Responder a ${handle(group.user)}…`}
                    className="h-12 w-full rounded-full border border-white/60 bg-transparent px-5 text-base text-white placeholder:text-white/75 focus:border-white focus:outline-none"
                  />
                </label>
                {reply.trim() ? (
                  <button type="submit" disabled={send.isPending} className="h-12 px-2 font-bold text-white">
                    Enviar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setReactionsOpen((o) => !o)}
                      aria-label="Reaccionar"
                      aria-expanded={reactionsOpen}
                      className="flex h-12 w-12 items-center justify-center text-white"
                    >
                      <Icon name={reactionsOpen ? 'heart-filled' : 'heart'} className="h-7 w-7" />
                    </button>
                    <span className="flex h-12 w-10 items-center justify-center text-white" aria-hidden>
                      <Icon name="send" className="h-6 w-6" />
                    </span>
                  </>
                )}
              </form>
            </>
          )}
        </div>
      </div>

      {viewersOpen ? (
        <Sheet title={`Visto por ${viewers.data?.length ?? ''}`} onClose={() => setViewersOpen(false)}>
          {(viewers.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-evo-muted">Aún no la ha visto nadie.</p>
          ) : (
            <ul className="divide-y divide-evo-border/40">
              {viewers.data!.map((person) => (
                <li key={person.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={person.name} url={person.avatar_url} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{handle(person)}</span>
                    <span className="block text-sm text-evo-muted">{timeAgo(person.viewed_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      ) : null}
    </div>,
    document.body,
  )
}
