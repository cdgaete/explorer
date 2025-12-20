import { Header } from '@/components/layout/Header'
import { StatusBar } from '@/components/layout/StatusBar'
import { PanelLayout } from '@/components/layout/PanelLayout'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

function App() {
  // Initialize WebSocket connection
  useWebSocket()

  // Setup keyboard shortcuts
  useKeyboardShortcuts()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <PanelLayout />
      <StatusBar />
    </div>
  )
}

export default App
