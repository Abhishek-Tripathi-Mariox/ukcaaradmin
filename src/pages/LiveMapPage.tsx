import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Car, Users, AlertCircle, RefreshCw, MapPin, Phone, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { dispatchAPI, ridesAPI } from '@/services/api';
import { PageHeader, LoadingSpinner, StatusBadge } from '@/components/common';
import { Modal } from '@/components/Modal';

// Default Leaflet marker icons fail in bundlers; rebind them.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface DriverLoc {
  _id: string;
  name: string;
  phone?: string;
  location?: { lat: number; lng: number };
  vehicle?: { make?: string; model?: string; plate?: string } | null;
  rating?: number;
  isOnePass?: boolean;
  busy: boolean;
  activeRide?: { _id: string; status: string } | null;
}

interface LiveRide {
  _id: string;
  status: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  customer?: { firstName?: string; lastName?: string; phone?: string };
  driver?: { _id: string; firstName?: string; lastName?: string; phone?: string } | null;
  estimatedFare?: number;
  rideType?: string;
  createdAt: string;
}

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946]; // Bengaluru
const DEFAULT_ZOOM = 12;

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

function carIcon(color: string) {
  return L.divIcon({
    className: 'driver-marker',
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);color:#fff;font-size:14px;">🚗</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const availableIcon = carIcon('#16a34a');
const busyIcon = carIcon('#f97316');
const pickupIcon = L.divIcon({
  className: 'pickup-marker',
  html: `<div style="background:#2563eb;width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function LiveMapPage() {
  const qc = useQueryClient();
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [showAvailable, setShowAvailable] = useState(true);
  const [showBusy, setShowBusy] = useState(true);

  const driversQ = useQuery({
    queryKey: ['dispatch', 'online-drivers'],
    queryFn: async () => (await dispatchAPI.getOnlineDrivers()).data.data as {
      drivers: DriverLoc[];
      total: number;
      available: number;
      busy: number;
    },
    refetchInterval: 10000,
  });

  const ridesQ = useQuery({
    queryKey: ['rides', 'live'],
    queryFn: async () => (await ridesAPI.getLive()).data.data as {
      rides: LiveRide[];
      count: number;
      searching: number;
      inProgress: number;
    },
    refetchInterval: 10000,
  });

  const drivers = driversQ.data?.drivers ?? [];
  const rides = ridesQ.data?.rides ?? [];

  const visibleDrivers = drivers.filter(
    (d) => d.location && ((d.busy && showBusy) || (!d.busy && showAvailable))
  );

  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    visibleDrivers.forEach((d) => {
      if (d.location) pts.push([d.location.lat, d.location.lng]);
    });
    rides.forEach((r) => pts.push([r.pickup.lat, r.pickup.lng]));
    return pts;
  }, [visibleDrivers, rides]);

  const selectedRide = rides.find((r) => r._id === selectedRideId) || null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live Map & Dispatch"
        subtitle="Real-time view of online drivers and active rides"
        actions={
          <button
            onClick={() => {
              driversQ.refetch();
              ridesQ.refetch();
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${driversQ.isFetching || ridesQ.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Car className="text-green-600" />} label="Available drivers" value={driversQ.data?.available ?? 0} />
        <StatCard icon={<Car className="text-orange-500" />} label="Busy drivers" value={driversQ.data?.busy ?? 0} />
        <StatCard icon={<Users className="text-blue-600" />} label="Active rides" value={ridesQ.data?.count ?? 0} />
        <StatCard icon={<AlertCircle className="text-red-600" />} label="Searching" value={ridesQ.data?.searching ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-200 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showAvailable} onChange={(e) => setShowAvailable(e.target.checked)} />
              <span className="text-green-700">Available</span>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showBusy} onChange={(e) => setShowBusy(e.target.checked)} />
              <span className="text-orange-600">Busy</span>
            </label>
            <span className="ml-auto text-gray-500">
              {visibleDrivers.length} drivers · {rides.length} rides
            </span>
          </div>
          <div className="h-[600px]">
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              scrollWheelZoom
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds points={allPoints} />

              {visibleDrivers.map((d) => (
                <Marker
                  key={d._id}
                  position={[d.location!.lat, d.location!.lng]}
                  icon={d.busy ? busyIcon : availableIcon}
                >
                  <Popup>
                    <div className="space-y-1 text-sm">
                      <div className="font-semibold">{d.name || 'Driver'}</div>
                      {d.phone && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Phone className="w-3 h-3" /> {d.phone}
                        </div>
                      )}
                      {d.vehicle && (
                        <div className="text-gray-700">
                          {d.vehicle.make} {d.vehicle.model}
                          {d.vehicle.plate && <span className="ml-1 text-gray-500">({d.vehicle.plate})</span>}
                        </div>
                      )}
                      {d.rating != null && (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <Star className="w-3 h-3" /> {d.rating.toFixed(1)}
                        </div>
                      )}
                      <div>
                        <StatusBadge status={d.busy ? 'busy' : 'available'} variant={d.busy ? 'warning' : 'success'} />
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {rides.map((r) => (
                <Marker key={r._id} position={[r.pickup.lat, r.pickup.lng]} icon={pickupIcon}>
                  <Popup>
                    <div className="space-y-1 text-sm">
                      <div className="font-semibold">{r.status.replace(/_/g, ' ')}</div>
                      <div className="text-gray-600">
                        <span className="text-blue-600 font-medium">Pickup:</span> {r.pickup.address}
                      </div>
                      <div className="text-gray-600">
                        <span className="text-red-600 font-medium">Drop:</span> {r.dropoff.address}
                      </div>
                      {r.customer && (
                        <div className="text-gray-700">
                          Customer: {r.customer.firstName} {r.customer.lastName}
                        </div>
                      )}
                      {!r.driver && (
                        <button
                          onClick={() => setSelectedRideId(r._id)}
                          className="mt-2 px-2 py-1 bg-blue-600 text-white rounded text-xs"
                        >
                          Manual dispatch
                        </button>
                      )}
                      {r.driver && (
                        <button
                          onClick={() => setSelectedRideId(r._id)}
                          className="mt-2 px-2 py-1 bg-orange-500 text-white rounded text-xs"
                        >
                          Reassign
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {rides.map((r) => (
                <CircleMarker
                  key={`drop-${r._id}`}
                  center={[r.dropoff.lat, r.dropoff.lng]}
                  radius={6}
                  pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.6 }}
                >
                  <Popup>Drop: {r.dropoff.address}</Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Active rides list */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Active Rides</h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[640px] divide-y divide-gray-100">
            {ridesQ.isLoading && (
              <div className="p-6 flex justify-center">
                <LoadingSpinner />
              </div>
            )}
            {!ridesQ.isLoading && rides.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500">No active rides</div>
            )}
            {rides.map((r) => (
              <button
                key={r._id}
                onClick={() => setSelectedRideId(r._id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <StatusBadge
                    status={r.status.replace(/_/g, ' ')}
                    variant={
                      r.status === 'searching'
                        ? 'warning'
                        : r.status === 'in_progress'
                        ? 'success'
                        : 'info'
                    }
                  />
                  <span className="text-xs text-gray-500">
                    {new Date(r.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-xs text-gray-600 truncate">
                  <MapPin className="inline w-3 h-3 mr-1 text-blue-600" />
                  {r.pickup.address}
                </div>
                <div className="text-xs text-gray-600 truncate">
                  <MapPin className="inline w-3 h-3 mr-1 text-red-600" />
                  {r.dropoff.address}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {r.customer
                    ? `${r.customer.firstName ?? ''} ${r.customer.lastName ?? ''}`.trim()
                    : '—'}
                  {r.driver ? (
                    <span className="ml-2 text-green-700">
                      → {r.driver.firstName} {r.driver.lastName}
                    </span>
                  ) : (
                    <span className="ml-2 text-orange-600">no driver</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedRide && (
        <DispatchModal
          ride={selectedRide}
          onClose={() => setSelectedRideId(null)}
          onAssigned={() => {
            qc.invalidateQueries({ queryKey: ['rides', 'live'] });
            qc.invalidateQueries({ queryKey: ['dispatch', 'online-drivers'] });
            setSelectedRideId(null);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

interface NearbyDriver {
  _id: string;
  name: string;
  phone?: string;
  vehicle?: { make?: string; model?: string; plate?: string } | null;
  rating?: number;
  distanceKm: number;
  etaMin: number;
}

function DispatchModal({
  ride,
  onClose,
  onAssigned,
}: {
  ride: LiveRide;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [radius, setRadius] = useState(10);
  const [reason, setReason] = useState('');

  const nearbyQ = useQuery({
    queryKey: ['dispatch', 'nearby', ride._id, radius],
    queryFn: async () =>
      (await dispatchAPI.getNearbyDrivers(ride._id, { radius, limit: 30 })).data.data as {
        drivers: NearbyDriver[];
        count: number;
      },
  });

  const assign = useMutation({
    mutationFn: (driverId: string) => dispatchAPI.assignDriver(ride._id, driverId, reason || undefined),
    onSuccess: () => {
      toast.success('Driver assigned');
      onAssigned();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Assignment failed');
    },
  });

  return (
    <Modal isOpen onClose={onClose} title={`Manual dispatch · ${ride._id.slice(-6).toUpperCase()}`} size="lg">
      <div className="space-y-4">
        <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
          <div>
            <span className="text-gray-500">Pickup:</span> {ride.pickup.address}
          </div>
          <div>
            <span className="text-gray-500">Drop:</span> {ride.dropoff.address}
          </div>
          {ride.driver && (
            <div className="text-orange-700">
              Currently assigned: {ride.driver.firstName} {ride.driver.lastName}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Search radius (km)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={radius}
              onChange={(e) => setRadius(Math.max(1, Math.min(50, Number(e.target.value) || 10)))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. driver unresponsive"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 text-sm font-medium">
            Nearby available drivers ({nearbyQ.data?.count ?? 0})
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {nearbyQ.isLoading && (
              <div className="p-6 flex justify-center">
                <LoadingSpinner />
              </div>
            )}
            {!nearbyQ.isLoading && (nearbyQ.data?.drivers.length ?? 0) === 0 && (
              <div className="p-6 text-center text-sm text-gray-500">
                No available drivers within {radius} km.
              </div>
            )}
            {nearbyQ.data?.drivers.map((d) => (
              <div key={d._id} className="px-3 py-2 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-sm font-medium">{d.name}</div>
                  <div className="text-xs text-gray-500">
                    {d.vehicle ? `${d.vehicle.make ?? ''} ${d.vehicle.model ?? ''} ${d.vehicle.plate ? `· ${d.vehicle.plate}` : ''}` : '—'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {d.distanceKm} km · ~{d.etaMin} min
                    {d.rating != null && <span className="ml-2 text-yellow-600">★ {d.rating.toFixed(1)}</span>}
                  </div>
                </div>
                <button
                  disabled={assign.isPending}
                  onClick={() => assign.mutate(d._id)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Assign
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
