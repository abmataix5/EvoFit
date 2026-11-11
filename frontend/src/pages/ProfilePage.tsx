import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Icon } from '../components/icons/Icon'
import { ThemeSwitch } from '../components/layout/ThemeSwitch'
import { buttonClasses } from '../components/ui/Button'
import { useAuth } from '../features/auth/AuthContext'
import { Avatar } from '../features/profile/Avatar'
import { goalOption, levelLabel, profileCompletion, visibilityOption } from '../features/profile/profileOptions'
import { api, apiErrorMessage, type ProfileStats, type User } from '../lib/api'
import { friendRequestsQuery, friendsQuery } from '../lib/social'
import { ProfilePosts } from '../features/feed/ProfilePosts'

function formatMonthYear(iso: string | null) {
  if (!iso) return null
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl bg-evo-surface-2 px-3 py-3 text-center">
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-evo-muted">{label}</p>
    </div>
  )
}

export function ProfilePage() {
  const { user, logout, setCurrentUser } = useAuth()
  const { confirm, notify } = useUiFeedback()
  const friends = useQuery(friendsQuery)
  const requests = useQuery(friendRequestsQuery)
  const pendingRequests = requests.data?.incoming.length ?? 0
  const emailPref = useMutation({
    mutationFn: async (enabled: boolean) => (await api.patch<{ data: User }>('/profile', { email_notifications: enabled })).data.data,
    onSuccess: (updated) => {
      setCurrentUser(updated)
      notify(updated.email_notifications ? 'Avisos por email activados' : 'Avisos por email desactivados', 'success')
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido guardar.'), 'error'),
  })
  const stats = useQuery({
    queryKey: ['profile', 'stats'],
    queryFn: async () => (await api.get<ProfileStats>('/profile/stats')).data,
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

  const goal = goalOption(user.training_goal)
  const level = levelLabel(user.experience_level)
  const visibility = visibilityOption(user.profile_visibility)
  const completion = profileCompletion(user)
  const facts = [
    user.location ? `📍 ${user.location}` : null,
    user.age != null ? `🎂 ${user.age} años` : null,
    user.height_cm ? `📏 ${user.height_cm} cm` : null,
    user.gym_name ? `🏟️ ${user.gym_name}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="rounded-3xl border border-evo-border/60 bg-evo-surface p-5">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} url={user.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight">{user.name}</h1>
            {user.username ? (
              <p className="truncate text-sm font-semibold text-evo-accent">@{user.username}</p>
            ) : (
              <Link to="/profile/edit" className="text-sm font-semibold text-evo-muted underline underline-offset-4">
                Elige tu @usuario
              </Link>
            )}
            {user.member_since ? (
              <p className="mt-1 text-xs text-evo-muted">En EvoFit desde {formatMonthYear(user.member_since)}</p>
            ) : null}
          </div>
        </div>

        {user.bio ? <p className="mt-4 whitespace-pre-line text-[0.95rem] leading-relaxed">{user.bio}</p> : null}

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
            {level ? (
              <span className="rounded-full bg-evo-lime/15 px-3 py-1.5 text-sm font-bold text-evo-lime">{level}</span>
            ) : null}
          </div>
        ) : null}

        <Link to="/profile/edit" className={buttonClasses({ variant: 'secondary', fullWidth: true, className: 'mt-5' })}>
          Editar perfil
        </Link>
      </section>

      <Link
        to={pendingRequests > 0 ? '/friends?tab=requests' : '/friends'}
        className="flex min-h-16 items-center gap-3 rounded-3xl border border-evo-border/60 bg-evo-surface px-4 transition active:scale-[0.99]"
      >
        <span className="text-2xl" aria-hidden>
          👥
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Amigos</span>
          <span className="block text-sm text-evo-muted">
            {friends.data ? `${friends.data.length} ${friends.data.length === 1 ? 'amigo' : 'amigos'}` : 'Tus amigos en EvoFit'}
          </span>
        </span>
        {pendingRequests > 0 ? (
          <span className="rounded-full bg-evo-accent px-2.5 py-1 text-xs font-bold text-[#1a120c]">
            {pendingRequests} {pendingRequests === 1 ? 'solicitud' : 'solicitudes'}
          </span>
        ) : null}
        <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
      </Link>

      {completion.done < completion.total ? (
        <Link
          to="/profile/edit"
          className="block rounded-3xl border-2 border-dashed border-evo-accent/50 bg-evo-accent/5 p-4 transition active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold">Completa tu perfil</p>
            <p className="text-sm font-bold tabular-nums text-evo-accent">
              {completion.done}/{completion.total}
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-evo-surface-2" aria-hidden>
            <div
              className="h-full rounded-full bg-evo-accent transition-[width]"
              style={{ width: `${(completion.done / completion.total) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-evo-muted">Así te reconocerán tus amigos cuando te busquen.</p>
        </Link>
      ) : null}

      <section aria-label="Estadísticas" className="rounded-3xl border border-evo-border/60 bg-evo-surface p-4">
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-evo-muted">Tus números</h2>
        {stats.isError ? (
          <p className="px-1 text-sm text-evo-muted">No se han podido cargar ahora mismo.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <StatTile value={stats.data?.total_workouts ?? '–'} label="Entrenos" />
            <StatTile value={stats.data?.month_workouts ?? '–'} label="Este mes" />
            <StatTile
              value={stats.data ? `${stats.data.streak_weeks} sem` : '–'}
              label={stats.data && stats.data.best_streak_weeks > 0 ? `Racha · mejor ${stats.data.best_streak_weeks}` : 'Racha'}
            />
          </div>
        )}
      </section>

      <ProfilePosts userId={user.id} emptyText="Cuando termines un entreno, compártelo con tus amigos y aparecerá aquí." />

      <section className="rounded-3xl border border-evo-border/60 bg-evo-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-evo-muted">Privacidad</h2>
            <p className="mt-1 font-bold">{visibility.label}</p>
            <p className="text-sm text-evo-muted">{visibility.hint}</p>
          </div>
          <Link to="/profile/edit#privacidad" className="shrink-0 text-sm font-bold text-evo-accent">
            Cambiar
          </Link>
        </div>
      </section>

      <section aria-label="Ajustes" className="space-y-4 rounded-3xl border border-evo-border/60 bg-evo-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-evo-muted">Ajustes</h2>
        <ThemeSwitch />
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-evo-surface-2 px-4 py-3">
          <span>
            <span className="block font-semibold">Avisos por email</span>
            <span className="block text-sm text-evo-muted">Te escribimos cuando alguien quiera ser tu amigo.</span>
          </span>
          <input
            type="checkbox"
            checked={user.email_notifications}
            disabled={emailPref.isPending}
            onChange={(e) => emailPref.mutate(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-evo-accent"
          />
        </label>
        <div className="divide-y divide-evo-border/40 overflow-hidden rounded-2xl bg-evo-surface-2">
          <Link to="/profile/edit#cuenta" className="flex min-h-13 items-center justify-between gap-3 px-4 font-semibold">
            <span className="min-w-0">
              <span className="block">Cuenta y contraseña</span>
              <span className="block truncate text-sm font-normal text-evo-muted">{user.email}</span>
            </span>
            <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
          </Link>
          <Link to="/instalar" className="flex min-h-13 items-center justify-between gap-3 px-4 font-semibold">
            Instalar la app en el móvil
            <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl font-bold text-evo-danger transition hover:bg-evo-danger/10 active:scale-[0.98]"
        >
          <Icon name="logout" className="h-5 w-5" />
          Cerrar sesión
        </button>
      </section>
    </div>
  )
}
