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
      { headline: 'Domingo de jefe final 👑', line: 'Mañana es lunes. Hoy decides si llegas hecho un tanque… o hecho un croissant.' },
      { headline: 'Modo iglesia del hierro 🙏🏋️', line: 'Reza a la barra. O duerme. Pero no digas “el lunes empiezo” otra vez.' },
      { headline: 'Domingo premium 🧃', line: 'Descansa como un pro o entrena como un loco. Los dos valen. Quejarse, no.' },
      { headline: 'Última llamada del finde 📞', line: 'Si hoy no mueves ni el mando, al menos hidrátate como si fueras un camello fitness.' },
      { headline: 'Boss stage desbloqueado 🐉', line: 'El domingo no perdona: o rematas la semana o aceptas que el sofá te ha ganado el round.' },
      { headline: 'Reset silencioso 🔄', line: 'Come bien, duerme bestia y mañana caes al gym como quien llega a cobrar.' },
      { headline: 'Domingo sin filtro 🪞', line: 'Mírate al espejo y di la verdad: ¿entrenaste o solo subiste stories del batido?' },
      { headline: 'Leyenda o leyenda urbana 📜', line: 'Hoy puedes cerrar la semana con gloria… o con pizza. Elige tu arco narrativo.' },
      { headline: 'Modo monje muscular 🧘💪', line: 'Paz interior + protein shake. El combo domingo que los dioses del gym aprueban.' },
      { headline: 'Cuenta atrás al lunes ⏳', line: 'Quedan pocas horas de “finde vibes”. Úsalas con dignidad atlética.' },
      { headline: 'Domingo cardíaco 💓', line: 'Un paseíto, un core, algo. Que el corazón no piense que solo late por el WhatsApp.' },
      { headline: 'Rey del descanso activo 🦁', line: 'Movilidad, estirones y actitud. Mañana el lunes te va a pedir el carnet de atleta.' },
      { headline: 'Epílogo épico 🎬', line: 'Cierra la semana como película de acción, no como anuncio de colchón.' },
      { headline: 'Domingo con swagger 😎', line: 'Aunque solo hagas 20 minutos, hazlos como si te estuviera grabando Stallone.' },
    ],
  },
  1: {
    label: 'Lunes',
    messages: [
      { headline: 'Lunes de reset mental 🧠⚡', line: 'El sofá ya tuvo su momento. Hoy toca demostrar que no eras solo un rumor del gym.' },
      { headline: 'Arranca el motor 🚗💨', line: 'Nadie pide un PR histórico. Solo que te presentes. El resto es magia con sudor.' },
      { headline: 'Lunes anti-excusas 🚫😴', line: '“Estoy cansado” no es un plan de entrenamiento. Es un estado de ánimo. Supéralo.' },
      { headline: 'Semana nueva, ego nuevo 🪞', line: 'Deja el ego en la taquilla… y sácale pecho a la barra. Equilibrio.' },
      { headline: 'Modo jefe de semana 📈', line: 'Si sobrevives al lunes con dignidad, el martes ya te mira con respeto.' },
      { headline: 'Café + hierro ☕🏋️', line: 'La combinación más legal para sentirte ilegalmente productivo.' },
      { headline: 'Lunes con chispa ✨', line: 'No hace falta rugir en cada serie. Basta con no fantasear con la baja médica inventada.' },
      { headline: 'Primera piedra 🧱', line: 'Hoy no construyes el coliseo. Solo pones el primer bloque. Y cuenta.' },
      { headline: 'Alarma 1, motivación 0… aún así 😤', line: 'Los campeones también odian los lunes. La diferencia: van igual.' },
      { headline: 'Operación “no flojera” 🛡️', line: 'Firma un pacto contigo: 45 minutos. Luego puedes volver a ser humano.' },
      { headline: 'Lunes glow-up 🌟', line: 'Empieza feo, termina heroico. Esa es la estética oficial del día.' },
      { headline: 'Tu yo del viernes te está mirando 👀', line: 'No le falles. Ese tú del finde quiere llegar hinchado, no hinchado de pan.' },
      { headline: 'Arranque suave, intención dura 🎯', line: 'Calienta bien y ataca. El lunes premia a quien no dramiza.' },
      { headline: 'Bienvenido al ring 🥊', line: 'Campana: ronda 1 de 7. Guantes puestos. A sudar con estilo.' },
    ],
  },
  2: {
    label: 'Martes',
    messages: [
      { headline: 'Martes con hambre de hierro 🍖🏋️', line: 'El lunes fue el tráiler. Hoy estrenas la película: misma sala, más acción.' },
      { headline: 'Día 2, cero drama 😌💪', line: 'Ya no eres “el del lunes”. Eres el que vuelve. Eso intimida… en el buen sentido.' },
      { headline: 'Martes técnico 🛠️', line: 'Hoy se pule la técnica. Menos ego, más repeticiones limpias y cara de concentración.' },
      { headline: 'Gasolina residual del lunes ⛽', line: 'Úsala. Si ayer empezaste, hoy consolidás. Si ayer fallaste… hoy te redimes en HD.' },
      { headline: 'Martes de “una más” 🔥', line: 'Cuando digas “ya está”, haz una más. Esa es la que cuenta en el lore.' },
      { headline: 'Modo laboratorio 🧪', line: 'Prueba, mide, mejora. Hoy no improvisas el desastre: entrenas con intención.' },
      { headline: 'El cuerpo ya enteró el chiste 😏', line: 'Duele un poco = estás vivo y en proceso. Celebra con proteína, no con lamentos.' },
      { headline: 'Martes ninja 🥷', line: 'Entra, entrena, sal. Silencioso, efectivo, sin discursos motivacionales… excepto este.' },
      { headline: 'Segundo asalto 🥊', line: 'El martes es donde se caen los “empezaré en serio”. Tú no. Tú sigues.' },
      { headline: 'Pump tuesday 💧💪', line: 'Busca la congestión, no la gloria de Instagram. La gloria llega luego… o no, pero el pump sí.' },
      { headline: 'Martes con playlist de villano 🎧😈', line: 'Pon esa canción que te hace sentir ilegal y mueve hierro como si debieras dinero.' },
      { headline: 'Consistencia > motivación 🧱', line: 'Hoy no hace falta inspiración divina. Hace falta mostrar el carnet de asistencia.' },
      { headline: 'Día de detalles 🔍', line: 'Aprieta omóplatos, controla la bajada, respira. Pareces pro sin decirlo.' },
      { headline: 'Martes: misión cumplible 🎮', line: 'Objetivo sidequest: completar sesión. Recompensa: dopamina + respeto propio.' },
    ],
  },
  3: {
    label: 'Miércoles',
    messages: [
      { headline: 'Mitad de semana, cero medias tintas ⚖️', line: 'Ni al principio ni al final: aquí se ve quién entrena y quién solo renueva la app.' },
      { headline: 'Miércoles puente 🌉', line: 'Cruzas al lado luminoso de la semana… o te quedas en el limbo del “mañana”.' },
      { headline: 'Hump day muscular 🐪💪', line: 'El camello aguanta el desierto. Tú aguantas el curl. Misma energía, más estética.' },
      { headline: 'Chequeo de ego 🧾', line: 'Si bajaste kilos en el ego y subiste en la barra, vas ganando el semestre.' },
      { headline: 'Miércoles con cara de martes 😅', line: 'Da igual. El hierro no pregunta cómo te sientes. Solo si vas a empujar.' },
      { headline: 'Zona media desbloqueada 🗺️', line: 'Lo difícil no es empezar: es no abandonar en la mitad. Spoilers: tú no abandonas.' },
      { headline: 'Día de mantener el fuego 🔥', line: 'No hace falta incendiar el gym. Basta con no dejar que se apague la mecha.' },
      { headline: 'Miércoles administrativo del músculo 🗂️', line: 'Organiza series, anota kilos, sé el contable más swole de tu ciudad.' },
      { headline: 'El finde ya te huele 👃🎉', line: 'Si rindes hoy, el viernes llega más suave. Si no… el viernes llega igual, pero con culpa.' },
      { headline: 'Midweek monster 👹', line: 'Transformación corta: de oficinista a bestia durante 60 minutos. Luego vuelves… cambiado.' },
      { headline: 'Miércoles sin spoilers 🤫', line: 'Nadie necesita saber tu plan. Solo el resultado: sudor y cara de “misión ok”.' },
      { headline: 'Empuja el centro de la semana 🚂', line: 'Tú eres la locomotora. El sofá es un vagón abandonado. No frenes aquí.' },
      { headline: 'Día de form check mental ✅', line: '¿Dormiste? ¿Comiste? ¿Vas a entrenar? Tres síes y eres imbatible hasta el domingo.' },
      { headline: 'Miércoles con punchline 🥊😂', line: 'La broma es entrenar “cuando tenga tiempo”. El chiste eres tú si caes en ella.' },
    ],
  },
  4: {
    label: 'Jueves',
    messages: [
      { headline: 'Jueves de hierro forjado ⚒️', line: 'El viernes te mira. Entrena hoy para llegar al finde hinchado, no hinchado de excusas.' },
      { headline: 'Pre-finde auténtico 🌅', line: 'Queda poco. Quien flojee ahora llega al sábado con cara de “podría haber…”.' },
      { headline: 'Jueves con sed de PR 🏆', line: 'No tiene que ser récord mundial. Un kilo más. Una rep más. Un poco más de carácter.' },
      { headline: 'Gasolina de fin de semana ⛽🔥', line: 'Carga ahora. El viernes se celebra mejor cuando el cuerpo ya ha sufrido con honor.' },
      { headline: 'Jueves “casi llegamos” 🏁', line: 'Casi no cuenta. Hoy sí cuenta. Remata la faena semanal como un profesional del sudor.' },
      { headline: 'Día de no negociar 🤝❌', line: 'El cuerpo pide sofá. Tú pides series. Gana el que firma el contrato más estricto: tú.' },
      { headline: 'Jueves brutal light 😈', line: 'Intensidad alta, drama bajo. Entras, rompes (figuradamente), sales más alto de moral.' },
      { headline: 'El mirror te debe una 🪞💸', line: 'Cobra la deuda con volumen. Que el reflejo empiece a pagar intereses.' },
      { headline: 'Jueves de playlist pesada 🎸', line: 'Música de pelea, cara de concentración, última serie como si pagaras una apuesta.' },
      { headline: 'Cuarta ronda 🥊', line: 'Cansancio acumulado = prueba de que existes. Convierte eso en repeticiones, no en tweets.' },
      { headline: 'Jueves con swagger de viernes 😎', line: 'Adelanta la actitud. Entrena como si ya fuera finde… pero sin la flojera del finde.' },
      { headline: 'Casi héroe 🦸', line: 'Un día más y la semana queda en marco dorado. No la dejes en borrador.' },
      { headline: 'Jueves: modo acabador 🧹💪', line: 'Limpia lo que dejaste a medias. Hoy se cierran ciclos y se abren venas (de pump).' },
      { headline: 'Aviso a navegantes 🏴‍☠️', line: 'Quien entrena en jueves navega distinto el finde. Capitán, sube al barco del rack.' },
    ],
  },
  5: {
    label: 'Viernes',
    messages: [
      { headline: 'Viernes bestia 🦁🔥', line: 'Sudor ahora, orgullo después. Entrena como si el finde te estuviera retando a duelo.' },
      { headline: 'Payday del músculo 💰💪', line: 'Cobra lo que invertiste Lun–Jue. Hoy se factura en congestión y cara de “yo puedo”.' },
      { headline: 'Viernes sin piedad (contigo) 😈', line: 'Sé amable con el mundo. Con tus excusas, cero empatía. Al rack.' },
      { headline: 'Afterwork: hierro 🛠️🍻', line: 'El after de verdad empieza en el gym. Luego ya, si quieres, el refresquito merecido.' },
      { headline: 'Modo “hoy sí o sí” ✅', line: 'Ni “media sesión”. Sesión. Completa. Con final credit y todo.' },
      { headline: 'Viernes de ego controlado 🪞', line: 'Sube el peso con cabeza. Baja el drama. Sube el volumen. Baja la queja.' },
      { headline: 'El finde te está ojiando 👀🎉', line: 'Que te vea llegar cansado de entrenar, no cansado de no haber entrenado.' },
      { headline: 'Último boss laboral 👾🏋️', line: 'Cierra el ciclo semanal con una sesión que merezca meme… de los buenos.' },
      { headline: 'Viernes salvageaje 🌪️', line: 'Intensidad de documental de depredadores. Tú eres el depredador. La barra, la cena.' },
      { headline: 'Glow de finde activado ✨', line: 'Nada pega mejor en una terraza que haber hecho press antes. Ciencia no confirmada, vibe sí.' },
      { headline: 'No seas el del “el lunes” 📅😂', line: 'El lunes ya tuvo su oportunidad. Hoy es viernes. Hoy se entrena, punto y cierre.' },
      { headline: 'Viernes con pecho hinchado 🫁', line: 'Literal o figurado: sal del gym más ancho de actitud. El resto es cosmética.' },
      { headline: 'Ritual pre-finde 🕯️🏋️', line: 'Enciende el fuego, completa series, apaga dudas. Amén del hierro.' },
      { headline: 'Boss Friday unlocked 🔓👑', line: 'Solo los constantes llegan aquí con moral alta. Tú estás en el club. Demuéstralo.' },
    ],
  },
  6: {
    label: 'Sábado',
    messages: [
      { headline: 'Sábado salvaje 🐺', line: 'Día libre de excusas laborales. Si hoy no vas, el sofá te hace socio fundador.' },
      { headline: 'Sabadoodle de hierro 🎨🏋️', line: 'Pinta el día con sudor. El brunch sabe mejor cuando ya has movido el mundo… o al menos el banco.' },
      { headline: 'Weekend warrior mode 🛡️⚔️', line: 'Casco imaginario puesto. A conquistar el rack antes de conquistar el sofá.' },
      { headline: 'Sábado de leyenda urbana 🏙️', line: 'Que digan: “ese/a entrena hasta el sábado”. Suena mejor que “ese/a solo pide comida”.' },
      { headline: 'Sin jefe, con disciplina 👔❌', line: 'Nadie te manda… excepto tu yo del futuro, que quiere verse bien en la foto del domingo.' },
      { headline: 'Sábado pump & chill 🧊🔥', line: 'Primero pump. Luego chill. Ese orden no se negocia (el chill sin pump es fraude).' },
      { headline: 'Día de PR o de carácter 📈', line: 'Si no hay récord, que haya presencia. El carácter también pesa en el total.' },
      { headline: 'Sábado cinematográfico 🎥💪', line: 'Entra al gym como trailer de película. Sal como créditos finales con música épica.' },
      { headline: 'El sofá tiembla 🛋️😱', line: 'Porque sabe que hoy puede perderte… otra vez. Hazle el favor de desaparecer una hora.' },
      { headline: 'Brunch motivado 🥑🏋️', line: 'Entrena primero. Aguacate después. Así el aguacate respeta tu autoridad.' },
      { headline: 'Sábado free pass… al esfuerzo 🎟️', line: 'Gratis: entrenar sin mirar el reloj del jefe. De pago: el respeto que te ganas.' },
      { headline: 'Beast weekend unlocked 🔓🐯', line: 'Viernes fue el aviso. Sábado es la confirmación. Domina tu sesión y domina el día.' },
      { headline: 'No hay “lunes” que valga 📆', line: 'Hoy es sábado. El lunes es otra dimensión. Entrena en esta realidad, crack.' },
      { headline: 'Sábado con humor de hierro 😂🦾', line: 'Si te ríes entre series, perfecto. Si te rindes entre series… menos gracioso. Elige el gag bueno.' },
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
