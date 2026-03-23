import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import { mockSigmets, mockAirmets } from '../mocks/liveOperations'

export function useSigmets() {
  return useQuery({
    queryKey: ['sigmets'],
    queryFn: () => apiClient.get('/sigmets').then((r) => r.data),
    initialData: mockSigmets,
    refetchInterval: 5 * 60_000,
  })
}

export function useAirmets() {
  return useQuery({
    queryKey: ['airmets'],
    queryFn: () => apiClient.get('/airmets').then((r) => r.data),
    initialData: mockAirmets,
    refetchInterval: 5 * 60_000,
  })
}
