import { useNetworkStore } from '@/stores/networkStore'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export function StatusBar() {
  const { selectedNetworkId, networks, wsConnected, optimization } = useNetworkStore()

  const selectedNetwork = networks.find((n) => n.id === selectedNetworkId)
  const showProgress = optimization.status === 'running' || optimization.status === 'starting'

  return (
    <footer className="flex items-center h-6 px-4 bg-card border-t border-border text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            wsConnected ? "bg-green-500" : "bg-red-500"
          )}
        />
        <span>{wsConnected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {showProgress && (
        <div className="flex items-center gap-3 mx-4 flex-1 max-w-md">
          <Progress value={optimization.progress} className="h-1.5" />
          <span className="min-w-[80px]">
            {optimization.message || `${optimization.progress}%`}
          </span>
        </div>
      )}

      <div className="ml-auto">
        {selectedNetwork ? (
          <span>
            {selectedNetwork.name} — {selectedNetwork.buses} buses, {selectedNetwork.generators} generators, {selectedNetwork.lines} lines
          </span>
        ) : (
          <span>No network selected</span>
        )}
      </div>
    </footer>
  )
}
