import { Capacitor } from '@capacitor/core'

/** true dentro de las apps de iOS y Android; false en el navegador (web y PWA). */
export const IS_APP = Capacitor.isNativePlatform()

/**
 * Dónde está el servidor. La web lo tiene en su mismo dominio; las apps cargan desde el propio
 * móvil, así que necesitan la dirección completa.
 */
export const SERVER_ORIGIN = IS_APP ? ((import.meta.env.VITE_APP_SERVER_ORIGIN as string | undefined) ?? 'https://evofit.fitness') : ''
