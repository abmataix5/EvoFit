import type { CapacitorConfig } from '@capacitor/cli'

/** Apps de iOS y Android: la misma web de `dist`, empaquetada como app nativa. */
const config: CapacitorConfig = {
  appId: 'fitness.evofit.app',
  appName: 'EvoFit',
  webDir: 'dist',
  // Mismo fondo que la app, para que no se vea un destello blanco al abrir.
  backgroundColor: '#0c1219',
}

export default config
