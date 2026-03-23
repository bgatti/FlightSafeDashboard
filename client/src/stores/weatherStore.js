import { create } from 'zustand'

export const useWeatherStore = create((set) => ({
  sigmets: { type: 'FeatureCollection', features: [] },
  airmets: { type: 'FeatureCollection', features: [] },
  lastWeatherRefresh: null,
  weatherLoading: false,
  setSigmets: (sigmets) => set({ sigmets }),
  setAirmets: (airmets) => set({ airmets }),
  setLastRefresh: (ts) => set({ lastWeatherRefresh: ts }),
  setLoading: (v) => set({ weatherLoading: v }),
}))
