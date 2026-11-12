export type IconName =
  | 'home'
  | 'routines'
  | 'catalog'
  | 'calendar'
  | 'progress'
  | 'user'
  | 'menu'
  | 'close'
  | 'download'
  | 'file'
  | 'search'
  | 'bell'
  | 'back'
  | 'chevron'
  | 'logout'
  | 'heart'
  | 'heart-filled'
  | 'comment'
  | 'more'
  | 'send'
  | 'plus'
  | 'eye'
  | 'dumbbell'
  | 'bolt'
  | 'bolt-filled'
  | 'chat'
  | 'settings'
  | 'trophy'
  | 'flame'
  | 'check'
  | 'lock'
  | 'clock'

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
      {name === 'search' ? (
        <>
          <circle {...common} cx="10.5" cy="10.5" r="6" />
          <path {...common} d="m15 15 5 5" />
        </>
      ) : null}
      {name === 'bell' ? (
        <>
          <path {...common} d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
          <path {...common} d="M10 20.5a2 2 0 0 0 4 0" />
        </>
      ) : null}
      {name === 'back' ? <path {...common} d="M15 5 8 12l7 7" /> : null}
      {name === 'chevron' ? <path {...common} d="m9 5 7 7-7 7" /> : null}
      {name === 'logout' ? (
        <>
          <path {...common} d="M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14" />
          <path {...common} d="M10.5 12H20m0 0-3.5-3.5M20 12l-3.5 3.5" />
        </>
      ) : null}
      {name === 'heart' || name === 'heart-filled' ? (
        <path
          {...common}
          fill={name === 'heart-filled' ? 'currentColor' : 'none'}
          d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"
        />
      ) : null}
      {name === 'comment' ? <path {...common} d="M5 18.5V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8.5L5 18.5Z" /> : null}
      {name === 'more' ? (
        <>
          <circle cx="5.5" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="18.5" cy="12" r="1.6" fill="currentColor" />
        </>
      ) : null}
      {name === 'send' ? <path {...common} d="M20.5 3.5 10 14M20.5 3.5l-6.5 17-4-6.5-6.5-4 17-6.5Z" /> : null}
      {name === 'plus' ? <path {...common} d="M12 5v14M5 12h14" /> : null}
      {name === 'eye' ? (
        <>
          <path {...common} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle {...common} cx="12" cy="12" r="3" />
        </>
      ) : null}
      {name === 'dumbbell' ? <path {...common} d="M2.75 10v4M6 7v10M18 7v10M21.25 10v4M6 12h12" /> : null}
      {name === 'bolt' || name === 'bolt-filled' ? (
        <path {...common} fill={name === 'bolt-filled' ? 'currentColor' : 'none'} d="M13.5 2.75 5 13.5h5.75L10 21.25 19 10.25h-5.9l.4-7.5Z" />
      ) : null}
      {name === 'chat' ? (
        <>
          <path {...common} d="M12 4.5c-4.4 0-8 3-8 6.8 0 2 1 3.8 2.6 5L6 20l3.9-2.1c.7.15 1.4.200 2.1.200 4.4 0 8-3 8-6.8s-3.6-6.8-8-6.8Z" />
          <path {...common} d="M8.5 11.3h.01M12 11.3h.01M15.5 11.3h.01" />
        </>
      ) : null}
      {name === 'settings' ? (
        <>
          <path {...common} d="M4 7.5h8.5M18.5 7.5H20M4 16.5h1.5M11.5 16.5H20" />
          <circle {...common} cx="15.5" cy="7.5" r="2.5" />
          <circle {...common} cx="8.5" cy="16.5" r="2.5" />
        </>
      ) : null}
      {name === 'trophy' ? (
        <>
          <path {...common} d="M8 4.5h8V10a4 4 0 0 1-8 0V4.5Z" />
          <path {...common} d="M8 6.5H5.25V8A2.75 2.75 0 0 0 8 10.75M16 6.5h2.75V8A2.75 2.75 0 0 1 16 10.75M12 14v3.25M8.5 20h7M9.75 17.25h4.5" />
        </>
      ) : null}
      {name === 'flame' ? (
        <path {...common} d="M12.2 3c.4 3.2 4.8 5 4.8 9.8a5 5 0 0 1-10 0c0-1.8.8-3.2 1.8-4.2.3 1.3 1 2.1 1.9 2.4-.4-3.2.2-6 1.5-8Z" />
      ) : null}
      {name === 'check' ? <path {...common} strokeWidth={2.4} d="m5 12.5 4.5 4.5L19 7.5" /> : null}
      {name === 'lock' ? (
        <>
          <rect {...common} x="5.5" y="10.5" width="13" height="9.5" rx="2" />
          <path {...common} d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
        </>
      ) : null}
      {name === 'clock' ? (
        <>
          <circle {...common} cx="12" cy="12" r="8" />
          <path {...common} d="M12 7.5V12l3 2" />
        </>
      ) : null}
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
