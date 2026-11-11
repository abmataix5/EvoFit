import { useMutation } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUiFeedback } from '../components/feedback/UiFeedback'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../features/auth/AuthContext'
import { Avatar } from '../features/profile/Avatar'
import { EXPERIENCE_LEVELS, TRAINING_GOALS, VISIBILITY_OPTIONS } from '../features/profile/profileOptions'
import {
  api,
  apiErrorMessage,
  validationErrors,
  type ExperienceLevel,
  type ProfileVisibility,
  type TrainingGoal,
  type User,
} from '../lib/api'
import { prepareAvatar } from '../lib/preparePhoto'

type Form = {
  name: string
  username: string
  bio: string
  location: string
  birth_date: string
  height_cm: string
  gym_name: string
  experience_level: ExperienceLevel | ''
  training_goal: TrainingGoal | ''
  profile_visibility: ProfileVisibility
  show_age: boolean
}

const BIO_MAX = 280

function formFromUser(user: User): Form {
  return {
    name: user.name,
    username: user.username ?? '',
    bio: user.bio ?? '',
    location: user.location ?? '',
    birth_date: user.birth_date ?? '',
    height_cm: user.height_cm ? String(user.height_cm) : '',
    gym_name: user.gym_name ?? '',
    experience_level: user.experience_level ?? '',
    training_goal: user.training_goal ?? '',
    profile_visibility: user.profile_visibility,
    show_age: user.show_age,
  }
}

function maxBirthDate() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 13)
  return d.toISOString().slice(0, 10)
}

function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4 rounded-3xl border border-evo-border/60 bg-evo-surface p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  allowEmpty = true,
}: {
  label: string
  options: Array<{ id: T; label: string; emoji?: string }>
  value: T | ''
  onChange: (value: T | '') => void
  allowEmpty?: boolean
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(active && allowEmpty ? '' : option.id)}
              className={[
                'min-h-11 rounded-2xl border-2 px-3.5 text-sm font-bold transition active:scale-[0.97]',
                active
                  ? 'border-evo-accent bg-evo-accent/15 text-evo-text'
                  : 'border-evo-border bg-evo-surface-2 text-evo-muted hover:text-evo-text',
              ].join(' ')}
            >
              {option.emoji ? `${option.emoji} ` : ''}
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function AvatarEditor({ user }: { user: User }) {
  const { setCurrentUser } = useAuth()
  const { notify, confirm } = useUiFeedback()
  const fileInput = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const prepared = await prepareAvatar(file)
      const body = new FormData()
      body.append('avatar', prepared)
      return (await api.post<{ data: User }>('/profile/avatar', body)).data.data
    },
    onSuccess: (updated) => {
      setCurrentUser(updated)
      notify('Foto actualizada', 'success')
    },
    onError: (error) => {
      const message = validationErrors(error).avatar
      notify(message ?? apiErrorMessage(error, 'No se ha podido subir la foto. Prueba con otra.'), 'error')
    },
  })

  const remove = useMutation({
    mutationFn: async () => (await api.delete<{ data: User }>('/profile/avatar')).data.data,
    onSuccess: (updated) => {
      setCurrentUser(updated)
      notify('Foto eliminada', 'success')
    },
    onError: (error) => notify(apiErrorMessage(error, 'No se ha podido quitar la foto.'), 'error'),
  })

  async function handleRemove() {
    const ok = await confirm({
      title: 'Quitar foto',
      message: '¿Quieres quitar tu foto de perfil?',
      confirmLabel: 'Quitar',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (ok) remove.mutate()
  }

  const busy = upload.isPending || remove.isPending

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar name={user.name} url={user.avatar_url} size="xl" />
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs font-bold text-white">
            Subiendo…
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) upload.mutate(file)
          }}
        />
        <Button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
          {user.avatar_url ? 'Cambiar foto' : 'Subir foto'}
        </Button>
        {user.avatar_url ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void handleRemove()}>
            Quitar foto
          </Button>
        ) : (
          <p className="text-xs text-evo-muted">Se recorta en cuadrado. Se borran los datos de ubicación de la foto.</p>
        )}
      </div>
    </div>
  )
}

