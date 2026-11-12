import axios from 'axios'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Icon } from '../components/icons/Icon'
import { PasswordInput } from '../components/ui/PasswordInput'
import { AuthLayout, FormError, SubmitButton } from '../features/auth/AuthLayout'
import { api, ensureCsrfCookie, validationErrors } from '../lib/api'

const MIN_PASSWORD = 8

/** Elegir contraseña nueva con el enlace recibido por email (/restablecer?token=…&email=…). */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { notify } = useUiFeedback()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const incomplete = !token || !email
  const longEnough = password.length >= MIN_PASSWORD

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    if (!longEnough) {
      setFieldError(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`)
      return
    }
    setSubmitting(true)
    try {
      await ensureCsrfCookie()
      // Hay botón para ver la contraseña, así que no se pide escribirla dos veces.
      await api.post('/auth/reset-password', { token, email, password, password_confirmation: password })
      notify('Contraseña cambiada. Ya puedes iniciar sesión.', 'success')
      navigate('/login', { replace: true })
    } catch (err) {
      const fromServer = validationErrors(err)
      if (fromServer.token || fromServer.email) setExpired(true)
      else if (fromServer.password) setFieldError(fromServer.password)
      else if (axios.isAxiosError(err) && !err.response) setError('Sin conexión. Comprueba la cobertura e inténtalo de nuevo.')
      else if (axios.isAxiosError(err) && err.response?.status === 429) setError('Demasiados intentos. Espera un minuto y vuelve a probar.')
      else setError('No se ha podido cambiar la contraseña. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const invalid = incomplete || expired

  return (
    <AuthLayout
      title={invalid ? 'Enlace no válido' : 'Nueva contraseña'}
      subtitle={invalid ? 'Este enlace ha caducado o ya se ha usado.' : `Elige la contraseña nueva para ${email}.`}
      panelTitle={
        <>
          Casi
          <br />
          estás dentro
        </>
      }
      highlights={['Elige una contraseña que no uses en otro sitio', 'Al menos 8 caracteres', 'Tus entrenos siguen donde los dejaste']}
      footer={
        <>
          <Link to="/login" className="font-bold text-evo-accent">
            Volver a iniciar sesión
          </Link>
        </>
      }
    >
      {invalid ? (
        <div className="space-y-4">
          <p className="leading-snug text-evo-muted">Los enlaces caducan en una hora y solo sirven una vez. Pide uno nuevo y vuelve a intentarlo.</p>
          <Link
            to="/recuperar"
            className="flex min-h-14 w-full items-center justify-center gap-1.5 rounded-2xl bg-evo-accent text-lg font-extrabold text-[#1a120c] transition active:scale-[0.98]"
          >
            Pedir un enlace nuevo
            <Icon name="chevron" className="h-5 w-5" />
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* Campo oculto con el email: ayuda al gestor de contraseñas a guardar la nueva en la cuenta correcta. */}
          <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
          <div className="space-y-2">
            <PasswordInput
              label="Contraseña nueva"
              name="password"
              autoComplete="new-password"
              enterKeyHint="go"
              value={password}
              error={fieldError}
              onChange={(e) => {
                setPassword(e.target.value)
                setFieldError(undefined)
              }}
            />
            <p
              className={[
                'flex items-center gap-1.5 text-sm font-semibold transition-colors',
                longEnough ? 'text-evo-lime' : 'text-evo-muted',
                fieldError ? 'hidden' : '',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={['flex h-5 w-5 items-center justify-center rounded-full', longEnough ? 'bg-evo-lime text-[#102000]' : 'border-2 border-evo-border'].join(' ')}
              >
                {longEnough ? <Icon name="check" className="h-3.5 w-3.5" /> : null}
              </span>
              Al menos {MIN_PASSWORD} caracteres
            </p>
          </div>
          <FormError message={error} />
          <SubmitButton busy={submitting} busyLabel="Guardando…">
            Guardar contraseña
          </SubmitButton>
        </form>
      )}
    </AuthLayout>
  )
}
