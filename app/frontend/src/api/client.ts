const API_BASE = 'http://127.0.0.1:8000'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`)
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    })
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async uploadFile(file: File): Promise<NetworkInfo> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrl}/networks/load`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(error.detail || `Upload failed: ${response.status}`)
    }

    return response.json()
  }

  async loadFromPath(filePath: string): Promise<NetworkInfo> {
    return this.post('/networks/load-path', { path: filePath })
  }
}

export const api = new ApiClient()

// Types for API responses
export interface NetworkInfo {
  id: string
  name: string
  buses: number
  generators: number
  lines: number
  loads?: number
  links?: number
}

export interface NetworkListResponse {
  networks: NetworkInfo[]
}

export interface Bus {
  name: string
  x: number
  y: number
  v_nom: number
  carrier: string
}

export interface Generator {
  name: string
  bus: string
  carrier: string
  p_nom: number
  marginal_cost: number
}

export interface Line {
  name: string
  bus0: string
  bus1: string
  s_nom: number
  x: number
  length: number
}

export interface Load {
  name: string
  bus: string
  carrier: string
  p_set: number
}

export interface Link {
  name: string
  bus0: string
  bus1: string
  p_nom: number
  carrier: string
  efficiency: number
}

export interface Metadata {
  name: string
  dimensions: {
    snapshots: number
    investment_periods: number
  }
  components: Record<string, number>
  carriers: Record<string, { color?: string }>
  countries: string[]
}

export interface OptimizationStatus {
  status: 'idle' | 'running' | 'completed' | 'failed'
  progress?: number
  message?: string
  error?: string
}

export interface OptimizationResults {
  objective: number | null
  generators_p_nom_opt?: Array<{
    name: string
    bus: string
    carrier: string
    p_nom: number
    p_nom_opt: number
  }>
  lines_s_nom_opt?: Array<{
    name: string
    bus0: string
    bus1: string
    s_nom: number
    s_nom_opt: number
  }>
}

export interface StatisticsAvailable {
  statistics: string[]
}
