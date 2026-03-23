import { create } from 'zustand'

export const useFlightStore = create((set) => ({
  flights: [],
  activeFlight: null,
  setFlights: (flights) => set({ flights }),
  addFlight: (flight) => set((s) => ({ flights: [...s.flights, flight] })),
  setActiveFlight: (flight) => set({ activeFlight: flight }),
  updateFlightRisk: (id, risk) =>
    set((s) => ({
      flights: s.flights.map((f) => (f.id === id ? { ...f, ...risk } : f)),
    })),
}))
