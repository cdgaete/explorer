import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Network {
  id: string
  name: string
  buses: number
  generators: number
  lines: number
  loads: number
  links: number
  optStatus: 'idle' | 'running' | 'completed' | 'failed'
}

export interface OptimizationProgress {
  status: 'idle' | 'starting' | 'running' | 'completed' | 'failed'
  progress: number
  message: string
  error?: string
}

interface NetworkState {
  networks: Network[]
  selectedNetworkId: string | null
  optimization: OptimizationProgress
  wsConnected: boolean

  // Actions
  setNetworks: (networks: Network[]) => void
  addNetwork: (network: Network) => void
  selectNetwork: (id: string | null) => void
  updateOptimization: (progress: OptimizationProgress) => void
  updateNetworkOptStatus: (id: string, status: Network['optStatus']) => void
  setWsConnected: (connected: boolean) => void
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set) => ({
      networks: [],
      selectedNetworkId: null,
      optimization: {
        status: 'idle',
        progress: 0,
        message: '',
      },
      wsConnected: false,

      setNetworks: (networks) => set({ networks }),

      addNetwork: (network) =>
        set((state) => ({
          networks: [...state.networks.filter((n) => n.id !== network.id), network],
        })),

      selectNetwork: (id) => set({ selectedNetworkId: id }),

      updateOptimization: (progress) => set({ optimization: progress }),

      updateNetworkOptStatus: (id, status) =>
        set((state) => ({
          networks: state.networks.map((n) =>
            n.id === id ? { ...n, optStatus: status } : n
          ),
        })),

      setWsConnected: (connected) => set({ wsConnected: connected }),
    }),
    {
      name: 'network-storage',
      partialize: (state) => ({ selectedNetworkId: state.selectedNetworkId }),
    }
  )
)
