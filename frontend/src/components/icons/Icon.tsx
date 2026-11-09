type IconName = 'home' | 'routines' | 'catalog' | 'calendar' | 'progress' | 'user' | 'menu' | 'close' | 'download' | 'file'

type Props = {
  name: IconName
  className?: string
}

export function Icon({ name, className = 'h-5 w-5' }: Props) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      {name === 'home' ? (
        <path {...common} d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
      ) : null}
      {name === 'routines' ? (
        <>
          <path {...common} d="M6 7h12M6 12h12M6 17h8" />
          <path {...common} d="M4 7h.01M4 12h.01M4 17h.01" />
        </>
      ) : null}
      {name === 'catalog' ? (
        <>
          <path {...common} d="M7 6.5h10a1 1 0 0 1 1 1V19l-2.2-1.2L13.5 19l-2.3-1.2L9 19l-2.2-1.2L4.5 19V7.5a1 1 0 0 1 1-1H7Z" />
          <path {...common} d="M9 10h6M9 13.5h4" />
        </>
      ) : null}
      {name === 'calendar' ? (
        <>
          <rect {...common} x="4" y="5" width="16" height="15" rx="2" />
          <path {...common} d="M8 3.5V7M16 3.5V7M4 10h16" />
        </>
      ) : null}
      {name === 'progress' ? (
        <path {...common} d="M4 16.5 9 11l3.2 3.2L20 7M14.5 7H20v5.5" />
      ) : null}
      {name === 'user' ? (
        <>
          <circle {...common} cx="12" cy="8" r="3.2" />
          <path {...common} d="M5.5 19.2c1.4-2.8 3.7-4.2 6.5-4.2s5.1 1.4 6.5 4.2" />
        </>
      ) : null}
      {name === 'menu' ? <path {...common} d="M4 7h16M4 12h16M4 17h16" /> : null}
      {name === 'close' ? <path {...common} d="M6 6l12 12M18 6 6 18" /> : null}
      {name === 'download' ? <path {...common} d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" /> : null}
      {name === 'file' ? (
        <>
          <path {...common} d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3.5Z" />
          <path {...common} d="M14 3.5V8h4.5M9 13h6M9 16.5h4" />
        </>
      ) : null}
    </svg>
  )
}
