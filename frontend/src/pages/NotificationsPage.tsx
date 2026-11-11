import { Link } from 'react-router-dom'
import { Icon } from '../components/icons/Icon'
import { buttonClasses } from '../components/ui/Button'

/**
 * Bandeja de avisos. De momento no hay nada que notificar: se llenará con el feed social
 * (solicitudes de amistad, "me gusta" y comentarios en tus entrenos).
 */
export function NotificationsPage() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-evo-surface-2 text-evo-muted">
        <Icon name="bell" className="h-8 w-8" />
      </span>
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl font-bold">Todo tranquilo por aquí</h2>
        <p className="text-evo-muted">
          Cuando lleguen los amigos verás aquí sus solicitudes y quién da «me gusta» a tus entrenos.
        </p>
      </div>
      <Link to="/profile/edit" className={buttonClasses({ variant: 'secondary' })}>
        Prepara tu perfil
      </Link>
    </div>
  )
}
