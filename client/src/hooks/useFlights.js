import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import { mockFlights } from '../mocks/flights'

export function useFlights() {
  return useQuery({
    queryKey: ['flights'],
    queryFn: () => apiClient.get('/flights').then((r) => r.data),
    initialData: mockFlights,
    staleTime: 30_000,
  })
}
