import { Device } from '@capacitor/device'
import { Preferences } from '@capacitor/preferences'
import { IS_APP } from './platform'

/**
 * Sesión de las apps de iOS y Android. La web entra con cookies; dentro de una app nativa las
 * cookies no son fiables, así que el servidor da un token que se guarda en el móvil y se manda
 * en cada petición.
 */
const TOKEN_KEY = 'evofit:token'

let token: string | null = null
let loaded: Promise<void> | null = null

/** Lee el token guardado (una sola vez). Hay que esperarlo antes de la primera petición. */
export function loadAppToken(): Promise<void> {
  if (!IS_APP) return Promise.resolve()
  loaded ??= Preferences.get({ key: TOKEN_KEY })
    .then(({ value }) => {
      token = value
    })
    .catch(() => {
      token = null
    })
  return loaded
}

export function appToken(): string | null {
  return token
}

export async function setAppToken(next: string | null): Promise<void> {
  if (!IS_APP) return
  token = next
  try {
    if (next) await Preferences.set({ key: TOKEN_KEY, value: next })
    else await Preferences.remove({ key: TOKEN_KEY })
  } catch {
    // Si no se puede guardar, la sesión dura hasta cerrar la app.
  }
}

/** Nombre del móvil para identificar la sesión en el servidor. Vacío en la web. */
export async function appDeviceName(): Promise<string | undefined> {
  if (!IS_APP) return undefined
  try {
    const info = await Device.getInfo()
    return [info.manufacturer, info.model].filter(Boolean).join(' ') || info.platform
  } catch {
    return 'app'
  }
}
