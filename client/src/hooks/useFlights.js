import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'

const KEY = ['flights']

export function useFlights(filters) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => apiClient.get('/flights', { params: filters }).then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useFlightById(id) {
  return useQuery({
    queryKey: ['flight', id],
    queryFn: () => apiClient.get(`/flights/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useAddFlight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (flight) => apiClient.post('/flights', flight).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateFlight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...updates }) => apiClient.patch(`/flights/${id}`, updates).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteFlight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`/flights/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
