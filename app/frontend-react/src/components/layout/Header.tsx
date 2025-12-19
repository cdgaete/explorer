import { Zap, FolderOpen, Play, PanelLeftClose, PanelLeft, PanelBottomClose, PanelBottom, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLayoutStore } from '@/stores/layoutStore'
import { useNetworkStore } from '@/stores/networkStore'
import { api } from '@/api/client'

export function Header() {
  const {
    sidebarCollapsed,
    bottomPanelCollapsed,
    toggleSidebar,
    toggleBottomPanel,
    toggleRightPanel
  } = useLayoutStore()

  const { selectedNetworkId, optimization, addNetwork, selectNetwork } = useNetworkStore()

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

  const handleOpenFile = async () => {
    // This will be handled by Electron's IPC in the desktop app
    // For now, we'll use a file input as fallback
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.nc,.h5,.hdf5'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // In Electron, we'd use the file path
        // For web, we'd need to upload the file
        console.log('Selected file:', file.name)
      }
    }
    input.click()
  }

  const handleRunOptimization = async () => {
    if (!selectedNetworkId) return
    try {
      await api.post(`/networks/${selectedNetworkId}/optimize`)
    } catch (e) {
      console.error('Optimization failed:', e)
    }
  }

  const isOptimizing = optimization.status === 'running' || optimization.status === 'starting'

  return (
    <header className="flex items-center h-12 px-4 bg-card border-b border-border gap-4">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary" />
        <h1 className="text-sm font-semibold">Energy Network Explorer</h1>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button variant="ghost" size="sm" onClick={handleLoadExample}>
          Load Example
        </Button>
        <Button variant="ghost" size="sm" onClick={handleOpenFile}>
          <FolderOpen className="h-4 w-4 mr-2" />
          Open
        </Button>
        <Button
          size="sm"
          onClick={handleRunOptimization}
          disabled={!selectedNetworkId || isOptimizing}
        >
          <Play className="h-4 w-4 mr-2" />
          {isOptimizing ? 'Optimizing...' : 'Run Optimization'}
        </Button>
      </div>

      <div className="flex items-center gap-1 border-l border-border pl-3 ml-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          title="Toggle sidebar (Ctrl+B)"
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleBottomPanel}
          title="Toggle bottom panel (Ctrl+J)"
        >
          {bottomPanelCollapsed ? (
            <PanelBottom className="h-4 w-4" />
          ) : (
            <PanelBottomClose className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleRightPanel}
          title="Toggle AI chat (Ctrl+/)"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
