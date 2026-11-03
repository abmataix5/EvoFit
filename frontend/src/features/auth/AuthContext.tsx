import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, ensureCsrfCookie, UNAUTHORIZED_EVENT, type User } from '../../lib/api'
import { queryClient } from '../../lib/queryClient'
import { clearAllWorkoutDrafts } from '../../lib/workoutDrafts'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: {
    name: string
    email: string
    password: string
    password_confirmation: string
    workspace_name?: string
  }) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: User }>('/auth/me')
      setUser(data.data)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await refreshUser()
      setLoading(false)
    })()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    await ensureCsrfCookie()
    const { data } = await api.post<{ user: User }>('/auth/login', { email, password })
    queryClient.clear()
    setUser(data.user)
  }, [])

  const register = useCallback(
    async (payload: {
      name: string
      email: string
      password: string
      password_confirmation: string
      workspace_name?: string
    }) => {
      await ensureCsrfCookie()
      const { data } = await api.post<{ user: User }>('/auth/register', payload)
      setUser(data.user)
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Aunque falle la red, se sale igualmente en este dispositivo.
    } finally {
      // Nada del usuario anterior debe quedar visible a quien entre después en este móvil.
      queryClient.clear()
      clearAllWorkoutDrafts()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    function onUnauthorized() {
      queryClient.clear()
      setUser(null)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}
