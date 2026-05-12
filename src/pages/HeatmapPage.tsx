import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Flame } from 'lucide-react';
import { reportsAPI } from '@/services/api';
import { PageHeader, LoadingSpinner, RefreshButton } from '@/components/common';

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946]; // Bengaluru

interface HeatPoint {
  lat: number;
  lng: number;
  weight: number;
}

interface HeatmapData {
  type: 'pickup' | 'dropoff';
  precision: number;
  totalRides: number;
  maxWeight: number;
  points: HeatPoint[];
}

/** Maps a 0–1 intensity to a CSS rgba color on a white → deep-red scale. */
function intensityToColor(intensity: number): string {
  // Clamp
  const t = Math.max(0, Math.min(1, intensity));
  // white (255,255,255) → orange-red (255,80,0) → deep red (180,0,0)
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const s = t / 0.5;
    r = 255;
    g = Math.round(255 - s * 175); // 255 → 80
    b = Math.round(255 - s * 255); // 255 → 0
  } else {
    const s = (t - 0.5) / 0.5;
    r = Math.round(255 - s * 75);  // 255 → 180
    g = Math.round(80 - s * 80);   // 80  → 0
    b = 0;
  }
  const opacity = 0.25 + t * 0.65; // 0.25 → 0.90
  return `rgba(${r},${g},${b},${opacity})`;
}

/** Returns the pixel radius for a circle marker based on intensity (0–1). */
function circleRadius(intensity: number): number {
  // 10px minimum, up to 28px for hottest cells
  return 10 + Math.round(intensity * 18);
}

function HeatLayer({
  points,
  max,
  precision,
}: {
  points: HeatPoint[];
  max: number;
  precision: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    // Sort so high-intensity dots are drawn on top
    const sorted = [...points].sort((a, b) => a.weight - b.weight);
    const layers: L.CircleMarker[] = [];

    sorted.forEach((p) => {
      const intensity = p.weight / Math.max(max, 1);
      const color = intensityToColor(intensity);
      const radius = circleRadius(intensity);

      const circle = L.circleMarker([p.lat, p.lng], {
        radius,
        color: 'transparent',
        fillColor: color,
        fillOpacity: 1,
        weight: 0,
      });

      circle.bindTooltip(
        `<strong>${p.weight} ride${p.weight !== 1 ? 's' : ''}</strong>`,
        { sticky: true }
      );
      circle.addTo(map);
      layers.push(circle);
    });

    // Fit map to all points
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });

    return () => {
      layers.forEach((l) => map.removeLayer(l));
    };
  }, [points, max, precision, map]);

  return null;
}

/** Floating color-scale legend rendered as a Leaflet control */
function HeatLegend({ max }: { max: number }) {
  const map = useMap();

  useEffect(() => {
    const legend = new L.Control({ position: 'bottomright' });

    legend.onAdd = () => {
      const div = L.DomUtil.create('div');
      div.style.cssText =
        'background:white;padding:8px 10px;border-radius:6px;box-shadow:0 1px 5px rgba(0,0,0,.3);font-size:11px;line-height:1.4;min-width:120px';

      const steps = 5;
      let html = '<div style="font-weight:600;margin-bottom:4px">Ride demand</div>';
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        const rides = Math.round(t * max);
        const color = intensityToColor(t);
        html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
          <span style="width:16px;height:14px;display:inline-block;background:${color};border-radius:2px;flex-shrink:0"></span>
          <span>${rides} ride${rides !== 1 ? 's' : ''}</span>
        </div>`;
      }
      div.innerHTML = html;
      return div;
    };

    legend.addTo(map);
    return () => { map.removeControl(legend); };
  }, [map, max]);

  return null;
}

export default function HeatmapPage() {
  const [type, setType] = useState<'pickup' | 'dropoff'>('pickup');
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState('');
  const [rideType, setRideType] = useState('');
  const [precision, setPrecision] = useState(3);

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const q = useQuery({
    queryKey: ['heatmap', type, days, status, rideType, precision],
    queryFn: async () =>
      (
        await reportsAPI.getHeatmap({
          type,
          startDate,
          status: status || undefined,
          rideType: rideType || undefined,
          precision,
        })
      ).data.data as HeatmapData,
  });

  const data = q.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Demand heatmap"
        subtitle="Pickup / dropoff density by location"
        actions={<RefreshButton onRefresh={() => q.refetch()} isFetching={q.isFetching} />}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-wrap gap-3 items-end">
        <Field label="Map type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="pickup">Pickup</option>
            <option value="dropoff">Dropoff</option>
          </select>
        </Field>
        <Field label="Date range">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </Field>
        <Field label="Ride status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="in_progress">In progress</option>
            <option value="searching">Searching</option>
          </select>
        </Field>
        <Field label="Ride type">
          <select
            value={rideType}
            onChange={(e) => setRideType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All</option>
            <option value="economy">Economy</option>
            <option value="comfort">Comfort</option>
            <option value="premium">Premium</option>
            <option value="xl">XL</option>
            <option value="electric">Electric</option>
          </select>
        </Field>
        <Field label="Grid precision">
          <select
            value={precision}
            onChange={(e) => setPrecision(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value={2}>Coarse (~1km)</option>
            <option value={3}>Medium (~100m)</option>
            <option value={4}>Fine (~10m)</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <SummaryCard
          label="Rides analyzed"
          value={data?.totalRides ?? 0}
          icon={<Flame className="w-5 h-5 text-red-500" />}
        />
        <SummaryCard
          label="Hot cells"
          value={data?.points.length ?? 0}
        />
        <SummaryCard
          label="Peak weight"
          value={data?.maxWeight ?? 0}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="h-[600px]">
          {q.isLoading ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
              />
              {data && data.points.length > 0 && (
                <>
                  <HeatLayer points={data.points} max={data.maxWeight} precision={data.precision} />
                  <HeatLegend max={data.maxWeight} />
                </>
              )}
            </MapContainer>
          )}
        </div>
        {data && data.points.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            No rides in the selected window.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500 uppercase">{label}</div>
        <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
      </div>
      {icon}
    </div>
  );
}
