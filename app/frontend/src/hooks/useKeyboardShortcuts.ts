import { useEffect } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'

export function useKeyboardShortcuts() {
  const { toggleSidebar, toggleBottomPanel, toggleRightPanel } = useLayoutStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Ctrl/Cmd + B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }

      // Ctrl/Cmd + J: Toggle bottom panel
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault()
        toggleBottomPanel()
      }

      // Ctrl/Cmd + /: Toggle right panel (AI chat)
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        toggleRightPanel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar, toggleBottomPanel, toggleRightPanel])
}
