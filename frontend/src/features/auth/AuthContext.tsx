import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isAxiosError } from 'axios'
import { api, ensureCsrfCookie, UNAUTHORIZED_EVENT, type User } from '../../lib/api'
import { queryClient } from '../../lib/queryClient'
import { clearAllWorkoutDrafts } from '../../lib/workoutDrafts'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: {
    name: string
    username: string
    email: string
    password: string
    password_confirmation: string
    workspace_name?: string
  }) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  /** Sustituye el usuario tras editar el perfil (la API devuelve el usuario actualizado). */
  setCurrentUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const USER_KEY = 'evofit:user'

/** Última sesión conocida en este móvil: permite abrir la app sin cobertura (en el gimnasio). */
function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function storeUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch {
    // Sin almacenamiento (modo privado): la sesión funciona igual con conexión.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const setUser = useCallback((next: User | null) => {
    storeUser(next)
    setUserState(next)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: User }>('/auth/me')
      setUser(data.data)
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined
      // Solo se cierra la sesión si el servidor dice que no la hay. Sin red o con el servidor caído
      // se sigue con la última sesión conocida: antes te mandaba a la pantalla de entrar.
      if (status === 401 || status === 419) setUser(null)
      else setUserState(readStoredUser())
    }
  }, [setUser])

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
  }, [setUser])

  const register = useCallback(
    async (payload: {
      name: string
      username: string
      email: string
      password: string
      password_confirmation: string
      workspace_name?: string
    }) => {
      await ensureCsrfCookie()
      const { data } = await api.post<{ user: User }>('/auth/register', payload)
      setUser(data.user)
    },
    [setUser],
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
  }, [setUser])

  useEffect(() => {
    function onUnauthorized() {
      queryClient.clear()
      setUser(null)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [setUser])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser, setCurrentUser: setUser }),
    [user, loading, login, register, logout, refreshUser, setUser],
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
