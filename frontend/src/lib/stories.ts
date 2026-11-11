import { queryOptions } from '@tanstack/react-query'
import { api } from './api'
import type { PostAuthor } from './feed'
import { queryClient } from './queryClient'

export type StoryBackground = 'energy' | 'lime' | 'night' | 'fire'

export type StoryStickers = { today: string | null; gym: string | null; streak: number | null }

export type Story = {
  id: number
  photo_url: string | null
  background: StoryBackground | null
  text: string | null
  stickers: StoryStickers
  created_at: string
  expires_at: string
  seen: boolean
}

export type StoryGroup = { user: PostAuthor; mine: boolean; has_unseen: boolean; latest_at: string; stories: Story[] }

/** Fondos de la paleta de EvoFit para historias sin foto. */
export const STORY_BACKGROUNDS: Record<StoryBackground, { label: string; className: string; dark: boolean }> = {
  energy: { label: 'Energía', className: 'bg-gradient-to-br from-[#ffb347] via-[#ff8a4c] to-[#e8553d]', dark: true },
  lime: { label: 'Lima', className: 'bg-gradient-to-br from-[#d9fb8f] via-[#b6f36a] to-[#6fcf3f]', dark: true },
  night: { label: 'Noche', className: 'bg-gradient-to-br from-[#2b3a55] via-[#161e29] to-[#0c1219]', dark: false },
  fire: { label: 'Fuego', className: 'bg-gradient-to-br from-[#ff5f6d] via-[#e8553d] to-[#7a1f3d]', dark: false },
}

export const storiesQuery = queryOptions({
  queryKey: ['stories'],
  queryFn: async () => (await api.get<{ data: StoryGroup[] }>('/stories')).data.data,
  refetchInterval: 60_000,
  refetchOnWindowFocus: true,
})

export const stickersQuery = queryOptions({
  queryKey: ['stories', 'stickers'],
  queryFn: async () => (await api.get<{ data: StoryStickers }>('/stories/stickers')).data.data,
  staleTime: 0,
})

export const storyViewersQuery = (storyId: number) =>
  queryOptions({
    queryKey: ['story-viewers', storyId],
    queryFn: async () => (await api.get<{ data: Array<PostAuthor & { viewed_at: string }> }>(`/stories/${storyId}/viewers`)).data.data,
  })

export type NewStory = {
  photo: File | null
  background: StoryBackground
  text: string
  gym: string
  showToday: boolean
  showStreak: boolean
}

export async function publishStory(input: NewStory) {
  const body = new FormData()
  if (input.photo) body.append('photo', input.photo)
  else body.append('background', input.background)
  body.append('text', input.text)
  body.append('gym', input.gym)
  body.append('show_today', input.showToday ? '1' : '0')
  body.append('show_streak', input.showStreak ? '1' : '0')
  await api.post('/stories', body)
  await queryClient.invalidateQueries({ queryKey: ['stories'] })
}

/** Marca como vista (sin esperar) y lo refleja al momento en la barra. */
export function markStorySeen(storyId: number) {
  queryClient.setQueryData<StoryGroup[]>(['stories'], (groups) =>
    groups?.map((group) => {
      const stories = group.stories.map((s) => (s.id === storyId ? { ...s, seen: true } : s))
      return { ...group, stories, has_unseen: stories.some((s) => !s.seen) }
    }),
  )
  void api.post(`/stories/${storyId}/view`).catch(() => undefined)
}

export async function deleteStory(storyId: number) {
  await api.delete(`/stories/${storyId}`)
  await queryClient.invalidateQueries({ queryKey: ['stories'] })
}

export async function replyToStory(storyId: number, content: { body?: string; reaction?: string }) {
  const { data } = await api.post<{ conversation_id: number }>(`/stories/${storyId}/reply`, content)
  void queryClient.invalidateQueries({ queryKey: ['conversations'] })
  return data.conversation_id
}
