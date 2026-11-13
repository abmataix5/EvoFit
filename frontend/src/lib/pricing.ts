import { useQuery } from '@tanstack/react-query'
import { api } from './api'

/** Precios de EvoFit, en un solo sitio para que todas las páginas digan lo mismo. */
export const PRICING = {
  /** Las primeras cuentas no pagan. */
  founderSpots: 100,
  /** Cuota mensual a partir de ahí. */
  monthly: '2,99 €',
} as const

type PricingResponse = { founder_spots: number; founder_spots_left: number }

/** Plazas gratis que quedan. `undefined` mientras carga o si no se puede saber. */
export function useFounderSpotsLeft(): number | undefined {
  const { data } = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => (await api.get<PricingResponse>('/pricing')).data,
    staleTime: 60_000,
    retry: false,
  })
  return data?.founder_spots_left
}
