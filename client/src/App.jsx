import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { queryClient } from './lib/queryClient'
import { Layout } from './components/layout/Layout'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="dark min-h-screen bg-surface text-slate-100">
          <Layout />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
