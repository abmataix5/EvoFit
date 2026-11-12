import axios from 'axios'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/icons/Icon'
import { Input } from '../components/ui/Input'
import { AuthLayout, FormError, SubmitButton } from '../features/auth/AuthLayout'
import { api, ensureCsrfCookie, validationErrors } from '../lib/api'

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Sin conexión. Comprueba la cobertura e inténtalo de nuevo.'
    if (error.response.status === 429) return 'Demasiados intentos. Espera un minuto y vuelve a probar.'
  }
  return 'No se ha podido enviar. Inténtalo de nuevo.'
}

/** Pedir por email el enlace para cambiar la contraseña. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFieldError('Escribe un email válido.')
      return
    }
    setSubmitting(true)
    try {
      await ensureCsrfCookie()
      await api.post('/auth/forgot-password', { email: email.trim() })
      setSentTo(email.trim())
    } catch (err) {
      const fromServer = validationErrors(err).email
      if (fromServer) setFieldError(fromServer)
      else setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={sentTo ? 'Revisa tu correo' : 'Recupera tu cuenta'}
      subtitle={sentTo ? 'El enlace puede tardar un par de minutos.' : 'Te enviamos un enlace para elegir una contraseña nueva.'}
      panelTitle={
        <>
          Vuelve
          <br />
          a entrenar
        </>
      }
      highlights={['El enlace llega a tu email', 'Caduca en una hora y solo vale una vez', 'Tus entrenos siguen donde los dejaste']}
      footer={
        <>
          ¿Ya la recuerdas?{' '}
          <Link to="/login" className="font-bold text-evo-accent">
            Iniciar sesión
          </Link>
        </>
      }
    >
      {sentTo ? (
        <div className="space-y-4" role="status">
          <div className="flex items-start gap-3 rounded-2xl border-2 border-evo-lime/50 bg-evo-lime/10 px-4 py-4">
            <span className="evo-shape flex h-9 w-9 shrink-0 items-center justify-center bg-evo-lime text-[#102000]" aria-hidden>
              <Icon name="check" className="h-5 w-5" />
            </span>
            <p className="leading-snug">
              Si hay una cuenta con <strong className="break-all">{sentTo}</strong>, te hemos enviado un enlace para cambiar la contraseña.
            </p>
          </div>
          <ul className="space-y-1.5 text-sm text-evo-muted">
            <li>· Mira también en la carpeta de spam o correo no deseado.</li>
            <li>· El remitente es no-reply@evofit.fitness.</li>
            <li>· El enlace caduca en una hora.</li>
          </ul>
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="min-h-12 w-full rounded-2xl border-2 border-evo-border bg-evo-surface-2 text-base font-bold transition active:scale-[0.98]"
          >
            Probar con otro email
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Input
            label="Email de tu cuenta"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="send"
            placeholder="tu@email.com"
            value={email}
            error={fieldError}
            onChange={(e) => {
              setEmail(e.target.value)
              setFieldError(undefined)
            }}
          />
          <FormError message={error} />
          <SubmitButton busy={submitting} busyLabel="Enviando…">
            Enviar enlace
          </SubmitButton>
        </form>
      )}
    </AuthLayout>
  )
}
