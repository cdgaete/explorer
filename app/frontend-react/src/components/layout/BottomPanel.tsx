import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { useNetworkStore } from '@/stores/networkStore'
import { ScrollText, Gauge } from 'lucide-react'

export function BottomPanel() {
  const [activeTab, setActiveTab] = useState('optimization')
  const { optimization, selectedNetworkId } = useNetworkStore()

  const showProgress = optimization.status === 'running' || optimization.status === 'starting'

  return (
    <div className="flex flex-col h-full bg-card border-t border-border">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="px-2 h-9 justify-start gap-1 bg-transparent border-b border-border rounded-none">
          <TabsTrigger value="optimization" className="text-xs h-7 px-3 gap-1.5">
            <Gauge className="h-3.5 w-3.5" />
            Optimization
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs h-7 px-3 gap-1.5">
            <ScrollText className="h-3.5 w-3.5" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="optimization" className="flex-1 p-4 overflow-auto">
          {!selectedNetworkId ? (
            <div className="text-muted-foreground text-sm">
              Select a network to run optimization
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Status:</span>
                <span className={`text-sm ${
                  optimization.status === 'completed' ? 'text-green-500' :
                  optimization.status === 'failed' ? 'text-destructive' :
                  optimization.status === 'running' ? 'text-primary' :
                  'text-muted-foreground'
                }`}>
                  {optimization.status === 'idle' ? 'Ready' :
                   optimization.status === 'starting' ? 'Starting...' :
                   optimization.status === 'running' ? 'Running...' :
                   optimization.status === 'completed' ? 'Completed' :
                   'Failed'}
                </span>
              </div>

              {showProgress && (
                <div className="space-y-2">
                  <Progress value={optimization.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {optimization.message || `Progress: ${optimization.progress}%`}
                  </p>
                </div>
              )}

              {optimization.status === 'failed' && optimization.error && (
                <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
                  {optimization.error}
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Solver: HiGHS (default)</p>
                <p>Network: {selectedNetworkId}</p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="flex-1 overflow-auto">
          <div className="p-4 font-mono text-xs text-muted-foreground">
            <p>Logs will appear here...</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
