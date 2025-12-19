import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api, type StatisticsAvailable } from '@/api/client'

interface StatisticsViewProps {
  networkId: string
}

export function StatisticsView({ networkId }: StatisticsViewProps) {
  const [availableStats, setAvailableStats] = useState<string[]>([])
  const [selectedStat, setSelectedStat] = useState<string>('')
  const [groupBy, setGroupBy] = useState<string>('carrier')
  const [result, setResult] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadAvailable = async () => {
      try {
        const data = await api.get<StatisticsAvailable>(
          `/networks/${networkId}/statistics/available`
        )
        setAvailableStats(data.statistics)
        if (data.statistics.length > 0 && !selectedStat) {
          setSelectedStat(data.statistics[0])
        }
      } catch (e) {
        console.error('Failed to load statistics options:', e)
      }
    }

    loadAvailable()
  }, [networkId, selectedStat])

  const runStatistics = async () => {
    if (!selectedStat) return

    setLoading(true)
    setError(null)

    try {
      const data = await api.post(`/networks/${networkId}/statistics`, {
        statistic: selectedStat,
        groupby: groupBy,
      })
      setResult(data)
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const formatResult = (data: unknown): JSX.Element => {
    if (!data || typeof data !== 'object') {
      return <pre className="text-sm">{JSON.stringify(data, null, 2)}</pre>
    }

    const obj = data as Record<string, unknown>

    // Handle pandas DataFrame split format
    if ('index' in obj && 'columns' in obj && 'data' in obj) {
      const { index, columns, data: values } = obj as {
        index: string[]
        columns: string[]
        data: number[][]
      }

      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 bg-muted"></th>
              {columns.map((col) => (
                <th key={col} className="text-left p-2 bg-muted">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {values.map((row, i) => (
              <tr key={index[i]} className="border-b border-border hover:bg-muted/50">
                <td className="p-2 font-medium">{index[i]}</td>
                {row.map((val, j) => (
                  <td key={j} className="p-2">
                    {typeof val === 'number'
                      ? val.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : String(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    // Handle data property containing object
    if ('data' in obj && typeof obj.data === 'object') {
      const entries = Object.entries(obj.data as Record<string, number>)
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 bg-muted">Key</th>
              <th className="text-left p-2 bg-muted">Value</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, val]) => (
              <tr key={key} className="border-b border-border hover:bg-muted/50">
                <td className="p-2 font-medium">{key}</td>
                <td className="p-2">
                  {typeof val === 'number'
                    ? val.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : String(val)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    // Simple key-value object
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-2 bg-muted">Key</th>
            <th className="text-left p-2 bg-muted">Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(obj).map(([key, val]) => (
            <tr key={key} className="border-b border-border hover:bg-muted/50">
              <td className="p-2 font-medium">{key}</td>
              <td className="p-2">
                {typeof val === 'number'
                  ? val.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : String(val)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (availableStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <div className="text-center">
          <p>No statistics available</p>
          <p className="text-sm mt-1">Select a network to explore its statistics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Statistics Explorer</h2>

      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedStat}
          onChange={(e) => setSelectedStat(e.target.value)}
          className="px-3 py-2 bg-secondary border border-border rounded-md text-sm"
        >
          {availableStats.map((stat) => (
            <option key={stat} value={stat}>
              {stat.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value)}
          className="px-3 py-2 bg-secondary border border-border rounded-md text-sm"
        >
          <option value="carrier">Group by Carrier</option>
          <option value="bus">Group by Bus</option>
          <option value="bus_carrier">Group by Bus + Carrier</option>
        </select>

        <Button onClick={runStatistics} disabled={loading || !selectedStat}>
          {loading ? 'Calculating...' : 'Calculate'}
        </Button>
      </div>

      <div className="bg-secondary/50 rounded-lg p-4 overflow-x-auto">
        {error ? (
          <div className="text-destructive">{error}</div>
        ) : result ? (
          formatResult(result)
        ) : (
          <div className="text-muted-foreground text-sm">
            Select a statistic and click Calculate
          </div>
        )}
      </div>
    </div>
  )
}
