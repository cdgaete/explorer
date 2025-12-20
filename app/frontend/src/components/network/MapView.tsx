import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api, type Bus, type Line, type Link } from '@/api/client'
import { useNetworkStore } from '@/stores/networkStore'

interface MapViewProps {
  networkId: string
}

export function MapView({ networkId }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const layersRef = useRef<{
    buses: L.LayerGroup | null
    lines: L.Polyline | null
    links: L.Polyline | null
  }>({ buses: null, lines: null, links: null })

  const [loading, setLoading] = useState(true)
  const wsConnected = useNetworkStore((state) => state.wsConnected)

  useEffect(() => {
    if (!mapRef.current) return

    // Initialize map if not already done
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([50, 10], 4)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(mapInstanceRef.current)
    }

    return () => {
      // Don't destroy map on unmount, just clear layers
    }
  }, [])

  useEffect(() => {
    // Only load when backend is connected
    if (!wsConnected || !mapInstanceRef.current) return

    const loadMapData = async () => {
      setLoading(true)
      const map = mapInstanceRef.current!

      // Clear existing layers
      Object.values(layersRef.current).forEach((layer) => {
        if (layer) map.removeLayer(layer)
      })

      try {
        const [busData, lineData, linkData] = await Promise.all([
          api.get<{ buses: Bus[] }>(`/networks/${networkId}/buses`),
          api.get<{ lines: Line[] }>(`/networks/${networkId}/lines`),
          api.get<{ links: Link[] }>(`/networks/${networkId}/links`),
        ])

        const buses = busData.buses
        const busMap: Record<string, Bus> = {}
        buses.forEach((b) => {
          busMap[b.name] = b
        })

        // Draw lines (AC)
        const lineCoords = lineData.lines
          .filter((l) => busMap[l.bus0] && busMap[l.bus1])
          .map((l) => [
            [busMap[l.bus0].y, busMap[l.bus0].x] as L.LatLngTuple,
            [busMap[l.bus1].y, busMap[l.bus1].x] as L.LatLngTuple,
          ])
        if (lineCoords.length > 0) {
          layersRef.current.lines = L.polyline(lineCoords, {
            color: '#4a9eff',
            weight: 2,
          }).addTo(map)
        }

        // Draw links (DC)
        const linkCoords = linkData.links
          .filter((l) => busMap[l.bus0] && busMap[l.bus1])
          .map((l) => [
            [busMap[l.bus0].y, busMap[l.bus0].x] as L.LatLngTuple,
            [busMap[l.bus1].y, busMap[l.bus1].x] as L.LatLngTuple,
          ])
        if (linkCoords.length > 0) {
          layersRef.current.links = L.polyline(linkCoords, {
            color: '#e94560',
            weight: 2,
            dashArray: '5,5',
          }).addTo(map)
        }

        // Draw buses
        const busMarkers = buses
          .filter((b) => b.x !== 0 || b.y !== 0)
          .map((b) =>
            L.circleMarker([b.y, b.x], {
              radius: 8,
              fillColor: b.carrier === 'DC' ? '#e94560' : '#4a9eff',
              color: '#fff',
              weight: 2,
              fillOpacity: 0.8,
            }).bindPopup(
              `<b>${b.name}</b><br>Carrier: ${b.carrier}<br>V: ${b.v_nom} kV`
            )
          )

        if (busMarkers.length > 0) {
          layersRef.current.buses = L.layerGroup(busMarkers).addTo(map)

          // Fit map to bounds
          const validBuses = buses.filter((b) => b.x || b.y)
          if (validBuses.length > 0) {
            const bounds = L.latLngBounds(validBuses.map((b) => [b.y, b.x]))
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 })
          }
        }
      } catch (e) {
        console.error('Failed to load map data:', e)
      } finally {
        setLoading(false)
      }
    }

    loadMapData()
  }, [networkId, wsConnected])

  // Resize map when container size changes
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize()
    })

    if (mapRef.current) {
      resizeObserver.observe(mapRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="text-muted-foreground">Loading map...</div>
        </div>
      )}
    </div>
  )
}
