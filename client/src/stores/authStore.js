import { create } from 'zustand'

export const useAuthStore = create(() => ({
  user: { name: 'Alex Torres', role: 'dispatcher' },
}))
