import { create } from 'zustand'

export const useUiStore = create((set) => ({
  selectedFlightId: null,
  mapCenter: [39.5, -98.35],
  mapZoom: 4,
  activeMapLayers: ['flights', 'sigmets', 'airmets'],
  lookaheadHours: 4,
  sidebarOpen: true,
  setSelectedFlight: (id) => set({ selectedFlightId: id }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setLookaheadHours: (h) => set({ lookaheadHours: h }),
  toggleMapLayer: (layer) =>
    set((s) => ({
      activeMapLayers: s.activeMapLayers.includes(layer)
        ? s.activeMapLayers.filter((l) => l !== layer)
        : [...s.activeMapLayers, layer],
    })),
}))
