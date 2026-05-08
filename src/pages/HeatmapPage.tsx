import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet.heat';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Flame } from 'lucide-react';
import { reportsAPI } from '@/services/api';
import { PageHeader, LoadingSpinner } from '@/components/common';

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

function HeatLayer({ points, max }: { points: HeatPoint[]; max: number }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const data = points.map((p) => [p.lat, p.lng, p.weight] as [number, number, number]);
    const layer = (L as any).heatLayer(data, {
      radius: 25,
      blur: 18,
      maxZoom: 17,
      max: Math.max(max, 1),
      gradient: {
        0.2: '#3b82f6',
        0.4: '#10b981',
        0.6: '#f59e0b',
        0.8: '#f97316',
        1.0: '#ef4444',
      },
    }).addTo(map);

    // Fit map to points
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }

    return () => {
      map.removeLayer(layer);
    };
  }, [points, max, map]);
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
                <HeatLayer points={data.points} max={data.maxWeight} />
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