function PasswordSection() {
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

export function EditProfilePage() {
  const { user, setCurrentUser } = useAuth()
  const { notify } = useUiFeedback()
  const navigate = useNavigate()
  const location = useLocation()
  const bioId = useId()
  const [form, setForm] = useState<Form | null>(() => (user ? formFromUser(user) : null))
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!location.hash) return
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  const save = useMutation({
    mutationFn: async (payload: Form) =>
      (
        await api.patch<{ data: User }>('/profile', {
          ...payload,
          height_cm: payload.height_cm === '' ? null : Number(payload.height_cm),
          experience_level: payload.experience_level || null,
          training_goal: payload.training_goal || null,
        })
      ).data.data,
    onSuccess: (updated) => {
      setCurrentUser(updated)
      notify('Perfil guardado', 'success')
      navigate('/profile')
    },
    onError: (error) => {
      const fieldErrors = validationErrors(error)
      setErrors(fieldErrors)
      notify(
        Object.keys(fieldErrors).length > 0 ? 'Revisa los campos marcados.' : apiErrorMessage(error, 'No se ha podido guardar.'),
        'error',
      )
    },
  })

  if (!user || !form) return null

  function set<K extends keyof Form>(field: K, value: Form[K]) {
    setForm((current) => (current ? { ...current, [field]: value } : current))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (form) save.mutate(form)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Section title="Foto de perfil">
        <AvatarEditor user={user} />
      </Section>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Section title="Sobre ti">
          <Input
            label="Nombre"
            name="name"
            autoComplete="name"
            maxLength={120}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            required
          />
          <Input
            label="Nombre de usuario"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            placeholder="tu.usuario"
            value={form.username}
            onChange={(e) => set('username', e.target.value.toLowerCase().replace(/\s+/g, ''))}
            error={errors.username}
            hint="Así te encontrarán tus amigos. Letras, números, puntos y guiones bajos."
          />
          <label className="block space-y-1.5" htmlFor={bioId}>
            <span className="flex items-baseline justify-between text-sm font-semibold">
              Bio
              <span className={['text-xs tabular-nums', form.bio.length > BIO_MAX ? 'text-evo-danger' : 'text-evo-muted'].join(' ')}>
                {form.bio.length}/{BIO_MAX}
              </span>
            </span>
            <textarea
              id={bioId}
              rows={3}
              maxLength={BIO_MAX}
              placeholder="Qué entrenas, qué te motiva, tu próximo reto…"
              value={form.bio}
              onChange={(e) => set('bio', e.target.value)}
              aria-invalid={errors.bio ? true : undefined}
              className={[
                'box-border w-full resize-none rounded-2xl border-2 border-evo-border bg-evo-surface-2 px-4 py-3 text-base text-evo-text',
                'placeholder:text-evo-muted/80 focus:border-evo-accent focus:outline-none focus:ring-4 focus:ring-evo-accent/25',
                errors.bio ? 'border-evo-danger' : '',
              ].join(' ')}
            />
            {errors.bio ? <span className="block text-xs font-semibold text-evo-danger">{errors.bio}</span> : null}
          </label>
          <Input
            label="De dónde eres"
            name="location"
            autoComplete="address-level2"
            maxLength={80}
            placeholder="Valencia, España"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            error={errors.location}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Fecha de nacimiento"
              name="birth_date"
              type="date"
              autoComplete="bday"
              min="1900-01-02"
              max={maxBirthDate()}
              value={form.birth_date}
              onChange={(e) => set('birth_date', e.target.value)}
              error={errors.birth_date}
              hint="Solo se muestra tu edad, nunca la fecha."
            />
            <Input
              label="Altura (cm)"
              name="height_cm"
              type="number"
              inputMode="numeric"
              min={100}
              max={250}
              placeholder="175"
              value={form.height_cm}
              onChange={(e) => set('height_cm', e.target.value)}
              error={errors.height_cm}
            />
          </div>
        </Section>

        <Section title="Tu entreno">
          <Input
            label="Gimnasio"
            name="gym_name"
            maxLength={80}
            placeholder="Dónde entrenas"
            value={form.gym_name}
            onChange={(e) => set('gym_name', e.target.value)}
            error={errors.gym_name}
          />
          <ChoiceGroup
            label="Objetivo principal"
            options={TRAINING_GOALS}
            value={form.training_goal}
            onChange={(value) => set('training_goal', value)}
          />
          <ChoiceGroup
            label="Experiencia"
            options={EXPERIENCE_LEVELS}
            value={form.experience_level}
            onChange={(value) => set('experience_level', value)}
          />
        </Section>

        <Section title="Privacidad" id="privacidad">
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-semibold">Quién puede ver tus entrenos</legend>
            {VISIBILITY_OPTIONS.map((option) => {
              const active = form.profile_visibility === option.id
              return (
                <label
                  key={option.id}
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition',
                    active ? 'border-evo-accent bg-evo-accent/10' : 'border-evo-border bg-evo-surface-2',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="profile_visibility"
                    value={option.id}
                    checked={active}
                    onChange={() => set('profile_visibility', option.id)}
                    className="mt-1 h-4 w-4 accent-evo-accent"
                  />
                  <span>
                    <span className="block font-bold">{option.label}</span>
                    <span className="block text-sm text-evo-muted">{option.hint}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-evo-surface-2 p-3">
            <span>
              <span className="block font-bold">Mostrar mi edad</span>
              <span className="block text-sm text-evo-muted">En tu perfil público.</span>
            </span>
            <input
              type="checkbox"
              checked={form.show_age}
              onChange={(e) => set('show_age', e.target.checked)}
              className="h-6 w-6 shrink-0 accent-evo-accent"
            />
          </label>
        </Section>

        <div className="safe-bottom sticky bottom-24 z-10 flex gap-2 rounded-3xl bg-evo-bg/85 p-1 backdrop-blur-md lg:bottom-4">
          <Button type="button" variant="secondary" size="lg" onClick={() => navigate('/profile')}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" fullWidth disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </form>

      <Section title="Cuenta">
        <div className="rounded-2xl bg-evo-surface-2 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-evo-muted">Email</p>
          <p className="truncate font-semibold">{user.email}</p>
        </div>
        <PasswordSection />
      </Section>
    </div>
  )
}
