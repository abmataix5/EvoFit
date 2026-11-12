import { useMutation } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Icon } from '../components/icons/Icon'
import { ThemeSwitch } from '../components/layout/ThemeSwitch'
import { useAuth } from '../features/auth/AuthContext'
import { PasswordForm } from '../features/profile/PasswordForm'
import { VISIBILITY_OPTIONS } from '../features/profile/profileOptions'
import { api, apiErrorMessage, type User } from '../lib/api'
import { queryClient } from '../lib/queryClient'

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 evo-kicker">{title}</h2>
      <div className="divide-y divide-evo-border/40 overflow-hidden rounded-2xl border border-evo-border/50 bg-evo-surface">{children}</div>
    </section>
  )
}

function RowLink({ to, icon, title, detail }: { to: string; icon: string; title: string; detail?: string }) {
  return (
    <Link to={to} className="flex min-h-14 items-center gap-3 px-4 transition active:bg-evo-surface-2">
      <span className="w-6 text-center text-lg" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {detail ? <span className="block truncate text-sm text-evo-muted">{detail}</span> : null}
      </span>
      <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
    </Link>
  )
}

function RowToggle({
  icon,
  title,
  detail,
  checked,
  disabled,
  onChange,
}: {
  icon: string
  title: string
  detail?: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4">
      <span className="w-6 text-center text-lg" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {detail ? <span className="block text-sm text-evo-muted">{detail}</span> : null}
      </span>
      {/* Interruptor accesible: un checkbox con aspecto de switch. */}
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-evo-border transition peer-checked:bg-evo-accent peer-focus-visible:ring-4 peer-focus-visible:ring-evo-accent/30 peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  )
}

/** Configuración y actividad: todo lo que no es el perfil en sí. */
export function SettingsPage() {
  const { user, logout, setCurrentUser } = useAuth()
  const { confirm, notify } = useUiFeedback()
  const [passwordOpen, setPasswordOpen] = useState(false)

  // Los ajustes se guardan al momento (sin botón de guardar).
  const update = useMutation({
    mutationFn: async (patch: Partial<Pick<User, 'profile_visibility' | 'show_age' | 'email_notifications'>>) =>
      (await api.patch<{ data: User }>('/profile', patch)).data.data,
    onSuccess: (updated) => {
      setCurrentUser(updated)
      void queryClient.invalidateQueries({ queryKey: ['person', updated.id] })
      notify('Guardado', 'success')
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido guardar.'), 'error'),
  })

  if (!user) return null

  async function handleLogout() {
    const ok = await confirm({
      title: 'Cerrar sesión',
      message: '¿Quieres salir de EvoFit en este dispositivo?',
      confirmLabel: 'Salir',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (ok) await logout()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-6">
      <h1 className="sr-only">Configuración</h1>

      <Group title="Tu cuenta">
        <RowLink to="/profile/edit" icon="👤" title="Editar perfil" detail="Foto, nombre, alias, bio, objetivo…" />
        <RowLink to="/friends" icon="👥" title="Amigos y solicitudes" />
        <RowLink to="/messages" icon="💬" title="Mensajes" />
      </Group>

      <section className="space-y-2" id="privacidad">
        <h2 className="px-1 evo-kicker">Privacidad</h2>
        <div className="overflow-hidden rounded-2xl border border-evo-border/50 bg-evo-surface">
          <fieldset className="p-4">
            {/* La leyenda real queda para lectores de pantalla; la visible no se monta sobre el borde. */}
            <legend className="sr-only">Quién puede ver tus entrenos e historias</legend>
            <p className="mb-3 font-semibold" aria-hidden>
              Quién puede ver tus entrenos e historias
            </p>
            <div className="space-y-2">
              {VISIBILITY_OPTIONS.map((option) => {
                const active = user.profile_visibility === option.id
                return (
                  <label
                    key={option.id}
                    className={[
                      'flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition',
                      active ? 'border-evo-accent bg-evo-accent/10' : 'border-evo-border/70 bg-evo-surface-2',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="profile_visibility"
                      checked={active}
                      disabled={update.isPending}
                      onChange={() => update.mutate({ profile_visibility: option.id })}
                      className="mt-1 h-4 w-4 accent-evo-accent"
                    />
                    <span>
                      <span className="block font-bold">{option.label}</span>
                      <span className="block text-sm text-evo-muted">{option.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="border-t border-evo-border/40">
            <RowToggle
              icon="🎂"
              title="Mostrar mi edad"
              detail="En tu perfil, para quien pueda verlo."
              checked={user.show_age}
              disabled={update.isPending}
              onChange={(value) => update.mutate({ show_age: value })}
            />
          </div>
        </div>
      </section>

      <Group title="Notificaciones">
        <RowToggle
          icon="✉️"
          title="Avisos por email"
          detail="Cuando alguien quiera ser tu amigo."
          checked={user.email_notifications}
          disabled={update.isPending}
          onChange={(value) => update.mutate({ email_notifications: value })}
        />
      </Group>

      {/* El selector ya lleva su título "Apariencia". */}
      <section aria-label="Apariencia" className="rounded-2xl border border-evo-border/50 bg-evo-surface p-4">
        <ThemeSwitch />
      </section>

      <section className="space-y-2" id="cuenta">
        <h2 className="px-1 evo-kicker">Cuenta y seguridad</h2>
        <div className="divide-y divide-evo-border/40 overflow-hidden rounded-2xl border border-evo-border/50 bg-evo-surface">
          <div className="flex min-h-14 items-center gap-3 px-4">
            <span className="w-6 text-center text-lg" aria-hidden>
              📧
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Email</span>
              <span className="block truncate text-sm text-evo-muted">{user.email}</span>
            </span>
          </div>
          <button
            type="button"
            aria-expanded={passwordOpen}
            onClick={() => setPasswordOpen((o) => !o)}
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
          >
            <span className="w-6 text-center text-lg" aria-hidden>
              🔑
            </span>
            <span className="flex-1 font-semibold">Cambiar contraseña</span>
            <Icon name="chevron" className={['h-4 w-4 text-evo-muted transition', passwordOpen ? 'rotate-90' : ''].join(' ')} />
          </button>
          {passwordOpen ? (
            <div className="p-4">
              <PasswordForm />
            </div>
          ) : null}
        </div>
      </section>

      <Group title="App">
        <RowLink to="/instalar" icon="📲" title="Instalar EvoFit en el móvil" detail="Pantalla completa, como una app" />
      </Group>

      <button
        type="button"
        onClick={() => void handleLogout()}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-evo-border/50 bg-evo-surface font-bold text-evo-danger transition active:scale-[0.99]"
      >
        <Icon name="logout" className="h-5 w-5" />
        Cerrar sesión
      </button>
    </div>
  )
}
