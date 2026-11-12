import { useMutation } from '@tanstack/react-query'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { apiErrorMessage } from '../../lib/api'
import { friendAction, type FriendAction, type PersonCard } from '../../lib/social'

type Props = {
  person: PersonCard
  /** compact: en listas. full: en el perfil, a todo el ancho. */
  size?: 'compact' | 'full'
  onChange?: (person: PersonCard) => void
}

const base = 'inline-flex items-center justify-center gap-1.5 rounded-2xl font-bold transition active:scale-95 disabled:opacity-50'

/** Añadir / solicitud enviada / aceptar-rechazar / amigos, según la relación. */
export function FriendButton({ person, size = 'compact', onChange }: Props) {
  const { notify, confirm } = useUiFeedback()
  const mutation = useMutation({
    mutationFn: (action: FriendAction) => friendAction(person, action),
    onSuccess: (updated, action) => {
      onChange?.(updated)
      const messages: Partial<Record<FriendAction, string>> = {
        add: updated.relation === 'friends' ? `Ya sois amigos con ${person.name}` : `Solicitud enviada a ${person.name}`,
        accept: `Ahora eres amigo de ${person.name}`,
        unfriend: `${person.name} ya no está entre tus amigos`,
      }
      if (messages[action]) notify(messages[action]!, 'success')
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido completar. Inténtalo de nuevo.'), 'error'),
  })

  const sizing = size === 'full' ? 'min-h-12 w-full px-4 text-base' : 'min-h-11 px-3.5 text-sm'
  const busy = mutation.isPending

  if (person.relation === 'self') return null

  if (person.relation === 'incoming') {
    return (
      <div className={size === 'full' ? 'grid w-full grid-cols-2 gap-2' : 'flex shrink-0 gap-1.5'}>
        <button type="button" disabled={busy} onClick={() => mutation.mutate('accept')} className={`${base} ${sizing} bg-evo-accent text-[#1a120c]`}>
          Aceptar
        </button>
        <button type="button" disabled={busy} onClick={() => mutation.mutate('decline')} className={`${base} ${sizing} bg-evo-surface-2 text-evo-text`}>
          Rechazar
        </button>
      </div>
    )
  }

  if (person.relation === 'outgoing') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => mutation.mutate('cancel')}
        className={`${base} ${sizing} shrink-0 border border-evo-border bg-evo-surface-2 text-evo-muted`}
        aria-label={`Cancelar solicitud a ${person.name}`}
      >
        Solicitud enviada
      </button>
    )
  }

  if (person.relation === 'friends') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          const ok = await confirm({
            title: `¿Eliminar a ${person.name} de tus amigos?`,
            message: 'Dejaréis de ver los entrenos del otro. Podéis volver a ser amigos cuando queráis.',
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true,
          })
          if (ok) mutation.mutate('unfriend')
        }}
        className={`${base} ${sizing} shrink-0 border border-evo-lime/40 bg-evo-lime/10 text-evo-lime`}
      >
        ✓ Amigos
      </button>
    )
  }

  return (
    <button type="button" disabled={busy} onClick={() => mutation.mutate('add')} className={`${base} ${sizing} shrink-0 bg-evo-accent text-[#1a120c]`}>
      + Añadir
    </button>
  )
}
