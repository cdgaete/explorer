import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useLayoutStore } from '@/stores/layoutStore'
import { useNetworkStore } from '@/stores/networkStore'
import { MapView } from '@/components/network/MapView'
import { MetadataView } from '@/components/network/MetadataView'
import { StatisticsView } from '@/components/network/StatisticsView'
import { DataTableView } from '@/components/data/DataTableView'
import { ResultsView } from '@/components/optimization/ResultsView'
import { Map, Info, BarChart3, CircleDot, Zap, Cable, Plug, Link2, Trophy } from 'lucide-react'

const TABS = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'metadata', label: 'Metadata', icon: Info },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  { id: 'buses', label: 'Buses', icon: CircleDot },
  { id: 'generators', label: 'Generators', icon: Zap },
  { id: 'lines', label: 'Lines', icon: Cable },
  { id: 'loads', label: 'Loads', icon: Plug },
  { id: 'links', label: 'Links', icon: Link2 },
  { id: 'results', label: 'Results', icon: Trophy },
]

export function MainContent() {
  const { activeTab, setActiveTab } = useLayoutStore()
  const { selectedNetworkId } = useNetworkStore()

  if (!selectedNetworkId) {
    return (
      <div className="flex items-center justify-center h-full bg-background text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">No network selected</p>
          <p className="text-sm">Load an example or open a network file to get started</p>
        </div>
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
      <TabsList className="px-2 justify-start overflow-x-auto">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs">
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="map" className="p-0">
        <MapView networkId={selectedNetworkId} />
      </TabsContent>

      <TabsContent value="metadata" className="p-4">
        <MetadataView networkId={selectedNetworkId} />
      </TabsContent>

      <TabsContent value="statistics" className="p-4">
        <StatisticsView networkId={selectedNetworkId} />
      </TabsContent>

      <TabsContent value="buses" className="p-4">
        <DataTableView
          networkId={selectedNetworkId}
          component="buses"
          columns={['name', 'x', 'y', 'v_nom', 'carrier']}
        />
      </TabsContent>

      <TabsContent value="generators" className="p-4">
        <DataTableView
          networkId={selectedNetworkId}
          component="generators"
          columns={['name', 'bus', 'carrier', 'p_nom', 'marginal_cost']}
        />
      </TabsContent>

      <TabsContent value="lines" className="p-4">
        <DataTableView
          networkId={selectedNetworkId}
          component="lines"
          columns={['name', 'bus0', 'bus1', 's_nom', 'x', 'length']}
        />
      </TabsContent>

      <TabsContent value="loads" className="p-4">
        <DataTableView
          networkId={selectedNetworkId}
          component="loads"
          columns={['name', 'bus', 'carrier', 'p_set']}
        />
      </TabsContent>

      <TabsContent value="links" className="p-4">
        <DataTableView
          networkId={selectedNetworkId}
          component="links"
          columns={['name', 'bus0', 'bus1', 'p_nom', 'carrier', 'efficiency']}
        />
      </TabsContent>

      <TabsContent value="results" className="p-4">
        <ResultsView networkId={selectedNetworkId} />
      </TabsContent>
    </Tabs>
  )
}
