import { useTheme, type ThemePreference } from '../../lib/theme'

const OPTIONS: Array<{ id: ThemePreference; label: string }> = [
  { id: 'dark', label: 'Oscuro' },
  { id: 'light', label: 'Claro' },
  { id: 'auto', label: 'Auto' },
]

export function ThemeSwitch() {
  const { preference, setPreference } = useTheme()

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-evo-muted">Apariencia</p>
      <div role="radiogroup" aria-label="Apariencia" className="grid grid-cols-3 gap-1 rounded-2xl border border-evo-border bg-evo-bg/40 p-1">
        {OPTIONS.map((option) => {
          const active = preference === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(option.id)}
              className={[
                'min-h-10 rounded-xl text-sm font-bold transition',
                active ? 'bg-evo-accent text-[#1a120c]' : 'text-evo-muted hover:text-evo-text',
              ].join(' ')}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
