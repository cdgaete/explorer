import { useEffect, useRef, useCallback } from 'react'
import { useNetworkStore } from '@/stores/networkStore'

const WS_URL = 'ws://127.0.0.1:8000/ws'
const RECONNECT_DELAY = 2000

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const { updateOptimization, updateNetworkOptStatus, setWsConnected } = useNetworkStore()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log('WebSocket connected')
      setWsConnected(true)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...')
      setWsConnected(false)
      reconnectTimeoutRef.current = window.setTimeout(connect, RECONNECT_DELAY)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        console.log('WS message:', msg)

        if (msg.type === 'optimization_status') {
          updateOptimization({
            status: msg.status,
            progress: msg.progress || 0,
            message: msg.message || '',
            error: msg.error,
          })

          if (msg.network_id) {
            if (msg.status === 'completed') {
              updateNetworkOptStatus(msg.network_id, 'completed')
            } else if (msg.status === 'running' || msg.status === 'starting') {
              updateNetworkOptStatus(msg.network_id, 'running')
            } else if (msg.status === 'failed') {
              updateNetworkOptStatus(msg.network_id, 'failed')
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    wsRef.current = ws
  }, [updateOptimization, updateNetworkOptStatus, setWsConnected])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return { connect, disconnect }
}
