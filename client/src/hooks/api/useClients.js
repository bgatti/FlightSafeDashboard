import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/apiClient'

const KEY = ['clients']

export function useClients() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiClient.get('/clients').then((r) => r.data),
    staleTime: 10_000,
  })
}

export function useClientByTail(tailNumber) {
  return useQuery({
    queryKey: ['client-tail', tailNumber],
    queryFn: () => apiClient.get(`/clients/tail/${tailNumber}`).then((r) => r.data),
    enabled: !!tailNumber,
  })
}

export function useUpsertClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post('/clients', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...updates }) => apiClient.patch(`/clients/${id}`, updates).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
