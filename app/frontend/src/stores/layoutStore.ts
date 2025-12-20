import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
  sidebarCollapsed: boolean
  bottomPanelCollapsed: boolean
  rightPanelCollapsed: boolean
  activeTab: string

  // Actions
  toggleSidebar: () => void
  toggleBottomPanel: () => void
  toggleRightPanel: () => void
  setActiveTab: (tab: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setBottomPanelCollapsed: (collapsed: boolean) => void
  setRightPanelCollapsed: (collapsed: boolean) => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      bottomPanelCollapsed: true,
      rightPanelCollapsed: true,
      activeTab: 'map',

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      toggleBottomPanel: () =>
        set((state) => ({ bottomPanelCollapsed: !state.bottomPanelCollapsed })),

      toggleRightPanel: () =>
        set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      setBottomPanelCollapsed: (collapsed) => set({ bottomPanelCollapsed: collapsed }),

      setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),
    }),
    {
      name: 'layout-storage',
    }
  )
)
