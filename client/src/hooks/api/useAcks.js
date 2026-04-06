import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/apiClient'

export function useFlightAcks(flightId) {
  return useQuery({
    queryKey: ['acks', flightId],
    queryFn: () => apiClient.get(`/acks/flight/${flightId}`).then((r) => r.data),
    enabled: !!flightId,
    staleTime: 5_000,
  })
}

export function useSetAck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ flightId, riskItemId, role, pilotId, pilotName }) =>
      apiClient.post('/acks', { flightId, riskItemId, role, pilotId, pilotName }).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['acks', vars.flightId] }),
  })
}

export function useRemoveAck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ flightId, riskItemId, role }) =>
      apiClient.delete(`/acks/${flightId}/${riskItemId}/${role}`).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['acks', vars.flightId] }),
  })
}

export function useAckCount(flightId, totalItems) {
  return useQuery({
    queryKey: ['acks-count', flightId, totalItems],
    queryFn: () => apiClient.get(`/acks/flight/${flightId}/count`, { params: { totalItems } }).then((r) => r.data),
    enabled: !!flightId,
    staleTime: 5_000,
  })
}
