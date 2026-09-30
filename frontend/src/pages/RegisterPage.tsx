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
    <div className="no-x-scroll mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 py-10">
      <div className="mb-7 flex w-full flex-col items-center gap-4 text-center">
        <BrandLogo size="lg" showTagline />
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold tracking-tight">Crea tu espacio</h1>
          <p className="text-sm text-evo-muted">Empieza a registrar entrenos en menos de un minuto.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="panel w-full space-y-4 p-5">
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

      <p className="mt-5 text-center text-sm text-evo-muted">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold text-evo-accent">
          Iniciar sesión
        </Link>
      </p>
    </div>
  )
}
