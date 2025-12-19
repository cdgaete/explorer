import { useEffect, useRef, useCallback } from 'react'
import { useNetworkStore } from '@/stores/networkStore'

const WS_URL = 'ws://127.0.0.1:8000/ws'
const RECONNECT_DELAY = 3000

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const wasConnectedRef = useRef(false)
  const { updateOptimization, updateNetworkOptStatus, setWsConnected, addLog, clearLogs } = useNetworkStore()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      if (!wasConnectedRef.current) {
        console.log('WebSocket connected')
      }
      wasConnectedRef.current = true
      setWsConnected(true)
    }

    ws.onclose = () => {
      setWsConnected(false)
      reconnectTimeoutRef.current = window.setTimeout(connect, RECONNECT_DELAY)
    }

    ws.onerror = () => {
      // Silently handle - onclose will trigger reconnect
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

          // Add log entries for optimization events
          if (msg.status === 'starting') {
            clearLogs()
            addLog(`Starting optimization for network ${msg.network_id}...`, 'info')
          } else if (msg.message) {
            addLog(msg.message, 'info')
          }

          if (msg.status === 'completed') {
            addLog(`Optimization completed successfully`, 'success')
            if (msg.objective !== undefined) {
              addLog(`Objective value: ${msg.objective.toLocaleString()}`, 'info')
            }
            if (msg.termination) {
              addLog(`Termination: ${msg.termination}`, 'info')
            }
          } else if (msg.status === 'failed') {
            addLog(`Optimization failed: ${msg.error || 'Unknown error'}`, 'error')
          } else if (msg.status === 'cancelled') {
            addLog(`Optimization cancelled by user`, 'warning')
          }

          if (msg.network_id) {
            if (msg.status === 'completed') {
              updateNetworkOptStatus(msg.network_id, 'completed')
            } else if (msg.status === 'running' || msg.status === 'starting') {
              updateNetworkOptStatus(msg.network_id, 'running')
            } else if (msg.status === 'failed') {
              updateNetworkOptStatus(msg.network_id, 'failed')
            } else if (msg.status === 'cancelled') {
              updateNetworkOptStatus(msg.network_id, 'cancelled')
            }
          }
        } else if (msg.type === 'optimization_log') {
          // Solver stdout logs
          addLog(msg.log, 'info')
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    wsRef.current = ws
  }, [updateOptimization, updateNetworkOptStatus, setWsConnected, addLog, clearLogs])

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
