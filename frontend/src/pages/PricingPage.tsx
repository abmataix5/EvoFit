import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/icons/Icon'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { StoreBadges } from '../components/StoreBadges'
import { PRICING, useFounderSpotsLeft } from '../lib/pricing'

const INCLUDED = [
  'Rutinas y entrenos sin límite',
  'Más de 200 ejercicios con fotos',
  'Gráficas de progreso, récords y rachas',
  'Liga semanal con tus amigos',
  'Feed, historias y mensajes',
  'Informes en PDF',
]

const SEGMENTS = 20

/** Las 100 plazas en una barra de 20 tramos: los ocupados en naranja, los libres en hueco. */
function SpotsMeter({ left }: { left: number }) {
  const taken = PRICING.founderSpots - left
  const filled = taken === 0 ? 0 : Math.max(1, Math.round((taken / PRICING.founderSpots) * SEGMENTS))
  return (
    <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-evo-border/50 bg-evo-surface p-5 text-left">
      <p className="flex items-baseline gap-2">
        <span className="font-display text-6xl font-extrabold leading-none text-evo-accent">{left}</span>
        <span className="font-bold leading-tight">
          {left === 1 ? 'plaza gratis libre' : 'plazas gratis libres'}
          <span className="block text-sm font-semibold text-evo-muted">de {PRICING.founderSpots} · {taken} ya cogidas</span>
        </span>
      </p>
      <div aria-hidden className="mt-4 flex gap-1 px-1">
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span key={index} className={['h-4 flex-1 -skew-x-[24deg] rounded-[3px]', index < filled ? 'bg-evo-accent' : 'bg-evo-surface-2'].join(' ')} />
        ))}
      </div>
    </div>
  )
}

function Included({ dark = false }: { dark?: boolean }) {
  return (
    <ul className="mt-5 space-y-2.5">
      {INCLUDED.map((item) => (
        <li key={item} className="flex items-start gap-2.5 font-semibold leading-snug">
          <Icon name="check" className={['mt-0.5 h-5 w-5 shrink-0', dark ? 'text-[#1a120c]' : 'text-evo-lime'].join(' ')} />
          {item}
        </li>
      ))}
    </ul>
  )
}

function Question({ title, children }: { title: string; children: string }) {
  return (
    <details className="group rounded-2xl border border-evo-border/50 bg-evo-surface px-5">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 text-lg font-bold [&::-webkit-details-marker]:hidden">
        {title}
        <Icon name="chevron" className="h-5 w-5 shrink-0 rotate-90 text-evo-accent transition group-open:-rotate-90" />
      </summary>
      <p className="pb-4 leading-relaxed text-evo-muted">{children}</p>
    </details>
  )
}

