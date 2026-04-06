import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/apiClient'

const KEY = ['glider-settings']

export function useGliderSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiClient.get('/settings/glider').then((r) => r.data),
    staleTime: 5 * 60_000,
  })
}

export function useUpdateGliderSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (partial) => apiClient.patch('/settings/glider', partial).then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  })
}

export function useResetGliderSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.delete('/settings/glider').then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  })
}
