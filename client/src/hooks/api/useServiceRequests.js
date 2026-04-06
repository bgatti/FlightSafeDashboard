import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/apiClient'

const KEY = ['service-requests']

export function useServiceRequests(filters) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => apiClient.get('/service-requests', { params: filters }).then((r) => r.data),
    staleTime: 10_000,
  })
}

export function useAddServiceRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req) => apiClient.post('/service-requests', req).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateServiceRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...updates }) => apiClient.patch(`/service-requests/${id}`, updates).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
