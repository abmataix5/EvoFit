import { useEffect, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { Icon } from '../components/icons/Icon'
import { SiteFooter } from '../components/SiteFooter'
import { LEGAL, LEGAL_LINKS } from '../lib/legal'

type LegalDoc = 'privacidad' | 'condiciones' | 'cookies' | 'aviso-legal'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl font-bold leading-tight">{title}</h2>
      <div className="space-y-3 leading-relaxed text-evo-muted [&_a]:font-semibold [&_a]:text-evo-accent [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-evo-text [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}

const Mail = () => <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>

function Privacy() {
  return (
    <>
      <Section title="Quién es el responsable">
        <p>
          El responsable de tus datos es <strong>{LEGAL.owner}</strong>, que mantiene EvoFit ({LEGAL.site}) como proyecto personal, sin ánimo de lucro
          ni actividad económica. Para cualquier cuestión sobre privacidad puedes escribir a <Mail />.
        </p>
      </Section>

      <Section title="Qué datos se guardan">
        <ul>
          <li>
            <strong>Tu cuenta:</strong> nombre, nombre de usuario, email y contraseña. La contraseña se guarda cifrada de forma irreversible: nadie
            puede leerla.
          </li>
          <li>
            <strong>Tu perfil (opcional):</strong> foto, biografía, ciudad, gimnasio, fecha de nacimiento, altura, nivel y objetivo.
          </li>
          <li>
            <strong>Tus entrenos:</strong> rutinas, ejercicios, series, pesos, repeticiones, tiempos y notas.
          </li>
          <li>
            <strong>Tu progreso (opcional):</strong> peso corporal y fotos de progreso. Las fotos de progreso son privadas: solo las ves tú.
          </li>
          <li>
            <strong>Lo social:</strong> amistades y solicitudes, entrenos que compartes (con su foto y texto), comentarios, reacciones, historias,
            mensajes privados, bloqueos y denuncias.
          </li>
          <li>
            <strong>Datos técnicos:</strong> la dirección IP y los registros habituales del servidor, que sirven para que la app funcione y para
            protegerla de abusos.
          </li>
        </ul>
        <p>
          El peso, la altura y las fotos del cuerpo son datos sensibles. Son opcionales: solo se guardan si tú decides apuntarlos, y al hacerlo das tu
          consentimiento para que se guarden con el único fin de enseñarte tu progreso. Puedes borrarlos cuando quieras.
        </p>
      </Section>

      <Section title="Para qué se usan">
        <ul>
          <li>Para que puedas usar la app: guardar tus entrenos, calcular tu progreso, tus récords y la liga semanal con tus amigos.</li>
          <li>Para mostrar a otras personas lo que tú decides compartir, según la visibilidad que elijas.</li>
          <li>Para avisarte por email de solicitudes de amistad, si no lo has desactivado en Configuración.</li>
          <li>Para mantener la app segura (evitar accesos indebidos y abusos).</li>
        </ul>
        <p>
          La base legal es la prestación del servicio que pides al crear tu cuenta, tu consentimiento para los datos opcionales y el interés
          legítimo en mantener la app segura. No se hacen perfiles con fines comerciales ni se toman decisiones automatizadas sobre ti.
        </p>
      </Section>

      <Section title="Quién puede ver tus datos">
        <ul>
          <li>
            <strong>Otras personas de EvoFit:</strong> lo que permitas. En Configuración eliges si tu perfil es público, solo para amigos o privado.
            Tu nombre, tu nombre de usuario y tu foto de perfil son visibles para quien te busque.
          </li>
          <li>
            <strong>El proveedor de alojamiento:</strong> la app y su base de datos están en un servidor situado en la Unión Europea, contratado a un
            proveedor de alojamiento que actúa como encargado del tratamiento. Tus datos no salen de la Unión Europea.
          </li>
        </ul>
        <p>
          Tus datos <strong>no se venden ni se ceden</strong> a terceros, y la app no tiene publicidad ni herramientas de analítica o seguimiento.
          Solo se entregarían a una autoridad si la ley lo exigiera.
        </p>
      </Section>

      <Section title="Cuánto tiempo se conservan">
        <ul>
          <li>Mientras tengas la cuenta abierta.</li>
          <li>Las historias se borran solas a las 24 horas.</li>
          <li>
            Si eliminas tu cuenta, se borran de inmediato tus datos, tus fotos y lo que hayas publicado. Las copias de seguridad se renuevan y las que
            contengan tus datos desaparecen en un máximo de 14 días.
          </li>
        </ul>
      </Section>

      <Section title="Tus derechos">
        <p>Puedes acceder a tus datos, corregirlos, borrarlos, oponerte a su uso, limitarlo o pedir una copia. La mayoría lo haces tú desde la app:</p>
        <ul>
          <li>
            <strong>Corregir:</strong> en «Editar perfil».
          </li>
          <li>
            <strong>Borrar:</strong> en Configuración → «Eliminar mi cuenta». Es inmediato y no se puede deshacer.
          </li>
          <li>
            <strong>Descargar tus entrenos:</strong> con los informes en PDF. Para una copia completa, escribe a <Mail />.
          </li>
        </ul>
        <p>
          Para cualquier otro derecho, escribe a <Mail />; se responde en un mes como máximo. Si crees que tus datos no se tratan bien, puedes
          reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noreferrer">www.aepd.es</a>).
        </p>
      </Section>

      <Section title="Edad mínima">
        <p>
          EvoFit es para personas de <strong>{LEGAL.minAge} años o más</strong>. Si sabes de una cuenta de alguien más joven, avisa en <Mail /> y se
          eliminará.
        </p>
      </Section>

      <Section title="Seguridad">
        <p>
          La conexión con la app va cifrada (HTTPS), las contraseñas se guardan cifradas y las fotos de progreso no son accesibles para nadie más.
          Ningún sistema es infalible: si hubiera una brecha que te afecte, se te avisará.
        </p>
      </Section>
    </>
  )
}

function Terms() {
  return (
    <>
      <Section title="Qué es EvoFit">
        <p>
          EvoFit es una aplicación web para apuntar entrenamientos, seguir tu progreso y compartirlo con amigos. La mantiene {LEGAL.owner} como
          proyecto personal y es <strong>gratuita</strong>. Al crear una cuenta aceptas estas condiciones.
        </p>
      </Section>

      <Section title="Tu cuenta">
        <ul>
          <li>
            Tienes que tener <strong>{LEGAL.minAge} años o más</strong>.
          </li>
          <li>Los datos de registro deben ser tuyos y verdaderos. Una cuenta por persona.</li>
          <li>Eres responsable de guardar tu contraseña y de lo que se haga con tu cuenta.</li>
          <li>Puedes eliminar tu cuenta cuando quieras desde Configuración.</li>
        </ul>
      </Section>

      <Section title="Lo que publicas">
        <p>
          Las fotos, textos, comentarios y mensajes que subes son tuyos. Al publicarlos das permiso para mostrarlos dentro de EvoFit a las personas
          que tú elijas según tu configuración de privacidad; nada más.
        </p>
        <p>No está permitido:</p>
        <ul>
          <li>Acosar, insultar, amenazar o suplantar a otras personas.</li>
          <li>Subir contenido ilegal, violento, sexual o que no tengas derecho a compartir, ni fotos de otras personas sin su permiso.</li>
          <li>Hacer publicidad, enviar spam o usar la app con fines comerciales.</li>
          <li>Intentar acceder a datos de otros, saturar el servicio o saltarse sus medidas de seguridad.</li>
        </ul>
        <p>
          Puedes bloquear y denunciar a cualquier persona desde su perfil. Las cuentas o contenidos que incumplan estas normas pueden retirarse sin
          previo aviso.
        </p>
      </Section>

      <Section title="Tu salud es cosa tuya">
        <p>
          EvoFit <strong>no da consejo médico ni de entrenamiento personalizado</strong>. Las cifras, sugerencias y descripciones de ejercicios son
          orientativas. Entrena dentro de tus posibilidades y consulta a un profesional antes de empezar si tienes alguna lesión o problema de salud.
          Cada persona es responsable de cómo entrena.
        </p>
      </Section>

      <Section title="El servicio, tal cual">
        <p>
          Al ser un proyecto personal y gratuito, EvoFit se ofrece «tal cual»: puede tener errores, cambiar, interrumpirse o dejar de existir. Se
          hacen copias de seguridad, pero no se garantiza que los datos no se pierdan; si algo te importa mucho, guárdalo también por tu cuenta (por
          ejemplo, con los informes en PDF). En la medida que la ley lo permita, no se responde de los daños derivados del uso de la app.
        </p>
      </Section>

      <Section title="Marca y contenido de la app">
        <p>
          El nombre, el logotipo, el diseño y el código de EvoFit pertenecen a su titular. No se pueden copiar ni reutilizar sin permiso.
        </p>
      </Section>

      <Section title="Cambios y ley aplicable">
        <p>
          Estas condiciones pueden cambiar; si el cambio es importante se avisará en la app. Se rigen por la ley española. Para cualquier duda,
          escribe a <Mail />.
        </p>
      </Section>
    </>
  )
}

function Cookies() {
  return (
    <>
      <Section title="En resumen">
        <p>
          EvoFit <strong>solo usa cookies técnicas</strong>, las imprescindibles para que puedas iniciar sesión. No hay cookies de publicidad, ni de
          analítica, ni de terceros. Por eso no verás ningún aviso para aceptarlas: la ley no lo exige para este tipo de cookies.
        </p>
      </Section>

      <Section title="Cookies que se usan">
        <ul>
          <li>
            <strong>evofit-session:</strong> mantiene tu sesión iniciada. Caduca sola al cabo de un tiempo sin usar la app o al cerrar sesión.
          </li>
          <li>
            <strong>XSRF-TOKEN:</strong> protege los formularios frente a envíos fraudulentos desde otras webs.
          </li>
        </ul>
      </Section>

      <Section title="Lo que se guarda en tu dispositivo">
        <p>Además, la app guarda en tu móvil o navegador (no en una cookie) algunos datos para funcionar mejor:</p>
        <ul>
          <li>Tus preferencias: tema claro u oscuro, la vista elegida en el inicio y la modalidad de la liga.</li>
          <li>El entreno que estás apuntando, para no perderlo si te quedas sin cobertura.</li>
          <li>Tu última sesión, para poder abrir la app sin conexión.</li>
          <li>Los archivos de la propia app, para que cargue más rápido.</li>
        </ul>
        <p>Todo esto se queda en tu dispositivo y se borra al cerrar sesión o al borrar los datos del navegador.</p>
      </Section>

      <Section title="Cómo borrarlas o bloquearlas">
        <p>
          Puedes borrar o bloquear las cookies desde los ajustes de tu navegador. Si bloqueas las de EvoFit no podrás iniciar sesión, porque son las
          que la mantienen.
        </p>
      </Section>
    </>
  )
}

function Notice() {
  return (
    <>
      <Section title="Titular">
        <ul>
          <li>
            <strong>Titular:</strong> {LEGAL.owner}
          </li>
          <li>
            <strong>Sitio web:</strong> {LEGAL.url}
          </li>
          <li>
            <strong>Contacto:</strong> <Mail />
          </li>
        </ul>
        <p>
          EvoFit es un proyecto personal, gratuito y sin actividad económica: no vende productos ni servicios, no tiene publicidad y no obtiene
          ingresos.
        </p>
      </Section>

      <Section title="Uso del sitio">
        <p>
          El acceso a la portada es libre. Para usar la aplicación hace falta crear una cuenta y aceptar las{' '}
          <Link to="/condiciones">condiciones de uso</Link> y la <Link to="/privacidad">política de privacidad</Link>.
        </p>
      </Section>

      <Section title="Propiedad intelectual">
        <p>
          El nombre EvoFit, su logotipo, el diseño y el código de la aplicación pertenecen a su titular. Los contenidos que suben los usuarios son de
          quien los sube. Las fotografías de la biblioteca de ejercicios pertenecen a sus respectivos autores.
        </p>
      </Section>

      <Section title="Responsabilidad">
        <p>
          La información de la app es orientativa y no sustituye el consejo de un profesional sanitario o del deporte. El titular no se hace
          responsable del uso que cada persona haga de ella ni de los contenidos publicados por los usuarios, aunque retirará los que incumplan las
          normas en cuanto tenga conocimiento. Los enlaces a otras webs son solo informativos.
        </p>
      </Section>

      <Section title="Ley aplicable">
        <p>Este sitio se rige por la legislación española.</p>
      </Section>
    </>
  )
}

const DOCS: Record<LegalDoc, { title: string; lead: string; body: () => ReactNode }> = {
  privacidad: { title: 'Política de privacidad', lead: 'Qué datos guarda EvoFit, para qué y cómo controlarlos.', body: Privacy },
  condiciones: { title: 'Condiciones de uso', lead: 'Las normas para usar EvoFit, en claro.', body: Terms },
  cookies: { title: 'Política de cookies', lead: 'Solo las imprescindibles para iniciar sesión.', body: Cookies },
  'aviso-legal': { title: 'Aviso legal', lead: 'Quién está detrás de EvoFit.', body: Notice },
}

/** Páginas legales públicas: privacidad, condiciones, cookies y aviso legal. */
export function LegalPage() {
  const navigate = useNavigate()
  // El documento sale de la dirección (/privacidad, /condiciones…).
  const path = useLocation().pathname.replace(/^\/|\/$/g, '')
  const doc: LegalDoc = path in DOCS ? (path as LegalDoc) : 'privacidad'
  const { title, lead, body: Body } = DOCS[doc]

  useEffect(() => {
    document.title = `${title} · EvoFit`
    window.scrollTo({ top: 0 })
  }, [title])

  /** Vuelve a donde estabas (registro, configuración…) o, si llegaste por un enlace directo, a la portada. */
  function back() {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/')
  }

  return (
    <div className="no-x-scroll flex min-h-dvh flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-evo-border/30 bg-evo-bg">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="EvoFit, ir a la portada">
            <BrandLogo size="sm" decorative />
            <span className="font-display text-2xl font-extrabold uppercase">
              Evo<span className="text-evo-accent">Fit</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={back}
            className="-mr-2 flex min-h-11 items-center gap-1 rounded-2xl px-3 text-sm font-bold text-evo-muted transition hover:bg-evo-surface-2 hover:text-evo-text active:scale-95"
          >
            <Icon name="back" className="h-4 w-4" />
            Volver
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p className="evo-kicker">Legal</p>
        <h1 className="mt-3 font-display text-[clamp(2.4rem,9vw,3.6rem)] font-extrabold uppercase leading-[0.95]">{title}</h1>
        <p className="mt-2 text-lg text-evo-muted">{lead}</p>
        <p className="mt-1 text-sm text-evo-muted">Última actualización: {LEGAL.updated}</p>

        <nav aria-label="Documentos legales" className="mt-6 flex flex-wrap gap-2">
          {LEGAL_LINKS.map((link) => {
            const active = link.to === `/${doc}`
            return (
              <Link
                key={link.to}
                to={link.to}
                replace
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex min-h-11 items-center rounded-full px-4 text-sm font-bold transition active:scale-95',
                  active ? 'bg-evo-accent text-[#1a120c]' : 'bg-evo-surface-2 text-evo-text',
                ].join(' ')}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-8 space-y-8 text-[1.05rem]">
          <Body />
        </div>
      </main>

      <SiteFooter showAccountLinks={false} />
    </div>
  )
}
