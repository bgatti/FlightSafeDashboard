import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/apiClient'

export function useTowSchedule(airport = 'KBDU') {
  return useQuery({
    queryKey: ['tow-schedule', airport],
    queryFn: () => apiClient.get('/tow-schedule/compute', { params: { airport } }).then((r) => r.data),
    staleTime: 15_000,
  })
}

export function useTowDeficiency(airport, start, end) {
  return useQuery({
    queryKey: ['tow-deficiency', airport, start, end],
    queryFn: () => apiClient.get('/tow-schedule/deficiency', { params: { airport, start, end } }).then((r) => r.data),
    enabled: !!start && !!end,
    staleTime: 15_000,
  })
}

export function usePromoteStandby() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (airport = 'KBDU') =>
      apiClient.post('/tow-schedule/promote-standby', { airport }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flights'] })
      qc.invalidateQueries({ queryKey: ['tow-schedule'] })
    },
  })
}
