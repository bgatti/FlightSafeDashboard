import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import { mockPilotReports } from '../mocks/pilotReports'

export function usePilotReports() {
  return useQuery({
    queryKey: ['pilot-reports'],
    queryFn: () => apiClient.get('/reports').then((r) => r.data),
    initialData: mockPilotReports,
  })
}
