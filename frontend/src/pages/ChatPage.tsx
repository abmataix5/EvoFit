import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LoadError } from '../components/feedback/LoadError'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Icon } from '../components/icons/Icon'
import { Avatar } from '../features/profile/Avatar'
import { StoryCanvas } from '../features/stories/StoryCanvas'
import { apiErrorMessage } from '../lib/api'
import { conversationQuery, fetchMessages, markConversationRead, sendMessage, type ChatMessage } from '../lib/messages'
import { handle } from '../lib/social'

const POLL_MS = 4000

/** Une mensajes sin repetir ninguno y siempre en orden (una consulta y un envío pueden cruzarse). */
function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

function dayLabel(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Hoy'
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer'
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

/** Conversación privada (se refresca sola mientras está abierta). */
export function ChatPage() {
  const id = Number(useParams().id)
  const { notify } = useUiFeedback()
  const conversation = useQuery({ ...conversationQuery(id), enabled: Number.isFinite(id) })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [body, setBody] = useState('')
  /** Alto de la página antes de añadir mensajes antiguos: para dejarte en el mismo sitio. */
  const anchorHeight = useRef<number | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const lastId = messages[messages.length - 1]?.id ?? 0

  const scrollToBottom = useCallback((smooth = false) => {
    bottom.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' })
  }, [])

  // Carga inicial y marca como leída.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    void (async () => {
      try {
        const page = await fetchMessages(id)
        if (cancelled) return
        setMessages(page.data)
        setHasMore(page.has_more)
        void markConversationRead(id)
      } catch {
        // No es una conversación vacía: se dice que no ha cargado y se deja reintentar.
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  // Mensajes nuevos cada pocos segundos (solo con la pestaña visible).
  useEffect(() => {
    if (loading || failed) return
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const page = await fetchMessages(id, { after: lastId })
        if (page.data.length > 0) {
          setMessages((current) => mergeMessages(current, page.data))
          void markConversationRead(id)
        }
      } catch {
        // Sin conexión: se reintenta en el siguiente ciclo.
      }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [id, lastId, loading, failed])

  useLayoutEffect(() => {
    if (anchorHeight.current != null) {
      // Se han añadido mensajes antiguos arriba: se compensa el scroll para no saltar de sitio.
      window.scrollBy({ top: document.documentElement.scrollHeight - anchorHeight.current })
      anchorHeight.current = null
      return
    }
    if (stickToBottom.current) scrollToBottom(!loading)
  }, [messages.length, loading, scrollToBottom])

  useEffect(() => {
    const onScroll = () => {
      stickToBottom.current = window.innerHeight + window.scrollY >= document.body.scrollHeight - 160
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const send = useMutation({
    mutationFn: (text: string) => sendMessage(id, text),
    onSuccess: (message) => {
      stickToBottom.current = true
      setMessages((current) => mergeMessages(current, [message]))
    },
    onError: (error, text) => {
      // El texto vuelve a la caja (si no has empezado a escribir otra cosa) para no perderlo.
      setBody((current) => (current.trim() === '' ? text : current))
      notify(apiErrorMessage(error, 'No se ha podido enviar.'), 'error')
    },
  })

  async function loadOlder() {
    const first = messages[0]
    if (!first || loadingOlder) return
    stickToBottom.current = false
    setLoadingOlder(true)
    try {
      const page = await fetchMessages(id, { before: first.id })
      anchorHeight.current = document.documentElement.scrollHeight
      setMessages((current) => mergeMessages(current, page.data))
      setHasMore(page.has_more)
    } catch (error) {
      notify(apiErrorMessage(error, 'No se han podido cargar los mensajes anteriores.'), 'error')
    } finally {
      setLoadingOlder(false)
    }
  }

  function submit(event?: FormEvent) {
    event?.preventDefault()
    const text = body.trim()
    if (!text || send.isPending) return
    // La caja se vacía al enviar (no al llegar la respuesta): lo que escribas mientras tanto no se borra.
    setBody('')
    send.mutate(text)
  }

  const other = conversation.data?.user
  const canMessage = conversation.data?.can_message ?? true

  if (failed || (conversation.isError && !conversation.data)) {
    return (
      <LoadError
        message="No se ha podido abrir la conversación. Comprueba la cobertura y vuelve a intentarlo."
        onRetry={() => {
          setAttempt((n) => n + 1)
          void conversation.refetch()
        }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {other ? (
        <Link to={`/u/${other.id}`} className="mb-4 flex flex-col items-center gap-1 pt-2 text-center">
          <Avatar name={other.name} url={other.avatar_url} size="lg" />
          <span className="mt-1 font-display text-2xl font-extrabold uppercase leading-none">{other.name}</span>
          <span className="text-sm text-evo-muted">{handle(other)} · Ver perfil</span>
        </Link>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          disabled={loadingOlder}
          onClick={() => void loadOlder()}
          className="mx-auto mb-3 block min-h-11 px-4 text-sm font-bold text-evo-accent disabled:opacity-50"
        >
          {loadingOlder ? 'Cargando…' : 'Ver mensajes anteriores'}
        </button>
      ) : null}

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Cargando mensajes">
          <div className="evo-skeleton h-11 w-2/3 rounded-3xl" />
          <div className="evo-skeleton ml-auto h-11 w-1/2 rounded-3xl" />
          <div className="evo-skeleton h-11 w-3/5 rounded-3xl" />
        </div>
      ) : messages.length === 0 ? (
        <p className="text-center text-sm text-evo-muted">Saluda a {handle(other)} 👋</p>
      ) : (
        <ol className="space-y-1.5">
          {messages.map((message, index) => {
            const previous = messages[index - 1]
            const newDay = !previous || new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString()
            return (
              <li key={message.id}>
                {newDay ? <p className="py-3 text-center text-xs font-semibold capitalize text-evo-muted">{dayLabel(message.created_at)}</p> : null}
                <MessageBubble message={message} otherName={handle(other)} />
              </li>
            )
          })}
        </ol>
      )}
      {/* Hueco del alto de la caja de escribir: al bajar al final, el último mensaje queda a la vista. */}
      <div ref={bottom} className="h-[calc(6.5rem+env(safe-area-inset-bottom))]" aria-hidden />

      <form
        onSubmit={submit}
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-evo-border/40 bg-evo-bg/95 px-4 pt-3 backdrop-blur-xl lg:left-[260px]"
      >
        {canMessage ? (
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Mensaje</span>
              <textarea
                rows={1}
                maxLength={1000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                }}
                placeholder="Mensaje…"
                className="max-h-32 w-full resize-none rounded-3xl border border-evo-border bg-evo-surface-2 px-4 py-3 text-base text-evo-text placeholder:text-evo-muted/80 focus:border-evo-accent focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={!body.trim() || send.isPending || loading}
              aria-label="Enviar mensaje"
              className="mb-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-evo-accent text-[#1a120c] transition active:scale-90 disabled:opacity-40"
            >
              <Icon name="send" className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <p className="mx-auto max-w-2xl pb-1 text-center text-sm text-evo-muted">Ya no podéis enviaros mensajes.</p>
        )}
      </form>
    </div>
  )
}

function MessageBubble({ message, otherName }: { message: ChatMessage; otherName: string }) {
  const align = message.mine ? 'items-end' : 'items-start'
  const label = message.story_reply
    ? message.mine
      ? message.reaction
        ? `Reaccionaste a la historia de ${otherName}`
        : `Respondiste a la historia de ${otherName}`
      : message.reaction
        ? 'Ha reaccionado a tu historia'
        : 'Ha respondido a tu historia'
    : null

  return (
    <div className={['flex flex-col gap-1', align].join(' ')}>
      {label ? <p className="px-1 text-xs text-evo-muted">{label}</p> : null}
      {message.story_reply ? (
        message.story ? (
          <div className="relative h-40 w-[5.6rem] overflow-hidden rounded-2xl">
            <StoryCanvas
              photoUrl={message.story.photo_url}
              background={message.story.background}
              text={null}
              stickers={{ today: null, gym: null, streak: null }}
            />
            {message.story.text ? (
              <p className="absolute inset-x-1.5 top-1/2 line-clamp-4 -translate-y-1/2 text-center text-[0.7rem] font-bold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                {message.story.text}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-evo-border px-3 py-2 text-xs text-evo-muted">Historia no disponible</p>
        )
      ) : null}
      {message.reaction ? <p className="px-1 text-5xl leading-none">{message.reaction}</p> : null}
      {message.body ? (
        <p
          className={[
            'max-w-[78%] whitespace-pre-line break-words rounded-3xl px-4 py-2.5 text-[0.95rem] leading-snug',
            message.mine ? 'rounded-br-lg bg-evo-accent text-[#1a120c]' : 'rounded-bl-lg bg-evo-surface-2 text-evo-text',
          ].join(' ')}
          title={timeLabel(message.created_at)}
        >
          {message.body}
        </p>
      ) : null}
    </div>
  )
}
