import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/apiClient'

const KEY = ['squawks']

export function useSquawks(filters) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => apiClient.get('/squawks', { params: filters }).then((r) => r.data),
    staleTime: 10_000,
  })
}

export function useAddSquawk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sqk) => apiClient.post('/squawks', sqk).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useResolveSquawk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, resolvedBy, resolutionNotes }) =>
      apiClient.patch(`/squawks/${id}/resolve`, { resolvedBy, resolutionNotes }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useAircraftGrounded(tailNumber) {
  return useQuery({
    queryKey: ['grounded', tailNumber],
    queryFn: () => apiClient.get(`/squawks/grounded/${tailNumber}`).then((r) => r.data),
    enabled: !!tailNumber,
    staleTime: 10_000,
  })
}
