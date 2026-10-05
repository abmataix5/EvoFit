/** ~14 mensajes por día (~98 total). Rotan cada fecha (estables el mismo día). */

export type DayMotivation = {
  label: string
  headline: string
  line: string
}

type DayPack = {
  label: string
  messages: Array<{ headline: string; line: string }>
}

const packs: Record<number, DayPack> = {
  0: {
    label: 'Domingo',
    messages: [
      { headline: 'El sofá ya te ha adoptado', line: 'Hoy o te levantas, o el lunes te encuentra en la misma postura que el mando.' },
      { headline: 'Mañana es lunes, figura', line: 'Puedes llegar con el cuerpo despierto o con cara de haber hibernado. Elige con cabeza.' },
      { headline: 'Domingo de verdad', line: 'Descansar vale. Mentirte con lo de “el lunes empiezo” ya lo tenemos muy visto.' },
      { headline: 'Ni el mando se mueve', line: 'Si hoy no sales de casa, al menos bebe agua. El sofá no hidrata, solo abraza.' },
      { headline: 'Último round del finde', line: 'O cierras la semana como alguien que entrena, o el sofá se queda con el cinturón.' },
      { headline: 'Duerme, pero no te escondas', line: 'Come decente, duerme de verdad y mañana entras al gym como quien va a cobrar una deuda.' },
      { headline: 'El espejo no tiene filtro', line: 'Dime la verdad: ¿entrenaste esta semana o solo miraste el batido de otros?' },
      { headline: 'Gloria o pizza', line: 'Las dos caben en un domingo. La pizza sola, sin haber movido nada, ya es otro deporte.' },
      { headline: 'Paz, pero con proteína', line: 'Puedes estar tranquilo y aun así hacer algo. Estirar cuenta. El scroll infinito, no.' },
      { headline: 'Quedan pocas horas de finde', line: 'Úsalas con un poco de dignidad. El lunes no se impresiona con tus siestas.' },
      { headline: 'El corazón también quiere plan', line: 'Un paseo, un poco de core, lo que sea. Que no crea que solo late por el grupo de WhatsApp.' },
      { headline: 'Mañana piden carnet', line: 'El lunes va a preguntar si eres atleta o mueble. Hoy todavía puedes votar.' },
      { headline: 'Que no parezca un anuncio de colchón', line: 'Cierra la semana con algo de acción. Veinte minutos ya te sacan del anuncio.' },
      { headline: 'Aunque sean veinte minutos', line: 'Hazlos con cara de que te están grabando. El sofá que espere su turno.' },
    ],
  },
  1: {
    label: 'Lunes',
    messages: [
      { headline: 'El sofá ya tuvo su finde', line: 'Hoy toca demostrar que no eras solo un rumor de gimnasio.' },
      { headline: 'No hace falta un récord', line: 'Hace falta que aparezcas. El resto es sudor, y el sudor no negocia.' },
      { headline: '“Estoy cansado” no es un plan', line: 'Es un estado de ánimo. El plan está en la agenda. A ver si coincidís.' },
      { headline: 'Ego en la taquilla', line: 'Déjalo ahí y sácale pecho a la barra. Una cosa es fardar y otra es empujar.' },
      { headline: 'Si aguantas el lunes', line: 'El martes ya te mira con otro respeto. Hoy solo tienes que no escaquearte.' },
      { headline: 'Café y hierro', line: 'La combinación más legal para sentirte peligroso un lunes por la mañana.' },
      { headline: 'Sin rugidos de película', line: 'No hace falta gritar. Hace falta no inventarte una baja médica mental.' },
      { headline: 'Hoy no construyes Roma', line: 'Pones el primer bloque. Y oye, el bloque cuenta más que el discurso.' },
      { headline: 'La alarma ha ganado el primer asalto', line: 'Los que entrenan también odian el lunes. La diferencia es que van igual.' },
      { headline: 'Cuarenta y cinco minutos y listo', line: 'Firma eso contigo. Luego puedes volver a ser una persona normal.' },
      { headline: 'Empieza feo, acaba decente', line: 'Esa es la estética oficial del lunes. Nadie pide belleza a las siete.' },
      { headline: 'Tu yo del viernes te está mirando', line: 'No le falles. Quiere llegar al finde entrenado, no solo bien alimentado de pan.' },
      { headline: 'Calienta y deja el drama', line: 'El lunes premia a quien no monta una telenovela antes de la primera serie.' },
      { headline: 'Ronda uno de siete', line: 'Campana. Guantes. A sudar un rato y dejar de negociar con la almohada.' },
    ],
  },
  2: {
    label: 'Martes',
    messages: [
      { headline: 'Ayer fue el tráiler', line: 'Hoy estrenas. Misma sala, menos excusas y un poco más de acción.' },
      { headline: 'Ya no eres el del lunes', line: 'Eres el que vuelve. Eso, en el gym, impone más que un dorsal nuevo.' },
      { headline: 'Hoy se pule, no se farda', line: 'Menos ego y más repeticiones limpias. La barra nota la diferencia.' },
      { headline: 'Si ayer faltaste, hoy pagas', line: 'Y si ayer fuiste, hoy confirmas que no fue un espejismo.' },
      { headline: 'Cuando digas “ya está”', line: 'Haz una más. Esa es la que luego cuentas. Las otras son calentamiento.' },
      { headline: 'Hoy no se improvisa el desastre', line: 'Mide, apunta y empuja. El caos lo dejas para el grupo de amigos.' },
      { headline: 'Si duele un poco, estás vivo', line: 'Celebra con comida de verdad, no con un speech de víctima.' },
      { headline: 'Entra, entrena y vete', line: 'Sin discurso. Este mensaje ya ha hablado bastante por ti.' },
      { headline: 'Aquí se caen los “en serio”', line: 'El martes es donde la gente desaparece. Tú, por una vez, no.' },
      { headline: 'Busca el pump, no el like', line: 'Instagram puede esperar. El bíceps, no tanto.' },
      { headline: 'Pon la canción de malo', line: 'La que te pone chulo. Y mueve el peso como si debieras dinero.' },
      { headline: 'Hoy no hace falta inspiración', line: 'Hace falta fichar. La motivación es un invitado, tú eres el que abre el gym.' },
      { headline: 'Pareces pro si controlas la bajada', line: 'Omóplatos, aire, sin rebotes. Nadie tiene que saber que lo acabas de leer.' },
      { headline: 'Misión de hoy: acabar la sesión', line: 'Recompensa: poder mirarte luego sin negociar con la conciencia.' },
    ],
  },
  3: {
    label: 'Miércoles',
    messages: [
      { headline: 'Aquí se ve quién entrena', line: 'Y quién solo abre la app para sentirse deportista un segundo.' },
      { headline: 'Mitad de puente', line: 'O cruzas al otro lado de la semana, o te quedas en el “mañana seguro”.' },
      { headline: 'El camello aguanta. Tú también', line: 'El desierto es el curl de hoy. Misma paciencia, mejor foto.' },
      { headline: 'Baja el ego, sube la barra', line: 'Si esta semana va al revés, vamos mal de cuentas.' },
      { headline: 'Da igual la cara que traigas', line: 'El hierro no pregunta cómo estás. Pregunta si vas a empujar.' },
      { headline: 'Lo difícil es no desaparecer ahora', line: 'Empezar lo hace cualquiera. Quedarse a mitad de semana ya es de los nuestros.' },
      { headline: 'No hace falta incendiar el gym', line: 'Hace falta no apagar la mecha con una siesta estratégica.' },
      { headline: 'Hoy eres el contable del músculo', line: 'Series, kilos, tiempos. Apunta. Fardar de memoria no sube el peso.' },
      { headline: 'El viernes ya te está oliendo', line: 'Si hoy rindes, llega más suave. Si no, llega igual, pero con la mirada esa.' },
      { headline: 'Una hora de bestia y vuelves', line: 'Luego puedes ser oficinista otra vez. Durante la sesión, no cuela.' },
      { headline: 'Nadie necesita tu speech', line: 'Hace falta sudor y cara de “hecho”. El resto es ruido.' },
      { headline: 'No frenes en medio', line: 'El sofá ya tiene bastante protagonismo en tu vida. Hoy no le toca.' },
      { headline: 'Tres síes y eres peligroso', line: '¿Dormiste? ¿Comiste? ¿Vas a entrenar? Si fallan dos, ya sabemos el chiste.' },
      { headline: '“Cuando tenga tiempo”', line: 'Ese chiste ya no hace gracia. El tiempo es hoy, entre esta serie y la siguiente.' },
    ],
  },
  4: {
    label: 'Jueves',
    messages: [
      { headline: 'El viernes te está mirando', line: 'Llega hinchado de entrenar, no hinchado de “mañana lo hago”.' },
      { headline: 'Quien flojea hoy', line: 'Llega al sábado con la frase “podría haber”. Esa frase no levanta peso.' },
      { headline: 'Un kilo. Una repe. Algo', line: 'No hace falta récord mundial. Hace falta no quedarte en el mismo sitio por miedo.' },
      { headline: 'Carga ahora, celebra luego', line: 'El viernes sienta mejor cuando el cuerpo ya ha currado.' },
      { headline: '“Casi” no puntúa', line: 'Hoy sí. Remata lo que llevas a medias antes de que el finde te líe.' },
      { headline: 'El cuerpo pide sofá', line: 'Tú pide series. Gana el que sea más cabezón, y hoy te toca serlo tú.' },
      { headline: 'Intensidad alta, drama bajo', line: 'Entras, aprietas y sales con la moral más alta que las excusas.' },
      { headline: 'El espejo te debe una', line: 'Cóbrala con volumen. Que el reflejo empiece a pagar.' },
      { headline: 'Última serie como una apuesta', line: 'Música de pelea y cara de que esta no se deja a medias.' },
      { headline: 'El cansancio demuestra que existes', line: 'Conviértelo en repeticiones, no en un audio de queja.' },
      { headline: 'Actitud de viernes, curro de jueves', line: 'Puedes ir chulo. Lo que no puedes es ir flojo.' },
      { headline: 'Un día más y la semana queda decente', line: 'No la dejes en borrador por una tarde vaga.' },
      { headline: 'Cierra lo que dejaste a medias', line: 'Hoy se terminan los “luego lo apunto”. Luego eres tú, dentro de una hora.' },
      { headline: 'El que entrena en jueves', line: 'Llega al finde de otra manera. Los demás llegan con la historia del sofá.' },
    ],
  },
  5: {
    label: 'Viernes',
    messages: [
      { headline: 'El finde te está retando', line: 'Sudor ahora. Luego ya puedes hacerte el interesante.' },
      { headline: 'Hoy se cobra la semana', line: 'Lo que invertiste de lunes a jueves se nota aquí, o se nota que no estaba.' },
      { headline: 'Con el mundo, amable', line: 'Con tus excusas, ni una. Al rack, que el finde no te va a esperar.' },
      { headline: 'El after empieza en el gym', line: 'Luego, si quieres, el refresco. Al revés queda un poco triste.' },
      { headline: 'Nada de media sesión', line: 'Sesión. Entera. Con principio, sudor y punto final.' },
      { headline: 'Sube el peso, baja el drama', line: 'Y la queja, si puede ser, déjala en la puerta.' },
      { headline: 'Que el finde te pille entrenado', line: 'Cansado de haber ido, no cansado de haberlo pensado.' },
      { headline: 'Cierra la semana con algo contable', line: 'Una sesión que luego puedas contar sin inventarte la mitad.' },
      { headline: 'Hoy la barra es la cena', line: 'Tú pones el hambre. Ella pone la resistencia. A ver quién gana.' },
      { headline: 'Nada sienta mejor que haber empujado', line: 'La terraza puede esperar veinte series. El press, no.' },
      { headline: 'El “el lunes empiezo” ya caducó', line: 'Es viernes. Hoy se entrena y se deja de hacer campaña electoral.' },
      { headline: 'Sal más ancho de actitud', line: 'El músculo tarda. La cara de haber cumplido, no.' },
      { headline: 'Apaga las dudas, no la sesión', line: 'El ritual es simple: entras, acabas, y luego ya eres libre.' },
      { headline: 'Si has llegado hasta aquí', line: 'No te hagas el misterioso. Demuestra que la semana no fue postureo.' },
    ],
  },
  6: {
    label: 'Sábado',
    messages: [
      { headline: 'Hoy no hay jefe al que echar la culpa', line: 'Si no vas, el sofá te ficha como socio. Y ya sabes que no paga cuota.' },
      { headline: 'Primero el banco, luego el brunch', line: 'El aguacate respeta más a quien ya ha sudado.' },
      { headline: 'El rack antes que el sofá', line: 'Ese orden. El otro orden ya lo tienes muy ensayado.' },
      { headline: 'Que puedan decir que fuiste', line: '“Entrena hasta el sábado” suena mejor que “solo pide a domicilio”.' },
      { headline: 'Nadie te manda. Peor', line: 'Te manda el tú de dentro de un mes, y ese no acepta excusas de sábado.' },
      { headline: 'Pump y luego sofá', line: 'En ese orden. Sofá sin pump es hacerte trampas al solitario.' },
      { headline: 'Si no hay récord, que haya presencia', line: 'Aparecer también pesa. Desaparecer, solo pesa en la conciencia.' },
      { headline: 'Entra como si fuera el tráiler', line: 'Sal como si hubieras acabado la película. Aunque dure cuarenta minutos.' },
      { headline: 'El sofá ya está nervioso', line: 'Sabe que hoy puedes dejarlo plantado una hora. Hazle ese feo.' },
      { headline: 'El brunch no es un entrenamiento', line: 'Por mucho que el huevo lleve proteína. Primero mueves, luego comes.' },
      { headline: 'Hoy no mira nadie el reloj de la oficina', line: 'Así que no tienes ni esa excusa. Qué incómodo, ¿eh?' },
      { headline: 'Ayer fue el aviso', line: 'Hoy es la confirmación. O entrenas, o el finde te entrena a ti en el sofá.' },
      { headline: 'El lunes es otra película', line: 'Hoy es sábado. Entrena en este capítulo, no en el que todavía no existe.' },
      { headline: 'Reírte entre series, sí', line: 'Rendirte entre series, ya hace menos gracia. Elige el chiste bueno.' },
    ],
  },
}

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getFullYear(), 0, 0)
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((now - start) / 86_400_000)
}

function stripEmoji(value: string) {
  return value
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function firstName(name?: string | null) {
  const part = name?.trim().split(/\s+/)[0]
  return part && part.length > 0 ? part : 'atleta'
}

export function helloLine(name?: string | null) {
  return `Hola, ${firstName(name)}`
}

export function getDayMotivation(date = new Date()): DayMotivation {
  const pack = packs[date.getDay()] ?? packs[1]
  const idx = dayOfYear(date) % pack.messages.length
  const picked = pack.messages[idx]!
  return {
    label: pack.label,
    headline: stripEmoji(picked.headline),
    line: stripEmoji(picked.line),
  }
}

const shortDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const

export function formatHeaderDay(date = new Date()) {
  const day = shortDays[date.getDay()]
  const num = date.getDate()
  return { day, num, full: `${day} ${num}` }
}

export function localDateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
