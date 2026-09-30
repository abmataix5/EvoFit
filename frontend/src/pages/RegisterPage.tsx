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
  return 'No pudimos crear tu cuenta. Revisa los datos e inténtalo de nuevo.'
}

export function RegisterPage() {
  const { user, loading, register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    if (password !== passwordConfirmation) {
      setError('Las contraseñas no coinciden.')
      setSubmitting(false)
      return
    }

    try {
      await register({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      })
      navigate('/')
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="no-x-scroll grid min-h-svh place-items-center px-5 py-6">
      <div className="flex w-full max-w-md -translate-y-4 flex-col items-center">
        <BrandLogo size="md" />
        <h1 className="mt-4 text-center font-display text-3xl font-bold tracking-tight">Crea tu cuenta</h1>
        <p className="mt-1 text-center text-base text-evo-muted">Empieza a registrar entrenos.</p>

      <form onSubmit={onSubmit} className="panel mt-6 w-full space-y-4 p-5">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          value={passwordConfirmation}
          onChange={(e) => setPasswordConfirmation(e.target.value)}
          required
        />
        {error ? (
          <p className="text-sm font-semibold text-evo-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear cuenta'}
        </Button>
      </form>

      <p className="mt-5 text-center text-base text-evo-muted">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-bold text-evo-accent">
          Iniciar sesión
        </Link>
      </p>
      </div>
    </div>
  )
}
