import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useLayoutStore } from '@/stores/layoutStore'
import { Sidebar } from './Sidebar'
import { BottomPanel } from './BottomPanel'
import { RightPanel } from './RightPanel'
import { MainContent } from './MainContent'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function ResizeHandle({ className, direction = 'horizontal' }: { className?: string; direction?: 'horizontal' | 'vertical' }) {
  return (
    <PanelResizeHandle
      className={cn(
        "relative transition-colors",
        direction === 'horizontal' ? "w-1 hover:bg-primary/50" : "h-1 hover:bg-primary/50",
        "before:absolute before:inset-0",
        direction === 'horizontal' ? "before:-left-1 before:-right-1" : "before:-top-1 before:-bottom-1",
        className
      )}
    />
  )
}

// Sidebar resize handle with centered toggle notch
function SidebarResizeHandle({ onToggle, isCollapsed }: { onToggle: () => void; isCollapsed: boolean }) {
  return (
    <PanelResizeHandle
      className="relative transition-colors hover:bg-primary/50 before:absolute before:inset-0 before:-left-1 before:-right-1"
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className={cn(
          "absolute z-10 flex items-center justify-center",
          "w-4 h-8 -left-2",
          "top-1/2 -translate-y-1/2",
          "bg-card border border-border rounded",
          "hover:bg-accent hover:border-primary transition-colors",
        )}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </PanelResizeHandle>
  )
}

// Thin collapsed sidebar strip with toggle
function CollapsedSidebarStrip({ onToggle }: { onToggle: () => void }) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={cn(
          "absolute z-10 flex items-center justify-center",
          "w-4 h-8 -left-2",
          "top-1/2 -translate-y-1/2",
          "bg-card border border-border rounded",
          "hover:bg-accent hover:border-primary transition-colors",
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export function PanelLayout() {
  const { sidebarCollapsed, bottomPanelCollapsed, rightPanelCollapsed, toggleSidebar } = useLayoutStore()

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Collapsed sidebar - just thin line with notch */}
      {sidebarCollapsed && (
        <CollapsedSidebarStrip onToggle={toggleSidebar} />
      )}

      <PanelGroup direction="horizontal" autoSaveId="main-layout" className="flex-1">
        {/* Left Sidebar */}
        {!sidebarCollapsed && (
          <>
            <Panel
              id="sidebar"
              order={1}
              defaultSize={20}
              minSize={15}
              maxSize={35}
            >
              <Sidebar />
            </Panel>
            <SidebarResizeHandle onToggle={toggleSidebar} isCollapsed={false} />
          </>
        )}

        {/* Center Content */}
        <Panel id="center" order={2} minSize={30}>
          <PanelGroup direction="vertical" autoSaveId="center-layout">
            <Panel id="main" order={1} minSize={30}>
              <MainContent />
            </Panel>

            {/* Bottom Panel */}
            {!bottomPanelCollapsed && (
              <>
                <ResizeHandle direction="vertical" />
                <Panel
                  id="bottom"
                  order={2}
                  defaultSize={25}
                  minSize={15}
                  maxSize={50}
                >
                  <BottomPanel />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>

        {/* Right Panel (AI Chat) */}
        {!rightPanelCollapsed && (
          <>
            <ResizeHandle />
            <Panel
              id="right"
              order={3}
              defaultSize={25}
              minSize={20}
              maxSize={40}
            >
              <RightPanel />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  )
}
