import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { api, apiErrorMessage, validationErrors } from '../../lib/api'

/** Cambiar la contraseña (pide la actual; cierra la sesión en los demás dispositivos). */
export function PasswordForm() {
  const { notify } = useUiFeedback()
  const [values, setValues] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: async () => api.put('/profile/password', values),
    onSuccess: () => {
      setValues({ current_password: '', password: '', password_confirmation: '' })
      setErrors({})
      notify('Contraseña cambiada. Se ha cerrado la sesión en tus otros dispositivos.', 'success')
    },
    onError: (error) => {
      const fieldErrors = validationErrors(error)
      setErrors(fieldErrors)
      if (Object.keys(fieldErrors).length === 0) notify(apiErrorMessage(error, 'No se ha podido cambiar.'), 'error')
    },
  })

  function set(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <Input
        label="Contraseña actual"
        type="password"
        autoComplete="current-password"
        value={values.current_password}
        onChange={(e) => set('current_password', e.target.value)}
        error={errors.current_password}
        required
      />
      <Input
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        minLength={8}
        value={values.password}
        onChange={(e) => set('password', e.target.value)}
        error={errors.password}
        hint="Mínimo 8 caracteres."
        required
      />
      <Input
        label="Repite la nueva contraseña"
        type="password"
        autoComplete="new-password"
        value={values.password_confirmation}
        onChange={(e) => set('password_confirmation', e.target.value)}
        required
      />
      <Button type="submit" variant="secondary" fullWidth disabled={save.isPending}>
        {save.isPending ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  )
}
