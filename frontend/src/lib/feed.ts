import { infiniteQueryOptions, queryOptions, type InfiniteData } from '@tanstack/react-query'
import { api } from './api'
import { queryClient } from './queryClient'

export type PostAuthor = { id: number; name: string; username: string | null; avatar_url: string | null }

export type PostSummaryExercise = {
  name: string
  image_url: string | null
  sets: number
  best: string
  record: { weight_kg: number; previous_kg: number } | null
}

export type PostSummary = {
  title: string
  routine_name: string | null
  trained_on: string | null
  duration_minutes: number | null
  sets: number
  volume_kg: number
  exercises: PostSummaryExercise[]
  records: string[]
}

export type PostComment = { id: number; body: string; created_at: string; author: PostAuthor; can_delete: boolean }

export type Post = {
  id: number
  author: PostAuthor
  created_at: string
  caption: string | null
  gym_name: string | null
  photo_url: string | null
  summary: PostSummary
  likes_count: number
  comments_count: number
  liked_by_me: boolean
  comments_preview: PostComment[]
  mine: boolean
  workout_session_id: number | null
}

type Page = { data: Post[]; next_before: number | null }

export const feedQuery = infiniteQueryOptions({
  queryKey: ['feed'],
  queryFn: async ({ pageParam }) => (await api.get<Page>('/feed', { params: pageParam ? { before: pageParam } : {} })).data,
  initialPageParam: null as number | null,
  getNextPageParam: (last) => last.next_before,
  refetchOnWindowFocus: true,
})

export const personPostsQuery = (userId: number) =>
  infiniteQueryOptions({
    queryKey: ['person-posts', userId],
    queryFn: async ({ pageParam }) =>
      (await api.get<Page>(`/people/${userId}/posts`, { params: pageParam ? { before: pageParam } : {} })).data,
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next_before,
    retry: false,
  })

export const postQuery = (id: number) =>
  queryOptions({
    queryKey: ['post', id],
    queryFn: async () => (await api.get<{ data: Post }>(`/posts/${id}`)).data.data,
  })

export const commentsQuery = (postId: number) =>
  queryOptions({
    queryKey: ['post-comments', postId],
    queryFn: async () => (await api.get<{ data: PostComment[] }>(`/posts/${postId}/comments`)).data.data,
  })

/** Aplica un cambio a una publicación en todas las listas donde aparece (feed, perfiles, detalle). */
export function patchPost(postId: number, patch: (post: Post) => Post) {
  for (const key of [['feed'], ['person-posts']]) {
    queryClient.setQueriesData<InfiniteData<Page>>({ queryKey: key }, (data) =>
      data
        ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.map((p) => (p.id === postId ? patch(p) : p)) })) }
        : data,
    )
  }
  queryClient.setQueryData<Post>(['post', postId], (post) => (post ? patch(post) : post))
}

export function removePostEverywhere(postId: number) {
  for (const key of [['feed'], ['person-posts']]) {
    queryClient.setQueriesData<InfiniteData<Page>>({ queryKey: key }, (data) =>
      data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.filter((p) => p.id !== postId) })) } : data,
    )
  }
  queryClient.removeQueries({ queryKey: ['post', postId] })
}

/** "Me gusta" optimista: se ve al instante y se corrige si el servidor dice otra cosa. */
export async function toggleLike(post: Post) {
  const like = !post.liked_by_me
  patchPost(post.id, (p) => ({ ...p, liked_by_me: like, likes_count: Math.max(0, p.likes_count + (like ? 1 : -1)) }))
  try {
    const { data } = like
      ? await api.post<{ likes_count: number; liked_by_me: boolean }>(`/posts/${post.id}/like`)
      : await api.delete<{ likes_count: number; liked_by_me: boolean }>(`/posts/${post.id}/like`)
    patchPost(post.id, (p) => ({ ...p, liked_by_me: data.liked_by_me, likes_count: data.likes_count }))
  } catch (error) {
    patchPost(post.id, (p) => ({ ...p, liked_by_me: post.liked_by_me, likes_count: post.likes_count }))
    throw error
  }
}

export type ShareInput = { caption: string; gym_name: string; photo: File | null; remove_photo?: boolean }

export async function shareWorkout(sessionId: number, input: ShareInput): Promise<Post> {
  const body = new FormData()
  body.append('caption', input.caption)
  body.append('gym_name', input.gym_name)
  if (input.photo) body.append('photo', input.photo)
  if (input.remove_photo) body.append('remove_photo', '1')
  const { data } = await api.post<{ data: Post }>(`/workout-sessions/${sessionId}/share`, body)
  await queryClient.invalidateQueries({ queryKey: ['feed'] })
  void queryClient.invalidateQueries({ queryKey: ['person-posts'] })
  return data.data
}
