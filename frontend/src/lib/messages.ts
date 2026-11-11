import { queryOptions } from '@tanstack/react-query'
import { api } from './api'
import type { PostAuthor } from './feed'
import type { StoryBackground } from './stories'
import { queryClient } from './queryClient'

export type ConversationSummary = {
  id: number
  user: PostAuthor | null
  can_message: boolean
  last_message: { mine: boolean; preview: string; created_at: string } | null
  unread: number
}

export type ChatMessage = {
  id: number
  mine: boolean
  body: string | null
  reaction: string | null
  story_reply: boolean
  story: { id: number; photo_url: string | null; background: StoryBackground | null; text: string | null; owner_id: number } | null
  created_at: string
}

export const conversationsQuery = queryOptions({
  queryKey: ['conversations'],
  queryFn: async () => (await api.get<{ data: ConversationSummary[] }>('/conversations')).data.data,
  refetchInterval: 15_000,
  refetchOnWindowFocus: true,
})

/** Contador del icono de mensajes: conversaciones con algo sin leer. */
export const unreadMessagesQuery = queryOptions({
  queryKey: ['conversations', 'unread'],
  queryFn: async () => (await api.get<{ unread: number }>('/conversations/unread-count')).data.unread,
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,
  staleTime: 15_000,
})

export const conversationQuery = (id: number) =>
  queryOptions({
    queryKey: ['conversation', id],
    queryFn: async () => (await api.get<{ data: ConversationSummary }>(`/conversations/${id}`)).data.data,
  })

export async function fetchMessages(conversationId: number, params: { before?: number; after?: number } = {}) {
  return (await api.get<{ data: ChatMessage[]; has_more: boolean }>(`/conversations/${conversationId}/messages`, { params })).data
}

export async function sendMessage(conversationId: number, body: string) {
  return (await api.post<{ data: ChatMessage }>(`/conversations/${conversationId}/messages`, { body })).data.data
}

export async function markConversationRead(conversationId: number) {
  await api.post(`/conversations/${conversationId}/read`)
  void queryClient.invalidateQueries({ queryKey: ['conversations'] })
}

/** Abre (o crea) la conversación con un amigo y devuelve su id. */
export async function openConversation(userId: number) {
  return (await api.post<{ data: ConversationSummary }>('/conversations', { user_id: userId })).data.data.id
}
