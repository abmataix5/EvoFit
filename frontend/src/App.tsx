import { QueryClientProvider } from '@tanstack/react-query'
import { Component, lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BrandLogo } from './components/BrandLogo'
import { UiFeedbackProvider } from './components/feedback/UiFeedback'
import { AppShell } from './components/layout/AppShell'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import { queryClient } from './lib/queryClient'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

// Cada página se descarga cuando se abre: el primer arranque en el móvil pesa mucho menos.
// Si tras un despliegue ya no existe el trozo antiguo, se recarga una vez para coger la versión nueva.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(async () => {
    try {
      const mod = await load()
      sessionStorage.removeItem('evofit:chunk-reload')
      return { default: mod[name] }
    } catch (error) {
      if (!sessionStorage.getItem('evofit:chunk-reload')) {
        sessionStorage.setItem('evofit:chunk-reload', '1')
        window.location.reload()
        return { default: () => null }
      }
      throw error
    }
  })

const CalendarPage = page(() => import('./pages/CalendarPage'), 'CalendarPage')
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage')
const ExercisesPage = page(() => import('./pages/ExercisesPage'), 'ExercisesPage')
const ExerciseHistoryPage = page(() => import('./pages/ExerciseHistoryPage'), 'ExerciseHistoryPage')
const InstallPage = page(() => import('./pages/InstallPage'), 'InstallPage')
const NewRoutinePage = page(() => import('./pages/NewRoutinePage'), 'NewRoutinePage')
const EditProfilePage = page(() => import('./pages/EditProfilePage'), 'EditProfilePage')
const ProfilePage = page(() => import('./pages/ProfilePage'), 'ProfilePage')
const LeaguePage = page(() => import('./pages/LeaguePage'), 'LeaguePage')
const FriendsPage = page(() => import('./pages/FriendsPage'), 'FriendsPage')
const PersonProfilePage = page(() => import('./pages/PersonProfilePage'), 'PersonProfilePage')
const PostDetailPage = page(() => import('./pages/PostDetailPage'), 'PostDetailPage')
const MessagesPage = page(() => import('./pages/MessagesPage'), 'MessagesPage')
const ChatPage = page(() => import('./pages/ChatPage'), 'ChatPage')
const SettingsPage = page(() => import('./pages/SettingsPage'), 'SettingsPage')
const NotificationsPage = page(() => import('./pages/NotificationsPage'), 'NotificationsPage')
const SearchPage = page(() => import('./pages/SearchPage'), 'SearchPage')
const ProgressPage = page(() => import('./pages/ProgressPage'), 'ProgressPage')
const RoutineDetailPage = page(() => import('./pages/RoutineDetailPage'), 'RoutineDetailPage')
const RoutinesPage = page(() => import('./pages/RoutinesPage'), 'RoutinesPage')
const WorkoutSessionPage = page(() => import('./pages/WorkoutSessionPage'), 'WorkoutSessionPage')

/**
 * Red de seguridad: si una pantalla falla al pintarse (o no se puede descargar tras una actualización),
 * se ofrece recargar en vez de dejar la app en blanco.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
        <BrandLogo size="md" decorative />
        <div>
          <p className="font-display text-3xl font-extrabold uppercase">Algo ha fallado</p>
          <p className="mt-1 text-evo-muted">Tus entrenos están a salvo. Recarga para continuar.</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-14 rounded-2xl bg-evo-accent px-8 text-lg font-extrabold text-[#1a120c] transition active:scale-95"
        >
          Recargar
        </button>
      </div>
    )
  }
}

function PageFallback() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3" role="status" aria-label="Cargando">
      <BrandLogo size="md" className="evo-pop" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-evo-bg">
        <BrandLogo size="md" className="evo-pop" />
        <p className="text-sm text-evo-muted" role="status">
          Cargando…
        </p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <UiFeedbackProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/instalar" element={<InstallPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="routines" element={<RoutinesPage />} />
                <Route path="routines/new" element={<NewRoutinePage />} />
                <Route path="routines/:id" element={<RoutineDetailPage />} />
                <Route path="routines/:id/edit" element={<NewRoutinePage />} />
                <Route path="exercise-history/:routineExerciseId" element={<ExerciseHistoryPage />} />
                <Route path="exercises" element={<ExercisesPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="progress" element={<ProgressPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="profile/edit" element={<EditProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="friends" element={<FriendsPage />} />
                <Route path="league" element={<LeaguePage />} />
                <Route path="u/:id" element={<PersonProfilePage />} />
                <Route path="posts/:id" element={<PostDetailPage />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="messages/:id" element={<ChatPage />} />
                <Route path="workout/:id" element={<WorkoutSessionPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </UiFeedbackProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  )
}
