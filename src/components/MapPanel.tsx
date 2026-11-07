/// <reference types="google.maps" />
import { useEffect, useState } from 'react';
import { APIProvider, AdvancedMarker, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useProvider } from '../app/ProviderContext.tsx';

const CENTER = { lat: 3.0566, lng: 101.6963 };

const MARKERS = [
  { id: 'apu', label: 'APU', position: { lat: 3.05607, lng: 101.70047 } },
  { id: 'lrt', label: 'LRT Bukit Jalil', position: { lat: 3.05813, lng: 101.69222 } },
  { id: 'stadium', label: 'TM Stadium Nasional', position: { lat: 3.05468, lng: 101.69137 } },
];

function TrafficLayer() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const layer = new google.maps.TrafficLayer();
    layer.setMap(map);
    return () => layer.setMap(null);
  }, [map]);
  return null;
}

function RouteLine({ encoded }: { encoded: string | null }) {
  const map = useMap();
  const geometry = useMapsLibrary('geometry');
  useEffect(() => {
    if (!map || !geometry || !encoded) return;
    const line = new google.maps.Polyline({
      path: geometry.encoding.decodePath(encoded),
      strokeColor: '#60a5fa',
      strokeWeight: 4,
      map,
    });
    return () => line.setMap(null);
  }, [map, geometry, encoded]);
  return null;
}

function useRoutePolyline(): string | null {
  const provider = useProvider();
  const [encoded, setEncoded] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    provider
      .listBaselineTables()
      .then((tables) => {
        if (cancelled) return;
        const row = tables.find((t) => t.name === 'baseline_values')?.rows.find((r) => r.key === 'route_encoded_polyline');
        setEncoded(typeof row?.value === 'string' && row.value ? row.value : null);
      })
      .catch(() => {
        if (!cancelled) setEncoded(null);
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);
  return encoded;
}

export function MapPanel({ height = 260 }: { height?: number }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
  const encoded = useRoutePolyline();

  if (!apiKey) {
    return (
      <div
        role="status"
        style={{ height }}
        className="flex items-center justify-center border-t border-border bg-panel-2/50 px-4 text-center text-sm text-text-3"
      >
        Live map is off: add VITE_GOOGLE_MAPS_KEY to .env.local to show real traffic
      </div>
    );
  }

  return (
    <div style={{ height }} className="overflow-hidden border-t border-border bg-panel">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={CENTER}
          defaultZoom={15}
          mapId="DEMO_MAP_ID"
          colorScheme="DARK"
          disableDefaultUI
          gestureHandling="cooperative"
        >
          <TrafficLayer />
          <RouteLine encoded={encoded} />
          {MARKERS.map((m) => (
            <AdvancedMarker key={m.id} position={m.position} title={m.label}>
              <div className="flex items-center gap-1.5 rounded-full border border-white/80 bg-[#0b1017] px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
                {m.label}
              </div>
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}
