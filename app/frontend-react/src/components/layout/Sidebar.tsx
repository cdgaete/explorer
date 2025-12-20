import { useEffect, useState, useRef, useCallback } from 'react'
import { Network as NetworkIcon, FolderOpen, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useNetworkStore, type Network } from '@/stores/networkStore'
import { api, type NetworkListResponse } from '@/api/client'
import { REFRESH_NETWORKS_EVENT } from '@/hooks/useChatWebSocket'

interface NetworkCardProps {
  network: Network
  isSelected: boolean
  onClick: () => void
}

function NetworkCard({ network, isSelected, onClick }: NetworkCardProps) {
  const [svgPreview, setSvgPreview] = useState<string | null>(null)

  useEffect(() => {
    // Load topology preview
    fetch(`http://127.0.0.1:8000/networks/${network.id}/topology.svg`)
      .then((res) => (res.ok ? res.text() : null))
      .then(setSvgPreview)
      .catch(() => null)
  }, [network.id])

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg cursor-pointer transition-all",
        "bg-secondary/50 hover:bg-secondary",
        isSelected && "border-l-2 border-primary bg-secondary"
      )}
    >
      <div className="flex gap-3">
        <div className="w-16 h-12 bg-background rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
          {svgPreview ? (
            <div
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: svgPreview }}
            />
          ) : (
            <NetworkIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate">{network.name}</h3>
          <p className="text-xs text-muted-foreground">
            {network.buses} buses · {network.generators} gen · {network.lines} lines
          </p>
          <p
            className={cn(
              "text-xs mt-1",
              network.optStatus === 'completed' && "text-green-500",
              network.optStatus === 'running' && "text-primary",
              network.optStatus === 'queued' && "text-blue-500",
              network.optStatus === 'failed' && "text-destructive",
              network.optStatus === 'cancelled' && "text-yellow-500",
              network.optStatus === 'idle' && "text-muted-foreground"
            )}
          >
            {network.optStatus === 'completed'
              ? '✓ solved'
              : network.optStatus === 'running'
              ? '⏳ solving...'
              : network.optStatus === 'queued'
              ? '⏱ queued'
              : network.optStatus === 'failed'
              ? '✗ failed'
              : network.optStatus === 'cancelled'
              ? '⊘ cancelled'
              : 'unsolved'}
          </p>
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { networks, selectedNetworkId, setNetworks, selectNetwork, addNetwork, wsConnected } = useNetworkStore()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchNetworks = useCallback(async () => {
    try {
      const data = await api.get<NetworkListResponse>('/networks')

      // Get optimization status for each network
      const networksWithStatus = await Promise.all(
        data.networks.map(async (n) => {
          try {
            const status = await api.get<{ status: string }>(`/networks/${n.id}/optimization-status`)
            return {
              ...n,
              loads: n.loads ?? 0,
              links: n.links ?? 0,
              optStatus: (status.status as Network['optStatus']) || 'idle',
            }
          } catch {
            return { ...n, loads: n.loads ?? 0, links: n.links ?? 0, optStatus: 'idle' as const }
          }
        })
      )

      setNetworks(networksWithStatus)
      
      // Auto-select first network if none selected
      if (networksWithStatus.length > 0 && !selectedNetworkId) {
        selectNetwork(networksWithStatus[0].id)
      }
    } catch (e) {
      console.error('Failed to fetch networks:', e)
    }
  }, [setNetworks, selectNetwork, selectedNetworkId])

  // Listen for refresh events from chat
  useEffect(() => {
    const handleRefresh = () => {
      console.log('Received refresh_networks event, fetching...')
      fetchNetworks()
    }
    
    window.addEventListener(REFRESH_NETWORKS_EVENT, handleRefresh)
    return () => window.removeEventListener(REFRESH_NETWORKS_EVENT, handleRefresh)
  }, [fetchNetworks])

  useEffect(() => {
    // Only fetch when backend is connected
    if (!wsConnected) return

    fetchNetworks()
    // Refresh every 5 seconds while connected
    const interval = setInterval(fetchNetworks, 5000)
    return () => clearInterval(interval)
  }, [wsConnected, fetchNetworks])

  const handleLoadExample = async () => {
    try {
      const result = await api.post<{ id: string; name: string }>('/networks/example')
      addNetwork({
        id: result.id,
        name: result.name,
        buses: 0,
        generators: 0,
        lines: 0,
        loads: 0,
        links: 0,
        optStatus: 'idle',
      })
      selectNetwork(result.id)
    } catch (e) {
      console.error('Failed to load example:', e)
    }
  }

  const handleOpenFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const result = await api.uploadFile(file)
      addNetwork({
        id: result.id,
        name: result.name,
        buses: result.buses,
        generators: result.generators,
        lines: result.lines,
        loads: result.loads ?? 0,
        links: result.links ?? 0,
        optStatus: 'idle',
      })
      selectNetwork(result.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file'
      setUploadError(message)
      console.error('Upload failed:', err)
    } finally {
      setIsUploading(false)
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <input
        ref={fileInputRef}
        type="file"
        accept=".nc,.h5,.hdf5"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="px-3 py-3 border-b border-border space-y-3">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Networks
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={handleLoadExample}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Example
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleOpenFile}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isUploading ? 'Loading...' : 'Open'}
          </Button>
        </div>
        {uploadError && (
          <p className="text-xs text-destructive">{uploadError}</p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {networks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No networks loaded
          </div>
        ) : (
          networks.map((network) => (
            <NetworkCard
              key={network.id}
              network={network}
              isSelected={network.id === selectedNetworkId}
              onClick={() => selectNetwork(network.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
