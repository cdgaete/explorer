import { useState, useEffect, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useNetworkStore } from '@/stores/networkStore'
import { api } from '@/api/client'
import { ScrollText, Gauge, Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomPanel() {
  const [activeTab, setActiveTab] = useState('optimization')
  const { optimization, selectedNetworkId, networks, logs } = useNetworkStore()
  const logsEndRef = useRef<HTMLDivElement>(null)

  const isOptimizing = optimization.status === 'running' || optimization.status === 'starting'
  const selectedNetwork = networks.find((n) => n.id === selectedNetworkId)

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleRunOptimization = async () => {
    if (!selectedNetworkId) return
    try {
      await api.post(`/networks/${selectedNetworkId}/optimize`)
    } catch (e) {
      console.error('Optimization failed:', e)
    }
  }

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
            <div className="flex gap-6">
              {/* Left: Run button */}
              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="h-16 w-32"
                  onClick={handleRunOptimization}
                  disabled={isOptimizing}
                >
                  {isOptimizing ? (
                    <>
                      <Square className="h-5 w-5 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2" />
                      Run
                    </>
                  )}
                </Button>
                <div className="text-xs text-muted-foreground text-center">
                  Solver: HiGHS
                </div>
              </div>

              {/* Right: Status and progress */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Network:</span>
                  <span className="text-sm font-medium">{selectedNetwork?.name}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <span className={`text-sm font-medium ${
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

                {isOptimizing && (
                  <div className="space-y-1.5">
                    <Progress value={optimization.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {optimization.message || `Progress: ${optimization.progress}%`}
                    </p>
                  </div>
                )}

                {optimization.status === 'failed' && optimization.error && (
                  <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
                    {optimization.error}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="flex-1 overflow-auto">
          <div className="p-2 font-mono text-xs space-y-0.5">
            {logs.length === 0 ? (
              <p className="text-muted-foreground p-2">
                Run optimization to see logs...
              </p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={cn(
                    "px-2 py-0.5 rounded",
                    log.level === 'error' && "text-destructive bg-destructive/10",
                    log.level === 'success' && "text-green-500 bg-green-500/10",
                    log.level === 'warning' && "text-yellow-500 bg-yellow-500/10",
                    log.level === 'info' && "text-muted-foreground"
                  )}
                >
                  <span className="text-muted-foreground/50 mr-2">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  {log.message}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
