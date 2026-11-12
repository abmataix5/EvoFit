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
    <div className="no-x-scroll grid min-h-svh place-items-center px-5 py-6">
      <div className="flex w-full max-w-md -translate-y-6 flex-col items-center">
        <Link to="/" aria-label="Volver a la portada de EvoFit" className="transition active:scale-95">
          <BrandLogo size="lg" className="evo-pop" decorative />
        </Link>
        <h1 className="mt-3 font-display text-5xl font-extrabold uppercase leading-none">
          Evo<span className="text-evo-accent">Fit</span>
        </h1>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-evo-muted">Entrena · Mejora · Evoluciona</p>

        <form onSubmit={onSubmit} className="evo-enter panel mt-6 w-full space-y-4 p-5">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
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
          {error ? (
            <p className="text-base font-semibold text-evo-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" fullWidth disabled={submitting}>
            {submitting ? 'Entrando…' : 'Iniciar sesión'}
          </Button>
        </form>

        <p className="mt-5 text-center text-base text-evo-muted">
          ¿Primera vez?{' '}
          <Link to="/register" className="font-bold text-evo-accent">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  )
}
