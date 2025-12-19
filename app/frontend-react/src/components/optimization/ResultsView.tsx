import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api, type OptimizationResults, type OptimizationStatus } from '@/api/client'
import { useNetworkStore } from '@/stores/networkStore'

interface ResultsViewProps {
  networkId: string
}

export function ResultsView({ networkId }: ResultsViewProps) {
  const [results, setResults] = useState<OptimizationResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { optimization } = useNetworkStore()

  useEffect(() => {
    const loadResults = async () => {
      setLoading(true)
      setError(null)

      try {
        // First check if network has been optimized
        const status = await api.get<OptimizationStatus>(
          `/networks/${networkId}/optimization-status`
        )

        if (status.status !== 'completed') {
          setError('Network has not been optimized yet. Click "Run Optimization" to solve.')
          setResults(null)
          setLoading(false)
          return
        }

        const data = await api.get<OptimizationResults>(
          `/networks/${networkId}/results`
        )
        setResults(data)
      } catch (e) {
        setError('No optimization results available')
      } finally {
        setLoading(false)
      }
    }

    loadResults()
  }, [networkId, optimization.status])

  if (loading) {
    return <div className="text-muted-foreground">Loading results...</div>
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="mb-2">{error}</p>
      </div>
    )
  }

  if (!results) {
    return <div className="text-muted-foreground">No results available</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-primary">Optimization Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-2">Objective Value:</p>
          <div className="text-4xl font-bold">
            {results.objective !== null
              ? results.objective.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : 'N/A'}
          </div>
        </CardContent>
      </Card>

      {results.generators_p_nom_opt && results.generators_p_nom_opt.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Generator Capacities (p_nom_opt)
          </h3>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Bus</th>
                  <th className="text-left p-3">Carrier</th>
                  <th className="text-right p-3">p_nom</th>
                  <th className="text-right p-3">p_nom_opt</th>
                </tr>
              </thead>
              <tbody>
                {results.generators_p_nom_opt.map((gen) => (
                  <tr
                    key={gen.name}
                    className="border-b border-border hover:bg-muted/50"
                  >
                    <td className="p-3">{gen.name}</td>
                    <td className="p-3">{gen.bus}</td>
                    <td className="p-3">{gen.carrier}</td>
                    <td className="p-3 text-right">
                      {gen.p_nom.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3 text-right font-medium text-primary">
                      {gen.p_nom_opt.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.lines_s_nom_opt && results.lines_s_nom_opt.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Line Capacities (s_nom_opt)
          </h3>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Bus0</th>
                  <th className="text-left p-3">Bus1</th>
                  <th className="text-right p-3">s_nom</th>
                  <th className="text-right p-3">s_nom_opt</th>
                </tr>
              </thead>
              <tbody>
                {results.lines_s_nom_opt.map((line) => (
                  <tr
                    key={line.name}
                    className="border-b border-border hover:bg-muted/50"
                  >
                    <td className="p-3">{line.name}</td>
                    <td className="p-3">{line.bus0}</td>
                    <td className="p-3">{line.bus1}</td>
                    <td className="p-3 text-right">
                      {line.s_nom.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3 text-right font-medium text-primary">
                      {line.s_nom_opt.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
