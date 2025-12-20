import { useEffect, useRef, useCallback } from 'react'
import { useChatStore } from '@/stores/chatStore'

const WS_CHAT_URL = 'ws://127.0.0.1:8000/ws/chat'
const RECONNECT_DELAY = 5000

// Custom event for network refresh
export const REFRESH_NETWORKS_EVENT = 'refresh-networks'

export function useChatWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const { addMessage, setTyping, setConnected, setError, clearMessages } = useChatStore()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(WS_CHAT_URL)

      ws.onopen = () => {
        console.log('Chat WebSocket connected')
        setConnected(true)
        setError(null)
      }

      ws.onclose = () => {
        console.log('Chat WebSocket disconnected')
        setConnected(false)
        reconnectTimeoutRef.current = window.setTimeout(connect, RECONNECT_DELAY)
      }

      ws.onerror = () => {
        setError('Failed to connect to AI assistant')
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          console.log('Chat message:', msg)

          if (msg.type === 'assistant') {
            addMessage({
              role: 'assistant',
              content: msg.content,
              needsApproval: msg.needs_approval,
              pendingTool: msg.pending_tool,
            })
          } else if (msg.type === 'tool_executed') {
            addMessage({
              role: 'tool',
              content: `Executed: ${msg.tool_name}`,
              toolName: msg.tool_name,
            })
          } else if (msg.type === 'refresh_networks') {
            // Dispatch custom event to trigger network refresh
            console.log('Dispatching refresh_networks event')
            window.dispatchEvent(new CustomEvent(REFRESH_NETWORKS_EVENT))
          } else if (msg.type === 'typing') {
            setTyping(msg.typing)
          } else if (msg.type === 'error') {
            addMessage({
              role: 'assistant',
              content: `Error: ${msg.content}`,
            })
          } else if (msg.type === 'cleared') {
            clearMessages()
            addMessage({
              role: 'system',
              content: msg.content,
            })
          }
        } catch (e) {
          console.error('Failed to parse chat message:', e)
        }
      }

      wsRef.current = ws
    } catch (e) {
      setError('Failed to connect to AI assistant')
    }
  }, [addMessage, setTyping, setConnected, setError, clearMessages])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
  }, [setConnected])

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      addMessage({ role: 'user', content })
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content,
      }))
    } else {
      setError('Not connected to AI assistant')
    }
  }, [addMessage, setError])

  const clearChat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }))
    }
    clearMessages()
  }, [clearMessages])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return { sendMessage, clearChat, connect, disconnect }
}
