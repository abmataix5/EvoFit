import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
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
const FriendsPage = page(() => import('./pages/FriendsPage'), 'FriendsPage')
const PersonProfilePage = page(() => import('./pages/PersonProfilePage'), 'PersonProfilePage')
const PostDetailPage = page(() => import('./pages/PostDetailPage'), 'PostDetailPage')
const NotificationsPage = page(() => import('./pages/NotificationsPage'), 'NotificationsPage')
const SearchPage = page(() => import('./pages/SearchPage'), 'SearchPage')
const ProgressPage = page(() => import('./pages/ProgressPage'), 'ProgressPage')
const RoutineDetailPage = page(() => import('./pages/RoutineDetailPage'), 'RoutineDetailPage')
const RoutinesPage = page(() => import('./pages/RoutinesPage'), 'RoutinesPage')
const WorkoutSessionPage = page(() => import('./pages/WorkoutSessionPage'), 'WorkoutSessionPage')

function PageFallback() {
  return <p className="text-sm text-evo-muted">Cargando…</p>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-evo-bg">
        <BrandLogo size="md" />
        <p className="text-sm text-evo-muted">Cargando…</p>
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
                <Route path="search" element={<SearchPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="friends" element={<FriendsPage />} />
                <Route path="u/:id" element={<PersonProfilePage />} />
                <Route path="posts/:id" element={<PostDetailPage />} />
                <Route path="workout/:id" element={<WorkoutSessionPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </UiFeedbackProvider>
    </QueryClientProvider>
  )
}
