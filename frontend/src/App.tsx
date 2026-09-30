import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BrandLogo } from './components/BrandLogo'
import { UiFeedbackProvider } from './components/feedback/UiFeedback'
import { AppShell } from './components/layout/AppShell'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import { CalendarPage } from './pages/CalendarPage'
import { DashboardPage } from './pages/DashboardPage'
import { ExercisesPage } from './pages/ExercisesPage'
import { LoginPage } from './pages/LoginPage'
import { NewRoutinePage } from './pages/NewRoutinePage'
import { ProgressPage } from './pages/ProgressPage'
import { RegisterPage } from './pages/RegisterPage'
import { RoutineDetailPage } from './pages/RoutineDetailPage'
import { RoutinesPage } from './pages/RoutinesPage'
import { WorkoutSessionPage } from './pages/WorkoutSessionPage'

const queryClient = new QueryClient()

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
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
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
                <Route path="exercises" element={<ExercisesPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="progress" element={<ProgressPage />} />
                <Route path="workout/:id" element={<WorkoutSessionPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </UiFeedbackProvider>
    </QueryClientProvider>
  )
}
