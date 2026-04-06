import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/apiClient'

export function usePricing(category) {
  return useQuery({
    queryKey: ['pricing', category],
    queryFn: () => apiClient.get(category ? `/pricing/${category}` : '/pricing').then((r) => r.data),
    staleTime: 5 * 60_000,
  })
}

export function useUpdatePricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ category, ...values }) =>
      apiClient.patch(`/pricing/${category}`, values).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['pricing', vars.category] }),
  })
}
