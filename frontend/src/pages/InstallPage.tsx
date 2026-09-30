import { BrandLogo } from '../components/BrandLogo'

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isSafari() {
  const ua = navigator.userAgent
  return /safari/i.test(ua) && !/crios|fxios|edgios|opr/i.test(ua)
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  )
}

const steps = [
  {
    n: '1',
    title: 'Abre esta página en Safari',
    text: 'En el iPhone tiene que ser Safari. Chrome y el resto no pueden añadir la app a la pantalla de inicio.',
  },
  {
    n: '2',
    title: 'Pulsa Compartir',
    text: 'Es el cuadrado con la flecha hacia arriba, en la barra de abajo de Safari.',
  },
  {
    n: '3',
    title: 'Añadir a pantalla de inicio',
    text: 'Elige ese nombre, confirma con Añadir y EvoFit queda como una app, con su icono.',
  },
]

export function InstallPage() {
  const ios = isIos()
  const safari = isSafari()
  const installed = isStandalone()

  return (
    <div className="no-x-scroll mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-8">
      <div className="flex flex-col items-center text-center">
        <BrandLogo size="lg" />
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-evo-accent">Para iPhone</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Instala EvoFit</h1>
        <p className="mt-3 text-base leading-relaxed text-evo-muted">
          No hace falta App Store. Se añade a tu pantalla de inicio y se abre a pantalla completa, como una app.
        </p>
      </div>

      {installed ? (
        <div className="mt-8 rounded-3xl bg-evo-lime/15 p-5 text-center">
          <p className="font-display text-2xl font-bold text-evo-lime">Ya la tienes instalada</p>
          <p className="mt-2 text-base text-evo-text">Estás usando EvoFit desde el icono de la pantalla de inicio.</p>
        </div>
      ) : (
        <ol className="mt-8 space-y-3">
          {steps.map((step) => (
            <li key={step.n} className="flex gap-4 rounded-3xl bg-evo-surface p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-evo-accent font-display text-xl font-bold text-[#1a120c]">
                {step.n}
              </span>
              <div>
                <p className="font-display text-xl font-bold">{step.title}</p>
                <p className="mt-1 text-base leading-snug text-evo-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {ios && !safari && !installed ? (
        <p className="mt-5 rounded-2xl bg-evo-warn/15 px-4 py-3 text-base font-semibold text-evo-warn">
          Estás en otro navegador. Copia la dirección, ábrela en Safari y sigue los pasos.
        </p>
      ) : null}

      {!ios && !installed ? (
        <p className="mt-5 rounded-2xl bg-evo-surface-2 px-4 py-3 text-base text-evo-muted">
          En Android, abre el menú del navegador y elige «Añadir a pantalla de inicio» o «Instalar app».
        </p>
      ) : null}

      <p className="mt-8 text-center text-sm text-evo-muted">
        Dirección para compartir:{' '}
        <span className="font-semibold text-evo-text">{window.location.origin}/instalar</span>
      </p>
    </div>
  )
}
