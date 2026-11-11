import { useMutation, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Icon } from '../components/icons/Icon'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { Avatar } from '../features/profile/Avatar'
import { goalOption, levelLabel } from '../features/profile/profileOptions'
import { ProfilePosts } from '../features/feed/ProfilePosts'
import { FriendButton } from '../features/social/FriendButton'
import { api, apiErrorMessage } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import { personQuery, refreshSocial, type PersonProfile } from '../lib/social'
import { openConversation } from '../lib/messages'
import { storiesQuery } from '../lib/stories'
import { StoryRing } from '../features/stories/StoriesBar'
import { StoryViewer } from '../features/stories/StoryViewer'

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam o publicidad' },
  { id: 'harassment', label: 'Acoso o insultos' },
  { id: 'inappropriate', label: 'Contenido inapropiado' },
  { id: 'impersonation', label: 'Se hace pasar por otra persona' },
  { id: 'other', label: 'Otro motivo' },
] as const

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl bg-evo-surface-2 px-3 py-3 text-center">
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-evo-muted">{label}</p>
    </div>
  )
}

export function PersonProfilePage() {
  const id = Number(useParams().id)
  const { notify, confirm } = useUiFeedback()
  const query = useQuery({ ...personQuery(id), enabled: Number.isFinite(id) })
  const [menuOpen, setMenuOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [viewingStory, setViewingStory] = useState(false)
  const navigate = useNavigate()
  const storyGroup = useQuery({ ...storiesQuery, select: (groups) => groups.find((g) => g.user.id === id) }).data
  const message = useMutation({
    mutationFn: () => openConversation(id),
    onSuccess: (conversationId) => navigate(`/messages/${conversationId}`),
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido abrir la conversación.'), 'error'),
  })

  const setPerson = (person: PersonProfile) => queryClient.setQueryData(['person', id], person)

  const block = useMutation({
    mutationFn: async (blocked: boolean) =>
      (blocked ? await api.post<{ data: PersonProfile }>(`/people/${id}/block`) : await api.delete<{ data: PersonProfile }>(`/people/${id}/block`)).data
        .data,
    onSuccess: (person, blocked) => {
      setPerson(person)
      void refreshSocial()
      notify(blocked ? `Has bloqueado a ${person.name}` : `Has desbloqueado a ${person.name}`, 'success')
      setMenuOpen(false)
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido completar.'), 'error'),
  })

  if (query.isLoading) return <p className="text-sm text-evo-muted">Cargando perfil…</p>
  if (query.isError || !query.data) {
    const notFound = isAxiosError(query.error) && query.error.response?.status === 404
    return (
      <div className="mx-auto max-w-md space-y-2 py-10 text-center">
        <p className="font-display text-xl font-bold">{notFound ? 'Este perfil no está disponible' : 'No se ha podido cargar el perfil'}</p>
        <p className="text-sm text-evo-muted">{notFound ? 'Puede que la cuenta ya no exista.' : 'Revisa la conexión e inténtalo de nuevo.'}</p>
      </div>
    )
  }

  const person = query.data
  if (person.relation === 'self') return <Navigate to="/profile" replace />

  async function confirmBlock() {
    setMenuOpen(false)
    const ok = await confirm({
      title: `¿Bloquear a ${person.name}?`,
      message: 'No podrá encontrarte, ver tu perfil ni enviarte solicitudes. Si erais amigos, dejaréis de serlo. No se le avisa.',
      confirmLabel: 'Bloquear',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (ok) block.mutate(true)
  }

  if (person.blocked_by_me) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-8 text-center">
        <Avatar name={person.name} url={person.avatar_url} size="lg" className="mx-auto opacity-60" />
        <div>
          <p className="font-display text-xl font-bold">Has bloqueado a {person.name}</p>
          <p className="mt-1 text-sm text-evo-muted">No puede ver tu perfil ni enviarte solicitudes.</p>
        </div>
        <Button variant="secondary" disabled={block.isPending} onClick={() => block.mutate(false)}>
          Desbloquear
        </Button>
      </div>
    )
  }

  const goal = goalOption(person.training_goal)
  const level = levelLabel(person.experience_level)
  const facts = [
    person.location ? `📍 ${person.location}` : null,
    person.age != null ? `🎂 ${person.age} años` : null,
    person.gym_name ? `🏟️ ${person.gym_name}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="rounded-3xl border border-evo-border/60 bg-evo-surface p-5">
        <div className="flex items-start gap-4">
          {storyGroup ? (
            <button type="button" className="flex shrink-0" onClick={() => setViewingStory(true)} aria-label={`Ver la historia de ${person.name}`}>
              <StoryRing group={storyGroup}>
                <Avatar name={person.name} url={person.avatar_url} size="lg" />
              </StoryRing>
            </button>
          ) : (
            <Avatar name={person.name} url={person.avatar_url} size="lg" />
          )}
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight">{person.name}</h1>
            {person.username ? <p className="truncate text-sm font-semibold text-evo-accent">@{person.username}</p> : null}
            <p className="mt-1 text-sm text-evo-muted">
              <span className="font-bold text-evo-text tabular-nums">{person.friends_count}</span> {person.friends_count === 1 ? 'amigo' : 'amigos'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Más opciones"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-evo-muted hover:bg-evo-surface-2"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
        </div>

        {person.bio ? <p className="mt-4 whitespace-pre-line text-[0.95rem] leading-relaxed">{person.bio}</p> : null}

        {facts.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-evo-muted">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        ) : null}

        {goal || level ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {goal ? (
              <span className="rounded-full bg-evo-accent/15 px-3 py-1.5 text-sm font-bold text-evo-accent">
                {goal.emoji} {goal.label}
              </span>
            ) : null}
            {level ? <span className="rounded-full bg-evo-lime/15 px-3 py-1.5 text-sm font-bold text-evo-lime">{level}</span> : null}
          </div>
        ) : null}

        <div className="mt-5">
          {person.relation === 'friends' ? (
            <div className="grid grid-cols-2 gap-2">
              <FriendButton person={person} size="full" />
              <button
                type="button"
                disabled={message.isPending}
                onClick={() => message.mutate()}
                className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-evo-surface-2 px-4 text-base font-bold transition active:scale-95"
              >
                <Icon name="send" className="h-5 w-5" /> Mensaje
              </button>
            </div>
          ) : (
            <FriendButton person={person} size="full" />
          )}
        </div>
      </section>

      {person.can_view_activity && person.stats ? (
        <section aria-label="Estadísticas" className="rounded-3xl border border-evo-border/60 bg-evo-surface p-4">
          <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-evo-muted">Sus números</h2>
          <div className="grid grid-cols-3 gap-2">
            <StatTile value={person.stats.total_workouts} label="Entrenos" />
            <StatTile value={person.stats.month_workouts} label="Este mes" />
            <StatTile value={`${person.stats.streak_weeks} sem`} label="Racha" />
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-3xl border-2 border-dashed border-evo-border p-5">
          <span className="text-2xl" aria-hidden>
            🔒
          </span>
          <div>
            <p className="font-bold">{person.profile_visibility === 'private' ? 'Perfil privado' : 'Solo para amigos'}</p>
            <p className="text-sm text-evo-muted">
              {person.profile_visibility === 'private'
                ? `${person.name} no comparte sus entrenos.`
                : `Cuando seáis amigos verás los entrenos y estadísticas de ${person.name}.`}
            </p>
          </div>
        </section>
      )}

      {person.can_view_activity ? (
        <ProfilePosts userId={person.id} emptyText={`${person.name} aún no ha compartido ningún entreno.`} />
      ) : null}

      {menuOpen ? (
        <Sheet title={person.name} onClose={() => setMenuOpen(false)}>
          <div className="divide-y divide-evo-border/40 overflow-hidden rounded-2xl bg-evo-surface-2">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setReporting(true)
              }}
              className="flex min-h-14 w-full items-center px-4 text-left font-semibold"
            >
              Denunciar
            </button>
            <button type="button" onClick={() => void confirmBlock()} className="flex min-h-14 w-full items-center px-4 text-left font-semibold text-evo-danger">
              Bloquear
            </button>
          </div>
        </Sheet>
      ) : null}

      {reporting ? <ReportSheet person={person} onClose={() => setReporting(false)} /> : null}
      {viewingStory && storyGroup ? <StoryViewer groups={[storyGroup]} startGroup={0} onClose={() => setViewingStory(false)} /> : null}
    </div>
  )
}

function ReportSheet({ person, onClose }: { person: PersonProfile; onClose: () => void }) {
  const { notify } = useUiFeedback()
  const [reason, setReason] = useState<string>('')
  const [details, setDetails] = useState('')
  const send = useMutation({
    mutationFn: async () => api.post(`/people/${person.id}/report`, { reason, details: details.trim() || null }),
    onSuccess: () => {
      notify('Gracias. Revisaremos la denuncia.', 'success')
      onClose()
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido enviar.'), 'error'),
  })

  return (
    <Sheet
      title={`Denunciar a ${person.name}`}
      onClose={onClose}
      footer={
        <Button size="lg" fullWidth disabled={!reason || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? 'Enviando…' : 'Enviar denuncia'}
        </Button>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm text-evo-muted">¿Qué ocurre? No se lo diremos.</legend>
        {REPORT_REASONS.map((option) => (
          <label
            key={option.id}
            className={[
              'flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4',
              reason === option.id ? 'border-evo-accent bg-evo-accent/10' : 'border-evo-border bg-evo-surface-2',
            ].join(' ')}
          >
            <input type="radio" name="reason" value={option.id} checked={reason === option.id} onChange={() => setReason(option.id)} className="accent-evo-accent" />
            <span className="font-semibold">{option.label}</span>
          </label>
        ))}
      </fieldset>
      <label className="mt-4 block space-y-1.5">
        <span className="text-sm font-semibold">Detalles (opcional)</span>
        <textarea
          rows={3}
          maxLength={500}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="w-full resize-none rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-4 py-3 text-base text-evo-text focus:border-evo-accent focus:outline-none"
        />
      </label>
    </Sheet>
  )
}
