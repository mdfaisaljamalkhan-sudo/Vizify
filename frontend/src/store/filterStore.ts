import { create } from 'zustand'

interface FilterStore {
  activeFilters: Record<string, string | number>
  setFilter: (key: string, value: string | number) => void
  clearFilter: (key: string) => void
  clearAllFilters: () => void
}

export const useFilterStore = create<FilterStore>((set) => ({
  activeFilters: {},
  setFilter: (key, value) =>
    set((s) => ({ activeFilters: { ...s.activeFilters, [key]: value } })),
  clearFilter: (key) =>
    set((s) => {
      const f = { ...s.activeFilters }
      delete f[key]
      return { activeFilters: f }
    }),
  clearAllFilters: () => set({ activeFilters: {} }),
}))
