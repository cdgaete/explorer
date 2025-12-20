import { useEffect, useRef, useCallback } from 'react'
import { useNetworkStore } from '@/stores/networkStore'

const WS_URL = 'ws://127.0.0.1:8000/ws'
const RECONNECT_DELAY = 3000

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const wasConnectedRef = useRef(false)
  const { updateOptimization, updateNetworkOptStatus, setWsConnected, addLog, clearLogs, setJobs } = useNetworkStore()

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

        // Handle job_queue messages first (no network_id required)
        if (msg.type === 'job_queue') {
          setJobs(msg.jobs || [])
          return
        }

        // All other messages require network_id
        const networkId = msg.network_id
        if (!networkId) return

        if (msg.type === 'optimization_status') {
          updateOptimization(networkId, {
            status: msg.status,
            progress: msg.progress || 0,
            message: msg.message || '',
            error: msg.error,
          })

          // Add log entries for optimization events
          if (msg.status === 'queued') {
            addLog(networkId, `Job queued for optimization...`, 'info')
          } else if (msg.status === 'starting') {
            clearLogs(networkId)
            addLog(networkId, `Starting optimization...`, 'info')
          } else if (msg.message) {
            addLog(networkId, msg.message, 'info')
          }

          if (msg.status === 'completed') {
            addLog(networkId, `Optimization completed successfully`, 'success')
            if (msg.objective !== undefined) {
              addLog(networkId, `Objective value: ${msg.objective.toLocaleString()}`, 'info')
            }
            if (msg.termination) {
              addLog(networkId, `Termination: ${msg.termination}`, 'info')
            }
          } else if (msg.status === 'failed') {
            addLog(networkId, `Optimization failed: ${msg.error || 'Unknown error'}`, 'error')
          } else if (msg.status === 'cancelled') {
            addLog(networkId, `Optimization cancelled by user`, 'warning')
          }

          if (msg.status === 'completed') {
            updateNetworkOptStatus(networkId, 'completed')
          } else if (msg.status === 'running' || msg.status === 'starting') {
            updateNetworkOptStatus(networkId, 'running')
          } else if (msg.status === 'queued') {
            updateNetworkOptStatus(networkId, 'queued')
          } else if (msg.status === 'failed') {
            updateNetworkOptStatus(networkId, 'failed')
          } else if (msg.status === 'cancelled') {
            updateNetworkOptStatus(networkId, 'cancelled')
          }
        } else if (msg.type === 'optimization_log') {
          // Solver stdout logs
          addLog(networkId, msg.log, 'info')
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    wsRef.current = ws
  }, [updateOptimization, updateNetworkOptStatus, setWsConnected, addLog, clearLogs, setJobs])

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
