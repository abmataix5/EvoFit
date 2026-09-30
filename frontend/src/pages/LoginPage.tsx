import axios from 'axios'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../features/auth/AuthContext'

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined
    const firstFieldError = data?.errors
      ? Object.values(data.errors).flat()[0]
      : undefined
    if (firstFieldError) {
      return firstFieldError
    }
    if (data?.message) {
      return data.message
    }
    if (error.response?.status === 419) {
      return 'La sesión expiró. Recarga la página e inténtalo de nuevo.'
    }
  }
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
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-8 lg:max-w-xl">
      <div className="mb-8 space-y-4">
        <BrandLogo size="lg" showTagline className="mx-auto" />
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Bienvenido de nuevo</h1>
          <p className="text-sm text-evo-muted">Tu progreso en el gym, sesión a sesión.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="panel space-y-4 p-5">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="text-sm font-semibold text-evo-danger" role="alert">{error}</p> : null}
        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? 'Entrando…' : 'Iniciar sesión'}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-evo-muted">
        ¿Primera vez?{' '}
        <Link to="/register" className="font-semibold text-evo-accent">
          Crear cuenta
        </Link>
      </p>
    </div>
  )
}
