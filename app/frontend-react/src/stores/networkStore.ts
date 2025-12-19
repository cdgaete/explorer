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

export interface LogEntry {
  timestamp: Date
  message: string
  level: 'info' | 'warning' | 'error' | 'success'
}

interface NetworkState {
  networks: Network[]
  selectedNetworkId: string | null
  optimization: OptimizationProgress
  logs: LogEntry[]
  wsConnected: boolean

  // Actions
  setNetworks: (networks: Network[]) => void
  addNetwork: (network: Network) => void
  selectNetwork: (id: string | null) => void
  updateOptimization: (progress: OptimizationProgress) => void
  updateNetworkOptStatus: (id: string, status: Network['optStatus']) => void
  addLog: (message: string, level?: LogEntry['level']) => void
  clearLogs: () => void
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
      logs: [],
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

      addLog: (message, level = 'info') =>
        set((state) => ({
          logs: [...state.logs, { timestamp: new Date(), message, level }],
        })),

      clearLogs: () => set({ logs: [] }),

      setWsConnected: (connected) => set({ wsConnected: connected }),
    }),
    {
      name: 'network-storage',
      partialize: (state) => ({ selectedNetworkId: state.selectedNetworkId }),
    }
  )
)
