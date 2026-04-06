import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/apiClient'

const KEY = ['invoices']

export function useInvoices() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiClient.get('/invoices').then((r) => r.data),
    staleTime: 10_000,
  })
}

export function useFindOrCreateInvoice(date, clientId) {
  return useQuery({
    queryKey: ['invoice-find', date, clientId],
    queryFn: () => apiClient.get('/invoices/find', { params: { date, clientId } }).then((r) => r.data),
    enabled: !!date && !!clientId,
  })
}

export function useUpsertInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invoice) => {
      if (invoice._new) {
        const { _new, ...data } = invoice
        return apiClient.post('/invoices', data).then((r) => r.data)
      }
      return apiClient.patch(`/invoices/${invoice.id}`, invoice).then((r) => r.data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useAddLineItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, item }) => apiClient.post(`/invoices/${invoiceId}/line-items`, item).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useMarkPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invoiceId) => apiClient.patch(`/invoices/${invoiceId}/pay`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
