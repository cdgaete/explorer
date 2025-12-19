import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useLayoutStore } from '@/stores/layoutStore'
import { Sidebar } from './Sidebar'
import { BottomPanel } from './BottomPanel'
import { RightPanel } from './RightPanel'
import { MainContent } from './MainContent'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'

interface ResizeHandleProps {
  className?: string
  direction?: 'horizontal' | 'vertical'
  onToggle?: () => void
  isCollapsed?: boolean
  showToggle?: boolean
  togglePosition?: 'start' | 'center' | 'end'
}

function ResizeHandle({
  className,
  direction = 'horizontal',
  onToggle,
  isCollapsed = false,
  showToggle = false,
  togglePosition = 'center'
}: ResizeHandleProps) {
  const isHorizontal = direction === 'horizontal'

  return (
    <PanelResizeHandle
      className={cn(
        "relative transition-colors group",
        isHorizontal ? "w-1 hover:bg-primary/50" : "h-1 hover:bg-primary/50",
        "before:absolute before:inset-0",
        isHorizontal ? "before:-left-1 before:-right-1" : "before:-top-1 before:-bottom-1",
        "bg-border",
        className
      )}
    >
      {showToggle && onToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className={cn(
            "absolute z-10 flex items-center justify-center",
            "bg-card border border-border rounded-sm",
            "hover:bg-accent hover:border-primary transition-colors",
            "shadow-sm",
            isHorizontal ? [
              "w-4 h-8 -left-1.5",
              togglePosition === 'start' && "top-4",
              togglePosition === 'center' && "top-1/2 -translate-y-1/2",
              togglePosition === 'end' && "bottom-4",
            ] : [
              "h-4 w-8 -top-1.5",
              togglePosition === 'start' && "left-4",
              togglePosition === 'center' && "left-1/2 -translate-x-1/2",
              togglePosition === 'end' && "right-4",
            ]
          )}
        >
          {isHorizontal ? (
            isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />
          ) : (
            isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
          )}
        </button>
      )}
    </PanelResizeHandle>
  )
}

// Collapsed panel placeholder with toggle
function CollapsedPanelToggle({
  direction = 'horizontal',
  onClick,
  position = 'left'
}: {
  direction?: 'horizontal' | 'vertical'
  onClick: () => void
  position?: 'left' | 'right' | 'bottom'
}) {
  const isHorizontal = direction === 'horizontal'

  return (
    <div
      className={cn(
        "bg-border flex items-center justify-center cursor-pointer hover:bg-primary/30 transition-colors",
        isHorizontal ? "w-1" : "h-1"
      )}
    >
      <button
        onClick={onClick}
        className={cn(
          "absolute z-10 flex items-center justify-center",
          "bg-card border border-border rounded-sm",
          "hover:bg-accent hover:border-primary transition-colors",
          "shadow-sm",
          isHorizontal ? "w-4 h-8 top-1/2 -translate-y-1/2" : "h-4 w-8 left-1/2 -translate-x-1/2"
        )}
      >
        {position === 'left' && <ChevronRight className="h-3 w-3" />}
        {position === 'right' && <ChevronLeft className="h-3 w-3" />}
        {position === 'bottom' && <ChevronDown className="h-3 w-3" />}
      </button>
    </div>
  )
}

export function PanelLayout() {
  const {
    sidebarCollapsed,
    bottomPanelCollapsed,
    rightPanelCollapsed,
    toggleSidebar,
    toggleBottomPanel,
    toggleRightPanel
  } = useLayoutStore()

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Collapsed sidebar toggle */}
      {sidebarCollapsed && (
        <CollapsedPanelToggle direction="horizontal" position="left" onClick={toggleSidebar} />
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
              <div className="h-full border-r border-border">
                <Sidebar />
              </div>
            </Panel>
            <ResizeHandle
              showToggle
              onToggle={toggleSidebar}
              togglePosition="start"
            />
          </>
        )}

        {/* Center Content */}
        <Panel id="center" order={2} minSize={30}>
          <PanelGroup direction="vertical" autoSaveId="center-layout">
            <Panel id="main" order={1} minSize={30}>
              <MainContent />
            </Panel>

            {/* Collapsed bottom panel toggle */}
            {bottomPanelCollapsed && (
              <CollapsedPanelToggle direction="vertical" position="bottom" onClick={toggleBottomPanel} />
            )}

            {/* Bottom Panel */}
            {!bottomPanelCollapsed && (
              <>
                <ResizeHandle
                  direction="vertical"
                  showToggle
                  onToggle={toggleBottomPanel}
                  togglePosition="end"
                />
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
            <ResizeHandle
              showToggle
              onToggle={toggleRightPanel}
              isCollapsed={false}
              togglePosition="start"
            />
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

      {/* Collapsed right panel toggle */}
      {rightPanelCollapsed && (
        <CollapsedPanelToggle direction="horizontal" position="right" onClick={toggleRightPanel} />
      )}
    </div>
  )
}
