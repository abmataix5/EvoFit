import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/icons/Icon'
import { useAuth } from '../features/auth/AuthContext'
import { ProfileView } from '../features/profile/ProfileView'
import { profileCompletion } from '../features/profile/profileOptions'
import { StoryViewer } from '../features/stories/StoryViewer'
import { friendRequestsQuery, personQuery, type PersonProfile } from '../lib/social'
import { storiesQuery } from '../lib/stories'

const actionClass =
  'flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-3 text-sm font-bold transition active:scale-[0.97]'

/** Tu ficha de atleta. La configuración está en su propio apartado (botón de ajustes). */
export function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const profile = useQuery({ ...personQuery(user?.id ?? 0), enabled: Boolean(user) })
  const requests = useQuery(friendRequestsQuery)
  const storyGroup = useQuery({ ...storiesQuery, select: (groups) => groups.find((g) => g.mine) }).data
  const [viewingStory, setViewingStory] = useState(false)

  if (!user) return null
  if (profile.isError && !profile.data) {
    return (
      <div className="mx-auto max-w-md space-y-2 py-10 text-center">
        <p className="font-display text-2xl font-bold">No se ha podido cargar tu perfil</p>
        <p className="text-sm text-evo-muted">Revisa la conexión e inténtalo de nuevo.</p>
        <button type="button" onClick={() => void profile.refetch()} className="min-h-11 px-4 text-sm font-bold text-evo-accent">
          Reintentar
        </button>
      </div>
    )
  }
  if (!profile.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-3" role="status" aria-label="Cargando perfil">
        <div className="evo-skeleton h-56 rounded-3xl" />
        <div className="grid grid-cols-3 gap-2">
          <div className="evo-skeleton h-[4.5rem] rounded-2xl" />
          <div className="evo-skeleton h-[4.5rem] rounded-2xl" />
          <div className="evo-skeleton h-[4.5rem] rounded-2xl" />
        </div>
      </div>
    )
  }

  // Lo editable sale de la sesión (se ve al momento tras editar); cifras y amigos, del perfil.
  const person: PersonProfile = {
    ...profile.data,
    name: user.name,
    username: user.username,
    avatar_url: user.avatar_url,
    bio: user.bio,
    location: user.location,
    gym_name: user.gym_name,
    experience_level: user.experience_level,
    training_goal: user.training_goal,
    profile_visibility: user.profile_visibility,
    age: user.age,
    height_cm: user.height_cm,
  }
  const pending = requests.data?.incoming.length ?? 0
  const completion = profileCompletion(user)

  return (
    <>
      <ProfileView
        person={person}
        isSelf
        onMenu={() => navigate('/settings')}
        storyGroup={storyGroup}
        onOpenStory={() => setViewingStory(true)}
        onFriends={() => navigate('/friends')}
        actions={
          <div className="flex gap-2">
            <Link to="/profile/edit" className={actionClass}>
              Editar perfil
            </Link>
            <Link to={pending > 0 ? '/friends?tab=requests' : '/friends'} className={actionClass}>
              Amigos
              {pending > 0 ? (
                <span className="rounded-full bg-evo-accent px-1.5 py-0.5 text-[0.7rem] font-bold text-[#1a120c]">{pending}</span>
              ) : null}
            </Link>
          </div>
        }
        notice={
          completion.done < completion.total ? (
            <Link to="/profile/edit" className="flex items-center gap-3 rounded-2xl bg-evo-accent/10 px-4 py-3 transition active:scale-[0.99]">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden>
                <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-evo-surface-2" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className="stroke-evo-accent"
                    strokeDasharray={`${(completion.done / completion.total) * 97.4} 97.4`}
                  />
                </svg>
                <span className="text-xs font-bold tabular-nums">
                  {completion.done}/{completion.total}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Completa tu perfil</span>
                <span className="block text-sm text-evo-muted">Foto, bio y objetivo: así te reconocen tus amigos.</span>
              </span>
              <Icon name="chevron" className="h-4 w-4 shrink-0 text-evo-muted" />
            </Link>
          ) : null
        }
      />

      {viewingStory && storyGroup ? <StoryViewer groups={[storyGroup]} startGroup={0} onClose={() => setViewingStory(false)} /> : null}
    </>
  )
}
