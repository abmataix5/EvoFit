import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { Icon, type IconName } from '../components/icons/Icon'
import { SiteFooter } from '../components/SiteFooter'

/** Los bloques con data-reveal entran al llegar a ellos con el scroll (una sola vez). */
function useReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-reveal]')
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-in'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])
}

const cta =
  'inline-flex min-h-14 items-center justify-center gap-1.5 rounded-2xl px-6 text-lg font-extrabold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-evo-accent/40'

function Kicker({ children }: { children: ReactNode }) {
  return <p className="evo-kicker justify-center sm:justify-start">{children}</p>
}

/** Maqueta de móvil dibujada en la página: el entreno de hoy, tal y como se ve en la app. */
function PhoneToday() {
  return (
    <div
      aria-hidden
      className="evo-float relative mx-auto w-[17rem] rotate-[5deg] rounded-[2.6rem] border-[7px] border-[#222d3c] bg-[#0c1219] p-3 text-[#f6f8fb] shadow-[0_40px_80px_rgba(0,0,0,0.5)]"
    >
      <span className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-[#222d3c]" />
      <div className="mt-7 flex items-center justify-between px-1">
        <span className="font-display text-2xl font-extrabold uppercase">Hoy</span>
        <span className="flex gap-2 text-[#c5d0de]">
          <Icon name="search" className="h-4 w-4" />
          <Icon name="bell" className="h-4 w-4" />
        </span>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-[1.4rem_0.5rem] bg-gradient-to-br from-[#ffb347] via-[#ff7a36] to-[#ee5a2c] p-3.5 text-[#1a120c]">
        <span className="evo-stripes absolute inset-0" />
        <p className="relative text-[0.6rem] font-extrabold uppercase tracking-[0.16em] opacity-75">Hoy toca</p>
        <p className="relative font-display text-3xl font-extrabold uppercase leading-none">Pierna</p>
        <p className="relative mt-2 flex gap-1.5 text-[0.65rem] font-bold">
          <span className="rounded-full bg-[#1a120c]/10 px-2 py-1">5 ejercicios</span>
          <span className="rounded-full bg-[#1a120c]/10 px-2 py-1">18 series</span>
        </p>
        <p className="relative mt-3 rounded-[0.8rem_0.3rem] bg-[#1a120c] py-2.5 text-center text-sm font-extrabold text-white">Empezar entrenamiento</p>
      </div>

      <div className="mt-3 rounded-[1.2rem_0.45rem] border border-[#4a5a70]/60 bg-[#161e29] p-3">
        <p className="flex items-baseline gap-1">
          <span className="font-display text-3xl font-extrabold leading-none">3</span>
          <span className="font-display text-lg font-bold text-[#c5d0de]">/ 4</span>
          <span className="ml-1 text-[0.65rem] font-semibold text-[#c5d0de]">entrenos</span>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-[#ff7a36]/15 px-2 py-0.5 text-[0.65rem] font-bold text-[#ff7a36]">
            <Icon name="flame" className="h-3 w-3" />6 semanas
          </span>
        </p>
        <div className="mt-2.5 grid grid-cols-7 gap-1">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => (
            <span key={day} className="flex flex-col items-center gap-1 text-[0.55rem] font-bold text-[#c5d0de]">
              {day}
              <span
                className={[
                  'evo-shape flex h-6 w-6 items-center justify-center',
                  index === 0 || index === 1 || index === 3
                    ? 'bg-[#b6f36a] text-[#102000]'
                    : index === 4
                      ? 'border-2 border-[#ff7a36]'
                      : 'bg-[#212b39]',
                ].join(' ')}
              >
                {index === 0 || index === 1 || index === 3 ? <Icon name="check" className="h-3.5 w-3.5" /> : null}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-[1.2rem_0.45rem] border border-[#4a5a70]/60 bg-[#161e29] p-3">
        <p className="flex items-center gap-1 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-[#c5d0de]">
          <Icon name="trophy" className="h-3 w-3 text-[#ffd166]" />
          Último récord
        </p>
        <p className="mt-1 flex items-baseline justify-between">
          <span className="text-sm font-bold">Sentadilla</span>
          <span className="font-display text-2xl font-extrabold">102,5 kg</span>
        </p>
      </div>
    </div>
  )
}

/** Mini maqueta: la tabla de series del entreno. */
function MockSets() {
  const rows = [
    { n: 1, kg: '80', reps: '8', done: true },
    { n: 2, kg: '82,5', reps: '6', done: true },
    { n: 3, kg: '82,5', reps: '', done: false },
  ]
  return (
    <div aria-hidden className="space-y-1.5">
      {rows.map((row) => (
        <div
          key={row.n}
          className={[
            'grid grid-cols-[1.8rem_1fr_1fr_2rem] items-center gap-1.5 rounded-xl border px-1.5 py-1.5 text-sm font-bold',
            row.done ? 'border-evo-lime/50 bg-evo-lime/10' : 'border-evo-border/50 bg-evo-surface-2',
          ].join(' ')}
        >
          <span className="text-center font-display text-lg text-evo-accent">{row.n}</span>
          <span className="rounded-lg bg-evo-bg py-1 text-center">{row.kg} kg</span>
          <span className="rounded-lg bg-evo-bg py-1 text-center text-evo-muted">{row.reps || 'reps'}</span>
          <span className={['flex h-7 w-7 items-center justify-center rounded-lg', row.done ? 'bg-evo-lime text-[#102000]' : 'bg-evo-bg text-evo-muted'].join(' ')}>
            <Icon name="check" className="h-4 w-4" />
          </span>
        </div>
      ))}
      <p className="flex items-center justify-between rounded-xl bg-evo-bg px-3 py-2 text-xs font-bold text-evo-muted">
        Descanso
        <span className="font-display text-xl text-evo-text">1:12</span>
      </p>
    </div>
  )
}

/** Mini maqueta: barras de progreso que suben. */
function MockChart() {
  const bars = [34, 42, 40, 55, 61, 58, 74, 88]
  return (
    <div aria-hidden className="flex h-28 items-end gap-1.5">
      {bars.map((height, index) => (
        <span
          key={index}
          className={['flex-1 rounded-t-md', index === bars.length - 1 ? 'bg-evo-accent' : 'bg-evo-accent/35'].join(' ')}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  )
}

/** Mini maqueta: clasificación de la liga semanal. */
function MockLeague() {
  const rows = [
    { position: 1, name: 'marta', score: '5 días', medal: 'bg-evo-warn text-[#1a120c]', width: '100%' },
    { position: 2, name: 'tú', score: '4 días', medal: 'bg-[#cfd8e3] text-[#1a120c]', width: '80%', me: true },
    { position: 3, name: 'dani', score: '3 días', medal: 'bg-[#e0a070] text-[#1a120c]', width: '60%' },
  ]
  return (
    <ol aria-hidden className="space-y-1.5">
      {rows.map((row) => (
        <li
          key={row.position}
          className={['relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 py-2', row.me ? 'border-evo-accent bg-evo-accent/10' : 'border-evo-border/50 bg-evo-surface-2'].join(' ')}
        >
          <span className="absolute inset-y-0 left-0 bg-evo-accent/10" style={{ width: row.width }} />
          <span className={['evo-shape relative flex h-7 w-7 items-center justify-center font-display text-base font-extrabold', row.medal].join(' ')}>{row.position}</span>
          <span className="relative flex-1 text-sm font-bold">{row.name}</span>
          <span className="relative font-display text-lg font-extrabold">{row.score}</span>
        </li>
      ))}
    </ol>
  )
}

function Feature({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <li data-reveal className="rounded-3xl border border-evo-border/50 bg-evo-surface p-5">
      <span className="evo-shape flex h-11 w-11 items-center justify-center bg-evo-accent/15 text-evo-accent" aria-hidden>
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <h3 className="mt-3 font-display text-2xl font-bold leading-tight">{title}</h3>
      <p className="mt-1 leading-snug text-evo-muted">{children}</p>
    </li>
  )
}

const WORDS = ['Rutinas', 'Series', 'Récords', 'Progreso', 'Agenda', 'Amigos', 'Fuerza', 'Liga semanal', 'Historias', 'Informes']

/** Portada pública de EvoFit: qué hace la app y cómo entrar. Quien ya tiene sesión ve la app, no esto. */
export function LandingPage() {
  useReveal()

  useEffect(() => {
    document.title = 'EvoFit · Entrena, mejora, evoluciona'
  }, [])

  return (
    <div className="no-x-scroll min-h-dvh">
      <a href="#funciones" className="sr-only-focusable fixed left-3 top-3 z-50 rounded-xl bg-evo-accent px-4 py-3 text-sm font-bold text-[#1a120c]">
        Saltar al contenido
      </a>

      <header className="safe-top sticky top-0 z-30 border-b border-evo-border/30 bg-evo-bg">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="EvoFit, inicio">
            <BrandLogo size="sm" decorative />
            <span className="font-display text-2xl font-extrabold uppercase">
              Evo<span className="text-evo-accent">Fit</span>
            </span>
          </Link>
          <nav aria-label="Cuenta" className="ml-auto flex items-center gap-1.5">
            <Link
              to="/login"
              aria-label="Iniciar sesión"
              className="flex min-h-11 items-center whitespace-nowrap rounded-2xl px-3 text-sm font-bold transition hover:bg-evo-surface-2 active:scale-95 sm:px-4 sm:text-base"
            >
              <span className="sm:hidden">Entrar</span>
              <span className="hidden sm:inline">Iniciar sesión</span>
            </Link>
            <Link
              to="/register"
              className="flex min-h-11 items-center whitespace-nowrap rounded-2xl bg-evo-accent px-4 text-sm font-extrabold text-[#1a120c] transition active:scale-95 sm:text-base"
            >
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ── Portada ── */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pb-24 lg:pt-20">
            <div className="evo-stagger text-center lg:text-left">
              <p className="evo-kicker justify-center lg:justify-start">Tu gimnasio, en el móvil</p>
              <h1 className="mt-4 font-display text-[clamp(3.4rem,13vw,6.5rem)] font-extrabold uppercase leading-[0.88]">
                Entrena.
                <br />
                Mejora.
                <br />
                <span className="text-evo-accent">Evoluciona.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-snug text-evo-muted lg:mx-0 lg:text-xl">
                EvoFit es la app para apuntar tus entrenos, ver cómo progresas semana a semana y picarte con tus amigos. Sin hojas de cálculo y sin
                descargar nada.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link to="/register" className={`${cta} bg-evo-accent text-[#1a120c] shadow-[0_12px_32px_rgba(255,122,54,0.35)]`}>
                  Crear cuenta gratis
                  <Icon name="chevron" className="h-5 w-5" />
                </Link>
                <Link to="/login" className={`${cta} border-2 border-evo-border bg-evo-surface-2 text-evo-text`}>
                  Ya tengo cuenta
                </Link>
              </div>
              <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold text-evo-muted lg:justify-start">
                {['Funciona en cualquier móvil', 'Se instala sin tienda de apps', 'Guarda aunque no haya cobertura'].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Icon name="check" className="h-4 w-4 text-evo-lime" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-sm py-4">
              {/* El trazo inclinado del logo, en grande, detrás del móvil. */}
              <span aria-hidden className="absolute inset-x-6 inset-y-10 -skew-x-[14deg] rounded-[2.5rem_0.8rem] bg-gradient-to-br from-[#ffb347] via-[#ff7a36] to-[#ee5a2c] opacity-90" />
              <span aria-hidden className="evo-stripes absolute inset-x-6 inset-y-10 -skew-x-[14deg] rounded-[2.5rem_0.8rem]" />
              <PhoneToday />
            </div>
          </div>

          {/* Cinta de palabras: todo lo que cabe en la app, pasando. */}
          <div aria-hidden className="-rotate-1 border-y border-evo-accent/40 bg-evo-accent py-3 text-[#1a120c]">
            <div className="evo-marquee flex w-max gap-8 font-display text-2xl font-extrabold uppercase">
              {[...WORDS, ...WORDS, ...WORDS, ...WORDS].map((word, index) => (
                <span key={index} className="flex items-center gap-8">
                  {word}
                  <span className="h-3 w-4 -skew-x-[24deg] rounded-[2px] bg-[#1a120c]" />
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Las tres piezas grandes ── */}
        <section id="funciones" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 lg:px-8 lg:py-24">
          <div data-reveal className="text-center sm:text-left">
            <Kicker>Qué hace EvoFit</Kicker>
            <h2 className="mt-3 font-display text-[clamp(2.4rem,8vw,4rem)] font-extrabold uppercase leading-[0.95]">
              Todo tu entreno, <span className="text-evo-accent">en un sitio</span>
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <article data-reveal className="flex flex-col rounded-3xl border border-evo-border/50 bg-evo-surface p-5">
              <h3 className="font-display text-3xl font-extrabold uppercase leading-none">Apunta sin pensar</h3>
              <p className="mt-2 leading-snug text-evo-muted">
                Kilos y repeticiones en dos toques. Te recuerda lo que hiciste la última vez, cuenta el descanso sola y te avisa cuando bates un récord.
              </p>
              <div className="mt-5 flex-1 content-end">
                <MockSets />
              </div>
            </article>

            <article data-reveal className="flex flex-col rounded-3xl border border-evo-border/50 bg-evo-surface p-5">
              <h3 className="font-display text-3xl font-extrabold uppercase leading-none">Mira cómo mejoras</h3>
              <p className="mt-2 leading-snug text-evo-muted">
                Tu fuerza en cada ejercicio, tus récords, tu racha de semanas, tu peso y tus fotos de progreso. Lo que antes era una sensación, en una gráfica.
              </p>
              <div className="mt-5 flex-1 content-end">
                <MockChart />
                <p aria-hidden className="mt-2 flex items-center justify-between text-xs font-bold text-evo-muted">
                  Press banca · 8 semanas <span className="text-evo-up">▲ +12,5 kg</span>
                </p>
              </div>
            </article>

            <article data-reveal className="flex flex-col rounded-3xl border border-evo-border/50 bg-evo-surface p-5">
              <h3 className="font-display text-3xl font-extrabold uppercase leading-none">Pícate con tus amigos</h3>
              <p className="mt-2 leading-snug text-evo-muted">
                Cada semana, una liga entre vosotros: quién entrena más días, mueve más kilos o bate más récords. Se reinicia los lunes.
              </p>
              <div className="mt-5 flex-1 content-end">
                <MockLeague />
              </div>
            </article>
          </div>
        </section>

        {/* ── Todo lo demás ── */}
        <section className="border-y border-evo-border/30 bg-evo-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8 lg:py-24">
            <div data-reveal className="text-center sm:text-left">
              <Kicker>Y además</Kicker>
              <h2 className="mt-3 font-display text-[clamp(2.4rem,8vw,4rem)] font-extrabold uppercase leading-[0.95]">Todo lo que lleva dentro</h2>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Feature icon="dumbbell" title="Rutinas a tu medida">
                Elige qué días entrenas y qué ejercicios haces cada uno. Cámbiala cuando quieras.
              </Feature>
              <Feature icon="catalog" title="Más de 200 ejercicios">
                Biblioteca con fotos y claves de técnica, filtrada por músculo y material. Y puedes añadir los tuyos.
              </Feature>
              <Feature icon="calendar" title="Agenda que se rellena sola">
                Tus entrenos colocados en la semana y en el mes. Ves de un vistazo lo hecho y lo pendiente.
              </Feature>
              <Feature icon="clock" title="Descansos y series por tiempo">
                Cuenta atrás entre series y ejercicios por tiempo, además de los de peso y repeticiones.
              </Feature>
              <Feature icon="trophy" title="Récords y rachas">
                Celebra cada marca personal y mantén viva tu racha de semanas entrenando.
              </Feature>
              <Feature icon="bolt" title="Feed y «Fuerza»">
                Comparte tu entreno con foto, da fuerza a los de tus amigos y comenta.
              </Feature>
              <Feature icon="eye" title="Historias de 24 horas">
                Sube un momento del gimnasio con tu entreno del día o tu racha.
              </Feature>
              <Feature icon="chat" title="Mensajes privados">
                Habla con tus amigos y responde a sus historias sin salir de la app.
              </Feature>
              <Feature icon="file" title="Informes en PDF">
                Descarga tu sesión, tu semana o tu mes para guardarlo o enseñárselo a tu entrenador.
              </Feature>
              <Feature icon="progress" title="Peso y fotos de progreso">
                Apunta tu peso y compara fotos de antes y después. Las fotos son solo tuyas.
              </Feature>
              <Feature icon="lock" title="Tú decides quién te ve">
                Perfil público, solo para amigos o privado. Puedes bloquear y denunciar.
              </Feature>
              <Feature icon="settings" title="Claro u oscuro">
                Modo oscuro para el gimnasio, claro para la calle, o que siga a tu móvil.
              </Feature>
            </ul>
          </div>
        </section>

        {/* ── Cómo se empieza ── */}
        <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8 lg:py-24">
          <div data-reveal className="text-center sm:text-left">
            <Kicker>Empezar es fácil</Kicker>
            <h2 className="mt-3 font-display text-[clamp(2.4rem,8vw,4rem)] font-extrabold uppercase leading-[0.95]">Tres pasos y a entrenar</h2>
          </div>
          <ol className="mt-8 grid gap-4 lg:grid-cols-3">
            {[
              { title: 'Crea tu cuenta', text: 'Un minuto: nombre, alias, email y contraseña.' },
              { title: 'Monta tu rutina', text: 'Elige los días que entrenas y los ejercicios. La agenda se rellena sola.' },
              { title: 'Entrena y apunta', text: 'Abre «Hoy», sigue tu entreno y mira cómo sube todo semana a semana.' },
            ].map((step, index) => (
              <li key={step.title} data-reveal className="relative overflow-hidden rounded-3xl border border-evo-border/50 bg-evo-surface p-5 pt-6">
                <span aria-hidden className="absolute -right-2 -top-6 font-display text-[7.5rem] font-extrabold leading-none text-evo-accent/15">
                  {index + 1}
                </span>
                <p className="relative text-sm font-extrabold uppercase tracking-[0.14em] text-evo-accent">Paso {index + 1}</p>
                <h3 className="relative mt-1 font-display text-3xl font-extrabold uppercase leading-none">{step.title}</h3>
                <p className="relative mt-2 leading-snug text-evo-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── App web ── */}
        <section className="mx-auto max-w-6xl px-4 pb-16 lg:px-8 lg:pb-24">
          <div data-reveal className="grid gap-6 rounded-3xl border border-evo-border/50 bg-evo-surface p-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:p-10">
            <div>
              <Kicker>Es una app web</Kicker>
              <h2 className="mt-3 font-display text-[clamp(2.2rem,7vw,3.4rem)] font-extrabold uppercase leading-[0.95]">
                Sin tienda de apps. <span className="text-evo-accent">Sin esperas.</span>
              </h2>
              <p className="mt-3 text-lg leading-snug text-evo-muted">
                EvoFit se abre desde el navegador de tu iPhone o Android. Si quieres, la añades a la pantalla de inicio y se usa a pantalla completa,
                como cualquier otra app.
              </p>
              <Link to="/instalar" className="mt-4 inline-flex min-h-11 items-center gap-1 font-bold text-evo-accent">
                Cómo instalarla en el móvil <Icon name="chevron" className="h-4 w-4" />
              </Link>
            </div>
            <ul className="space-y-2.5">
              {[
                'Siempre la última versión, sin actualizar nada',
                'El entreno se guarda en el móvil si te quedas sin cobertura',
                'La pantalla no se apaga mientras entrenas',
                'Tus datos van cifrados por HTTPS',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-2xl bg-evo-surface-2 px-4 py-3 font-semibold">
                  <Icon name="check" className="h-5 w-5 shrink-0 text-evo-lime" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Cierre ── */}
        <section className="px-4 pb-16 lg:px-8 lg:pb-24">
          <div data-reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffb347] via-[#ff7a36] to-[#ee5a2c] px-6 py-12 text-center text-[#1a120c] lg:py-16">
            <span aria-hidden className="evo-stripes pointer-events-none absolute inset-0" />
            <h2 className="relative font-display text-[clamp(2.6rem,10vw,5rem)] font-extrabold uppercase leading-[0.9]">
              Tu próximo récord
              <br />
              empieza hoy
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-lg font-semibold opacity-85">Crea tu cuenta y apunta tu primer entreno en cinco minutos.</p>
            <div className="relative mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/register" className={`${cta} bg-[#1a120c] text-white`}>
                Crear cuenta gratis
                <Icon name="chevron" className="h-5 w-5" />
              </Link>
              <Link to="/login" className={`${cta} border-2 border-[#1a120c]/40 text-[#1a120c]`}>
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
