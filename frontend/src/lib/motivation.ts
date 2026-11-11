/** Nombre de pila para saludos ("Abel Mataix" → "Abel"); "atleta" si no hay nombre. */
export function firstName(name?: string | null) {
  const part = name?.trim().split(/\s+/)[0]
  return part && part.length > 0 ? part : 'atleta'
}

export function helloLine(name?: string | null) {
  return `Hola, ${firstName(name)}`
}
