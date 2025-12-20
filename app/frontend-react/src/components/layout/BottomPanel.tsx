import { useState, useEffect, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useNetworkStore, type Job } from '@/stores/networkStore'
import { api } from '@/api/client'
import { ScrollText, Gauge, Play, Square, ListOrdered, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomPanel() {
  const [activeTab, setActiveTab] = useState('optimization')
  const { optimization, selectedNetworkId, networks, logs, jobs } = useNetworkStore()
  const logsEndRef = useRef<HTMLDivElement>(null)

  const selectedNetwork = networks.find((n) => n.id === selectedNetworkId)

  // Check if optimization is for the selected network
  const isOptimizingThisNetwork = optimization.networkId === selectedNetworkId &&
    (optimization.status === 'running' || optimization.status === 'starting' || optimization.status === 'queued')

  // Get effective status: use optimization state if it's for this network, otherwise use network's optStatus
  const effectiveStatus = optimization.networkId === selectedNetworkId
    ? optimization.status
    : (selectedNetwork?.optStatus || 'idle')

  // Get active jobs (queued or running)
  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'running')

  // Filter logs for selected network
  const networkLogs = logs.filter((log) => log.networkId === selectedNetworkId)

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [networkLogs])

  const handleRunOptimization = async () => {
    if (!selectedNetworkId) return
    try {
      await api.post(`/networks/${selectedNetworkId}/optimize`)
    } catch (e) {
      console.error('Optimization failed:', e)
    }
  }

  const handleCancelOptimization = async () => {
    if (!selectedNetworkId) return
    try {
      await api.post(`/networks/${selectedNetworkId}/cancel-optimization`)
    } catch (e) {
      console.error('Cancel failed:', e)
    }
  }

  const handleCancelJob = async (jobId: number) => {
    try {
      await api.delete(`/jobs/${jobId}`)
    } catch (e) {
      console.error('Cancel job failed:', e)
    }
  }

  const getNetworkName = (networkId: string) => {
    const network = networks.find((n) => n.id === networkId)
    return network?.name || networkId
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
          <TabsTrigger value="jobs" className="text-xs h-7 px-3 gap-1.5">
            <ListOrdered className="h-3.5 w-3.5" />
            Jobs
            {activeJobs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary text-primary-foreground">
                {activeJobs.length}
              </span>
            )}
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
                  onClick={isOptimizingThisNetwork ? handleCancelOptimization : handleRunOptimization}
                  variant={isOptimizingThisNetwork ? "destructive" : "default"}
                >
                  {isOptimizingThisNetwork ? (
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
                    effectiveStatus === 'completed' ? 'text-green-500' :
                    effectiveStatus === 'failed' ? 'text-destructive' :
                    effectiveStatus === 'cancelled' ? 'text-yellow-500' :
                    effectiveStatus === 'queued' ? 'text-blue-500' :
                    effectiveStatus === 'running' ? 'text-primary' :
                    'text-muted-foreground'
                  }`}>
                    {effectiveStatus === 'idle' ? 'Ready' :
                     effectiveStatus === 'queued' ? 'Queued' :
                     effectiveStatus === 'starting' ? 'Starting...' :
                     effectiveStatus === 'running' ? 'Running...' :
                     effectiveStatus === 'completed' ? 'Completed' :
                     effectiveStatus === 'cancelled' ? 'Cancelled' :
                     'Failed'}
                  </span>
                </div>

                {isOptimizingThisNetwork && (
                  <div className="space-y-1.5">
                    <Progress value={optimization.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {optimization.message || `Progress: ${optimization.progress}%`}
                    </p>
                  </div>
                )}

                {effectiveStatus === 'failed' && optimization.networkId === selectedNetworkId && optimization.error && (
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
            {networkLogs.length === 0 ? (
              <p className="text-muted-foreground p-2">
                Run optimization to see logs...
              </p>
            ) : (
              networkLogs.map((log, i) => (
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

        <TabsContent value="jobs" className="flex-1 overflow-auto">
          <div className="p-4 space-y-3">
            {activeJobs.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No jobs in queue. Click Run on a network to start an optimization.
              </div>
            ) : (
              <div className="space-y-2">
                {activeJobs.map((job, index) => (
                  <div
                    key={job.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      job.status === 'running'
                        ? "bg-primary/5 border-primary/30"
                        : "bg-secondary/50 border-border"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        job.status === 'running'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {job.status === 'running' ? '▶' : index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {getNetworkName(job.network_id)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {job.status === 'running' ? (
                            <span className="text-primary">Running...</span>
                          ) : (
                            <span>Position: #{index + 1} in queue</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleCancelJob(job.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
