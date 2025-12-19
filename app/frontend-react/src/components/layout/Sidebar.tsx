import { useEffect, useState } from 'react'
import { Network as NetworkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNetworkStore, type Network } from '@/stores/networkStore'
import { api, type NetworkListResponse } from '@/api/client'

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
              network.optStatus === 'failed' && "text-destructive",
              network.optStatus === 'idle' && "text-muted-foreground"
            )}
          >
            {network.optStatus === 'completed'
              ? '✓ solved'
              : network.optStatus === 'running'
              ? '⏳ solving...'
              : network.optStatus === 'failed'
              ? '✗ failed'
              : 'unsolved'}
          </p>
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { networks, selectedNetworkId, setNetworks, selectNetwork, addNetwork } = useNetworkStore()

  useEffect(() => {
    // Fetch network list on mount
    const fetchNetworks = async () => {
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
      } catch (e) {
        console.error('Failed to fetch networks:', e)
      }
    }

    fetchNetworks()
    // Refresh every 5 seconds
    const interval = setInterval(fetchNetworks, 5000)
    return () => clearInterval(interval)
  }, [setNetworks, addNetwork])

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Networks
        </h2>
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
