/** Kilos levantados en total: en toneladas a partir de 10.000 kg. */
export function formatVolume(kg: number) {
  return kg >= 10000 ? `${(kg / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} t` : `${kg.toLocaleString('es-ES')} kg`
}
