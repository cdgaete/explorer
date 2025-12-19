import { Zap, PanelLeftClose, PanelLeft, PanelBottomClose, PanelBottom, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLayoutStore } from '@/stores/layoutStore'

export function Header() {
  const {
    sidebarCollapsed,
    bottomPanelCollapsed,
    toggleSidebar,
    toggleBottomPanel,
    toggleRightPanel
  } = useLayoutStore()

  return (
    <header className="flex items-center h-12 px-4 bg-card border-b border-border gap-4">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary" />
        <h1 className="text-sm font-semibold">Energy Network Explorer</h1>
      </div>

      <div className="flex items-center gap-1 ml-auto">
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
