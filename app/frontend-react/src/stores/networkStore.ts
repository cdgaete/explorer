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
  optStatus: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
}

export interface OptimizationProgress {
  networkId: string | null
  status: 'idle' | 'queued' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  message: string
  error?: string
}

export interface Job {
  id: number
  network_id: string
  solver: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  started_at: string | null
  completed_at: string | null
  error: string | null
}

export interface LogEntry {
  networkId: string
  timestamp: Date
  message: string
  level: 'info' | 'warning' | 'error' | 'success'
}

interface NetworkState {
  networks: Network[]
  selectedNetworkId: string | null
  optimization: OptimizationProgress
  logs: LogEntry[]
  jobs: Job[]
  wsConnected: boolean

  // Actions
  setNetworks: (networks: Network[]) => void
  addNetwork: (network: Network) => void
  selectNetwork: (id: string | null) => void
  updateOptimization: (networkId: string, progress: Omit<OptimizationProgress, 'networkId'>) => void
  updateNetworkOptStatus: (id: string, status: Network['optStatus']) => void
  addLog: (networkId: string, message: string, level?: LogEntry['level']) => void
  clearLogs: (networkId: string) => void
  setJobs: (jobs: Job[]) => void
  setWsConnected: (connected: boolean) => void
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set) => ({
      networks: [],
      selectedNetworkId: null,
      optimization: {
        networkId: null,
        status: 'idle',
        progress: 0,
        message: '',
      },
      logs: [],
      jobs: [],
      wsConnected: false,

      setNetworks: (networks) => set({ networks }),

      addNetwork: (network) =>
        set((state) => ({
          networks: [...state.networks.filter((n) => n.id !== network.id), network],
        })),

      selectNetwork: (id) => set({ selectedNetworkId: id }),

      updateOptimization: (networkId, progress) =>
        set({ optimization: { ...progress, networkId } }),

      updateNetworkOptStatus: (id, status) =>
        set((state) => ({
          networks: state.networks.map((n) =>
            n.id === id ? { ...n, optStatus: status } : n
          ),
        })),

      addLog: (networkId, message, level = 'info') =>
        set((state) => ({
          logs: [...state.logs, { networkId, timestamp: new Date(), message, level }],
        })),

      clearLogs: (networkId) =>
        set((state) => ({
          logs: state.logs.filter((log) => log.networkId !== networkId),
        })),

      setJobs: (jobs) => set({ jobs }),

      setWsConnected: (connected) => set({ wsConnected: connected }),
    }),
    {
      name: 'network-storage',
      partialize: (state) => ({ selectedNetworkId: state.selectedNetworkId }),
    }
  )
)
