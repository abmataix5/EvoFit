import { queryOptions } from '@tanstack/react-query'
import { api, type ExperienceLevel, type ProfileStats, type ProfileVisibility, type TrainingGoal } from './api'
import { queryClient } from './queryClient'

/** Relación de quien mira con esa persona. */
export type Relation = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends'

export type PersonCard = {
  id: number
  name: string
  username: string | null
  avatar_url: string | null
  location: string | null
  relation: Relation
  friendship_id: number | null
}

export type PersonProfile = PersonCard & {
  bio: string | null
  age: number | null
  gym_name: string | null
  experience_level: ExperienceLevel | null
  training_goal: TrainingGoal | null
  member_since: string | null
  profile_visibility: ProfileVisibility
  friends_count: number
  can_view_activity: boolean
  blocked_by_me: boolean
  stats: ProfileStats | null
}

export type FriendRequest = { id: number; created_at: string; user: PersonCard }

export type AppNotification = {
  id: string
  kind: 'friend_request' | 'friend_accepted' | string
  read: boolean
  created_at: string
  actor: PersonCard
  friendship_id: number | null
  pending: boolean
  post_id: number | null
  excerpt: string | null
}

export const personQuery = (id: number) =>
  queryOptions({
    queryKey: ['person', id],
    queryFn: async () => (await api.get<{ data: PersonProfile }>(`/people/${id}`)).data.data,
  })

export const friendsQuery = queryOptions({
  queryKey: ['friends'],
  queryFn: async () => (await api.get<{ data: PersonCard[] }>('/friends')).data.data,
})

export const friendRequestsQuery = queryOptions({
  queryKey: ['friend-requests'],
  queryFn: async () => (await api.get<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>('/friend-requests')).data,
})

export const notificationsQuery = queryOptions({
  queryKey: ['notifications'],
  queryFn: async () => (await api.get<{ data: AppNotification[]; unread: number }>('/notifications')).data,
})

/** Contador de la campana: se refresca solo cada minuto y al volver a la app. */
export const unreadCountQuery = queryOptions({
  queryKey: ['notifications', 'unread'],
  queryFn: async () => (await api.get<{ unread: number }>('/notifications/unread-count')).data.unread,
  refetchInterval: 60_000,
  refetchOnWindowFocus: true,
  staleTime: 30_000,
})

export const peopleSearchQuery = (term: string) =>
  queryOptions({
    queryKey: ['people-search', term],
    queryFn: async () => (await api.get<{ data: PersonCard[] }>('/people/search', { params: { q: term } })).data.data,
    enabled: term.trim().replace(/^@/, '').length >= 2,
    staleTime: 15_000,
  })

export type FriendAction = 'add' | 'cancel' | 'accept' | 'decline' | 'unfriend'

/** Ejecuta una acción de amistad y refresca todo lo que depende de ella. */
export async function friendAction(person: Pick<PersonCard, 'id' | 'friendship_id'>, action: FriendAction): Promise<PersonCard> {
  const request = {
    add: () => api.post<{ data: PersonCard }>('/friend-requests', { user_id: person.id }),
    accept: () => api.post<{ data: PersonCard }>(`/friend-requests/${person.friendship_id}/accept`),
    cancel: () => api.delete<{ data: PersonCard }>(`/friend-requests/${person.friendship_id}`),
    decline: () => api.delete<{ data: PersonCard }>(`/friend-requests/${person.friendship_id}`),
    unfriend: () => api.delete<{ data: PersonCard }>(`/friends/${person.id}`),
  }[action]
  const { data } = await request()
  await refreshSocial(person.id)
  return data.data
}

export async function refreshSocial(personId?: number) {
  await Promise.all([
    personId ? queryClient.invalidateQueries({ queryKey: ['person', personId] }) : null,
    queryClient.invalidateQueries({ queryKey: ['friends'] }),
    queryClient.invalidateQueries({ queryKey: ['friend-requests'] }),
    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    queryClient.invalidateQueries({ queryKey: ['people-search'] }),
  ])
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'ahora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