/** Precios: gratis para las 100 primeras cuentas; después, cuota mensual. El cobro aún no está activo. */
export function PricingPage() {
  const left = useFounderSpotsLeft()
  const soldOut = left === 0

  useEffect(() => {
    document.title = 'Precios · EvoFit'
    window.scrollTo(0, 0)
    return () => {
      document.title = 'EvoFit · Entrena, mejora, evoluciona'
    }
  }, [])

  return (
    <div className="no-x-scroll min-h-dvh">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-12 text-center lg:px-8 lg:pt-20">
          <p className="evo-kicker justify-center">Precios</p>
          <h1 className="mt-4 font-display text-[clamp(3rem,11vw,6rem)] font-extrabold uppercase leading-[0.88]">
            Los {PRICING.founderSpots} primeros
            <br />
            <span className="text-evo-accent">entrenan gratis</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-snug text-evo-muted lg:text-xl">
            EvoFit acaba de arrancar. Las primeras {PRICING.founderSpots} personas que creen su cuenta la tendrán gratis. A partir de la{' '}
            {PRICING.founderSpots + 1}, costará {PRICING.monthly} al mes.
          </p>
          {left !== undefined ? <SpotsMeter left={left} /> : null}
        </section>

        <section className="mx-auto grid max-w-4xl gap-4 px-4 pb-16 lg:grid-cols-2 lg:px-8 lg:pb-24" aria-label="Planes">
          {/* Plaza de fundador */}
          <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffb347] via-[#ff7a36] to-[#ee5a2c] p-6 text-[#1a120c] shadow-[0_24px_60px_rgba(255,122,54,0.25)] lg:p-8">
            <span aria-hidden className="evo-stripes pointer-events-none absolute inset-0" />
            <div className="relative">
              <p className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold uppercase tracking-[0.14em]">Fundador</span>
                <span className="rounded-full bg-[#1a120c] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.1em] text-white">
                  {soldOut ? 'Agotado' : `Solo ${PRICING.founderSpots} plazas`}
                </span>
              </p>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-[5.5rem] font-extrabold leading-[0.8]">0 €</span>
                <span className="text-lg font-extrabold">para siempre</span>
              </p>
              <p className="mt-3 font-semibold leading-snug opacity-85">
                Para las {PRICING.founderSpots} primeras cuentas. Sin tarjeta y sin letra pequeña: creas tu cuenta y la plaza es tuya.
              </p>
              <Included dark />
              {soldOut ? (
                <p className="mt-6 rounded-2xl bg-[#1a120c]/10 px-4 py-4 text-center font-extrabold">Las {PRICING.founderSpots} plazas ya están cogidas</p>
              ) : (
                <Link
                  to="/register"
                  className="mt-6 flex min-h-14 items-center justify-center gap-1.5 rounded-2xl bg-[#1a120c] px-6 text-lg font-extrabold text-white transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1a120c]/40"
                >
                  Coger mi plaza gratis
                  <Icon name="chevron" className="h-5 w-5" />
                </Link>
              )}
            </div>
          </article>

          {/* Cuota normal */}
          <article className="rounded-3xl border border-evo-border/50 bg-evo-surface p-6 lg:p-8">
            <p className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold uppercase tracking-[0.14em] text-evo-muted">Después</span>
              <span className="rounded-full bg-evo-surface-2 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.1em] text-evo-muted">
                Desde la cuenta {PRICING.founderSpots + 1}
              </span>
            </p>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-[5.5rem] font-extrabold leading-[0.8]">{PRICING.monthly}</span>
              <span className="text-lg font-extrabold text-evo-muted">al mes</span>
            </p>
            <p className="mt-3 font-semibold leading-snug text-evo-muted">
              Lo mismo que los fundadores, todo incluido. Menos de lo que cuesta un batido de proteínas.
            </p>
            <Included />
            <p className="mt-6 flex items-center gap-3 rounded-2xl bg-evo-surface-2 px-4 py-4 text-sm font-semibold leading-snug text-evo-muted">
              <Icon name="clock" className="h-5 w-5 shrink-0 text-evo-accent" />
              El pago todavía no está activo. Avisaremos antes de empezar a cobrar.
            </p>
          </article>
        </section>

        <section className="border-y border-evo-border/30 bg-evo-surface/40">
          <div className="mx-auto max-w-3xl px-4 py-16 lg:px-8 lg:py-20">
            <h2 className="text-center font-display text-[clamp(2.2rem,7vw,3.4rem)] font-extrabold uppercase leading-[0.95]">Dudas rápidas</h2>
            <div className="mt-8 space-y-3">
              <Question title="¿Qué tengo que hacer para ser de los 100 primeros?">
                Solo crear tu cuenta mientras queden plazas. No se pide tarjeta ni ningún dato de pago.
              </Question>
              <Question title="Si cojo una plaza gratis, ¿tendré que pagar más adelante?">
                No. Las 100 primeras cuentas se quedan gratis; la cuota de 2,99 € al mes es solo para las que lleguen después.
              </Question>
              <Question title="¿Qué pasa cuando se acaben las plazas?">
                Las cuentas nuevas tendrán una cuota de 2,99 € al mes. El pago todavía no está en marcha: cuando lo esté, se avisará aquí y dentro de la app antes de cobrar nada.
              </Question>
              <Question title="¿Habrá app en App Store y Google Play?">
                Sí, la estamos preparando y llegará en las próximas semanas. Mientras tanto, EvoFit funciona desde el navegador del móvil y se puede añadir a la pantalla de inicio. Tu cuenta y tus entrenos serán los mismos.
              </Question>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 text-center lg:px-8 lg:py-20">
          <p className="evo-kicker justify-center">Muy pronto</p>
          <h2 className="mt-3 font-display text-[clamp(2.2rem,7vw,3.4rem)] font-extrabold uppercase leading-[0.95]">
            También en <span className="text-evo-accent">las tiendas de apps</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg leading-snug text-evo-muted">
            La versión para iPhone y Android llegará en las próximas semanas. Si ya tienes cuenta, te estará esperando.
          </p>
          <StoreBadges className="mt-6 justify-center" />
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
