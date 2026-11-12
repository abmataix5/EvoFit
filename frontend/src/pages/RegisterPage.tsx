import axios from 'axios'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Icon } from '../components/icons/Icon'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { useAuth } from '../features/auth/AuthContext'
import { AuthLayout, FormError, SubmitButton } from '../features/auth/AuthLayout'
import { validationErrors } from '../lib/api'
import { LEGAL } from '../lib/legal'

const MIN_PASSWORD = 8
const USERNAME_FORMAT = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/

type Field = 'name' | 'username' | 'email' | 'password' | 'terms'

function generalError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Sin conexión. Comprueba la cobertura e inténtalo de nuevo.'
    if (error.response.status === 419) return 'La sesión expiró. Recarga la página e inténtalo de nuevo.'
    if (error.response.status === 429) return 'Demasiados intentos. Espera un minuto y vuelve a probar.'
  }
  return 'No pudimos crear tu cuenta. Inténtalo de nuevo.'
}

/** "Abel Mataix" → "abelmataix": una propuesta de alias a partir del nombre. */
function suggestUsername(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20)
}

/** Lo que se puede comprobar sin preguntar al servidor; el resto (alias o email ya usados) lo dice él. */
function checkFields(values: Record<Exclude<Field, 'terms'>, string> & { terms: boolean }): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {}
  if (values.name.trim().length < 2) errors.name = 'Escribe tu nombre.'
  if (values.username.length < 3) errors.username = 'El nombre de usuario necesita al menos 3 caracteres.'
  else if (!USERNAME_FORMAT.test(values.username)) errors.username = 'Solo letras, números, puntos y guiones bajos, y que empiece y acabe en letra o número.'
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = 'Escribe un email válido.'
  if (values.password.length < MIN_PASSWORD) errors.password = `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`
  if (!values.terms) errors.terms = `Marca la casilla: hay que tener ${LEGAL.minAge} años o más y aceptar las condiciones.`
  return errors
}

export function RegisterPage() {
  const { user, loading, register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  // Mientras no lo toque, el alias se propone a partir del nombre.
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  /** Al corregir un campo se le quita su aviso. */
  function clear(field: Field) {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    const found = checkFields({ name, username, email, password, terms })
    setErrors(found)
    const first = (['name', 'username', 'email', 'password', 'terms'] as const).find((field) => found[field])
    if (first) {
      // El foco va al primer campo con problema: se ve y se corrige sin buscar.
      document.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus()
      return
    }

    setSubmitting(true)
    try {
      // Hay un botón para ver la contraseña, así que no se pide escribirla dos veces.
      await register({ name: name.trim(), username, email: email.trim(), password, password_confirmation: password, terms })
      navigate('/')
    } catch (err) {
      const fromServer = validationErrors(err)
      if (Object.keys(fromServer).length > 0) {
        setErrors({ name: fromServer.name, username: fromServer.username, email: fromServer.email, password: fromServer.password, terms: fromServer.terms })
        const known = ['name', 'username', 'email', 'password', 'terms'].some((field) => fromServer[field])
        if (!known) setError(Object.values(fromServer)[0] ?? generalError(err))
      } else {
        setError(generalError(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const longEnough = password.length >= MIN_PASSWORD

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Un minuto y estás apuntando tu primer entreno."
      panelTitle={
        <>
          Empieza
          <br />
          a evolucionar
        </>
      }
      highlights={['Rutinas a tu medida y más de 200 ejercicios', 'Tu progreso, semana a semana', 'Liga semanal con tus amigos', 'Gratis y sin descargar nada']}
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-bold text-evo-accent">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          label="Nombre"
          name="name"
          autoComplete="name"
          enterKeyHint="next"
          placeholder="Tu nombre"
          value={name}
          error={errors.name}
          onChange={(e) => {
            setName(e.target.value)
            clear('name')
            if (!usernameTouched) setUsername(suggestUsername(e.target.value))
          }}
        />
        <Input
          label="Nombre de usuario"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="next"
          maxLength={30}
          placeholder="tu.alias"
          value={username}
          error={errors.username}
          onChange={(e) => {
            setUsernameTouched(true)
            clear('username')
            setUsername(e.target.value.toLowerCase().replace(/\s+/g, '').replace(/^@/, ''))
          }}
          hint={username ? `Tus amigos te encontrarán como @${username}` : 'Así te verán y te encontrarán tus amigos.'}
        />
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
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value)
            clear('email')
          }}
        />
        <div className="space-y-2">
          <PasswordInput
            label="Contraseña"
            name="password"
            autoComplete="new-password"
            enterKeyHint="go"
            value={password}
            error={errors.password}
            onChange={(e) => {
              setPassword(e.target.value)
              clear('password')
            }}
          />
          <p
            className={[
              'flex items-center gap-1.5 text-sm font-semibold transition-colors',
              longEnough ? 'text-evo-lime' : 'text-evo-muted',
              // Si ya hay un aviso de error bajo el campo, no se repite lo mismo.
              errors.password ? 'hidden' : '',
            ].join(' ')}
          >
            <span
              aria-hidden
              className={['flex h-5 w-5 items-center justify-center rounded-full', longEnough ? 'bg-evo-lime text-[#102000]' : 'border-2 border-evo-border'].join(' ')}
            >
              {longEnough ? <Icon name="check" className="h-3.5 w-3.5" /> : null}
            </span>
            Al menos {MIN_PASSWORD} caracteres
            <span className="sr-only">{longEnough ? ' (cumplido)' : ' (pendiente)'}</span>
          </p>
        </div>
        <div className="space-y-1.5">
          <label
            className={[
              'flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-4 py-3 transition-colors',
              errors.terms ? 'border-evo-danger' : terms ? 'border-evo-accent bg-evo-accent/10' : 'border-evo-border bg-evo-surface-2',
            ].join(' ')}
          >
            <input
              type="checkbox"
              name="terms"
              checked={terms}
              aria-invalid={errors.terms ? true : undefined}
              aria-describedby={errors.terms ? 'terms-error' : undefined}
              onChange={(e) => {
                setTerms(e.target.checked)
                clear('terms')
              }}
              className="mt-0.5 h-6 w-6 shrink-0 accent-evo-accent"
            />
            <span className="text-sm leading-snug">
              Tengo {LEGAL.minAge} años o más y acepto las{' '}
              <Link to="/condiciones" target="_blank" rel="noreferrer" className="font-bold text-evo-accent underline">
                condiciones de uso
              </Link>{' '}
              y la{' '}
              <Link to="/privacidad" target="_blank" rel="noreferrer" className="font-bold text-evo-accent underline">
                política de privacidad
              </Link>
              .
            </span>
          </label>
          {errors.terms ? (
            <p id="terms-error" className="text-xs font-semibold text-evo-danger" role="alert">
              {errors.terms}
            </p>
          ) : null}
        </div>
        <FormError message={error} />
        <SubmitButton busy={submitting} busyLabel="Creando tu cuenta…">
          Crear cuenta
        </SubmitButton>
      </form>
    </AuthLayout>
  )
}
