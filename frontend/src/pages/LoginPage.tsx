import axios from 'axios'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { useAuth } from '../features/auth/AuthContext'
import { AuthLayout, FormError, SubmitButton } from '../features/auth/AuthLayout'

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined
    const firstFieldError = data?.errors
      ? Object.values(data.errors).flat()[0]
      : undefined
    if (firstFieldError) return firstFieldError
    if (data?.message) return data.message
    if (error.response?.status === 419) {
      return 'La sesión expiró. Recarga la página e inténtalo de nuevo.'
    }
  }
  // Sin respuesta del servidor: es la conexión, no la contraseña.
  if (axios.isAxiosError(error) && !error.response) return 'Sin conexión. Comprueba la cobertura e inténtalo de nuevo.'
  return 'No pudimos iniciar sesión. Revisa tu email y contraseña.'
}

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Hola de nuevo"
      subtitle="Entra para seguir con tu entreno."
      panelTitle={
        <>
          Tu entreno
          <br />
          te espera
        </>
      }
      highlights={['Tu rutina y tu agenda, al día', 'Tus récords y tu progreso', 'La liga de la semana con tus amigos']}
      footer={
        <>
          ¿Primera vez?{' '}
          <Link to="/register" className="font-bold text-evo-accent">
            Crear cuenta gratis
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="next"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordInput
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          enterKeyHint="go"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <FormError message={error} />
        <SubmitButton busy={submitting} busyLabel="Entrando…">
          Iniciar sesión
        </SubmitButton>
      </form>
    </AuthLayout>
  )
}
