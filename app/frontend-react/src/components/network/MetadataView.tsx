import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api, type Metadata } from '@/api/client'

interface MetadataViewProps {
  networkId: string
}

export function MetadataView({ networkId }: MetadataViewProps) {
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadMetadata = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.get<Metadata>(`/networks/${networkId}/metadata`)
        setMetadata(data)
      } catch (e) {
        setError('Failed to load metadata')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    loadMetadata()
  }, [networkId])

  if (loading) {
    return <div className="text-muted-foreground">Loading metadata...</div>
  }

  if (error || !metadata) {
    return <div className="text-destructive">{error || 'No metadata available'}</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Network: {metadata.name}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-primary uppercase">Dimensions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-8">
            <div>
              <div className="text-3xl font-bold text-primary">
                {metadata.dimensions.snapshots}
              </div>
              <div className="text-xs text-muted-foreground">Snapshots</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">
                {metadata.dimensions.investment_periods}
              </div>
              <div className="text-xs text-muted-foreground">Investment Periods</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-primary uppercase">Components</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(metadata.components).map(([name, count]) => (
                <div key={name}>
                  <span className="font-medium">{count}</span>{' '}
                  <span className="text-muted-foreground">{name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-primary uppercase">Carriers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(metadata.carriers).length > 0 ? (
                Object.entries(metadata.carriers).map(([name, info]) => (
                  <div key={name} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: info.color || '#888' }}
                    />
                    <span className="text-sm">{name}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No carriers</div>
              )}
            </div>
          </CardContent>
        </Card>

        {metadata.countries.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-primary uppercase">Countries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {metadata.countries.map((country) => (
                  <span
                    key={country}
                    className="px-2 py-1 text-xs bg-secondary rounded"
                  >
                    {country}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
