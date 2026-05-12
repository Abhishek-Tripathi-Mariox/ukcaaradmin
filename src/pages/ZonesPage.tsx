import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zonesAPI } from '@/services/api';
import { Modal, ConfirmModal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, RefreshButton } from '@/components/common';
import { Plus, Pencil, Trash2, MapPin, Activity, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ZONE_KINDS = [
  { value: 'surge', label: 'Surge', color: '#ef4444' },
  { value: 'no_pickup', label: 'No pickup', color: '#6b7280' },
  { value: 'restricted', label: 'Restricted', color: '#7c3aed' },
  { value: 'airport', label: 'Airport', color: '#0ea5e9' },
  { value: 'city', label: 'City', color: '#10b981' },
] as const;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const minutesToHHMM = (m: number) => {
  const hh = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
};
const hhmmToMinutes = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// ════════════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════════════

export default function ZonesPage() {
  const qcMain = useQueryClient();
  const [tab, setTab] = useState<'zones' | 'rules' | 'probe'>('zones');

  const handleRefresh = () => {
    qcMain.refetchQueries({ queryKey: ['zones'] });
    qcMain.refetchQueries({ queryKey: ['surge-rules'] });
  };

  return (
    <div>
      <PageHeader
        title="Zones & Surge"
        subtitle="Geofenced areas, surge multipliers and time-based pricing rules"
        actions={<RefreshButton onRefresh={handleRefresh} />}
      />

      <div className="flex gap-2 border-b mb-6">
        {(['zones', 'rules', 'probe'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'zones' ? 'Zones' : t === 'rules' ? 'Surge rules' : 'Probe'}
          </button>
        ))}
      </div>

      {tab === 'zones' && <ZonesTab />}
      {tab === 'rules' && <SurgeRulesTab />}
      {tab === 'probe' && <ProbeTab />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ZONES TAB
// ════════════════════════════════════════════════════════════════════

function ZonesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => (await zonesAPI.listZones()).data?.data?.zones ?? [],
  });

  const del = useMutation({
    mutationFn: (id: string) => zonesAPI.deleteZone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zones'] });
      qc.invalidateQueries({ queryKey: ['surge-rules'] });
      toast.success('Zone deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Failed to delete zone'),
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setCreating(true)} className="btn btn-primary">
          <Plus className="w-4 h-4 mr-1" /> New zone
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.length ? (
        <div className="bg-white border rounded-lg p-10 text-center text-gray-500 text-sm">
          No zones yet. Create one to start applying surge or geofencing.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((z: any) => (
            <div key={z._id} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ background: z.color || '#3b82f6' }}
                    />
                    <h3 className="font-semibold truncate">{z.name}</h3>
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {z.kind}
                    </span>
                    <StatusBadge status={z.isActive ? 'active' : 'inactive'} />
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(z)}
                    className="p-1.5 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => setDeleting(z)}
                    className="p-1.5 hover:bg-gray-100 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
              {z.description && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{z.description}</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-gray-500">Multiplier</div>
                  <div className="font-semibold">×{z.surgeMultiplier ?? 1}</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-gray-500">Surcharge</div>
                  <div className="font-semibold">₹{(z.flatSurcharge ?? 0).toFixed(2)}</div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-gray-400">
                Updated {format(new Date(z.updatedAt), 'PP p')}
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <ZoneFormModal
          zone={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['zones'] })}
        />
      )}

      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting._id)}
        title="Delete zone"
        message={`Delete "${deleting?.name}"? Surge rules tied to this zone will become global.`}
        confirmText="Delete"
        variant="danger"
        isLoading={del.isPending}
      />
    </div>
  );
}

function ZoneFormModal({
  zone,
  onClose,
  onSaved,
}: {
  zone: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!zone;
  const [name, setName] = useState(zone?.name ?? '');
  const [kind, setKind] = useState(zone?.kind ?? 'surge');
  const [description, setDescription] = useState(zone?.description ?? '');
  const [color, setColor] = useState(zone?.color ?? '#3b82f6');
  const [isActive, setIsActive] = useState(zone?.isActive ?? true);
  const [surgeMultiplier, setSurgeMultiplier] = useState(zone?.surgeMultiplier ?? 1);
  const [flatSurcharge, setFlatSurcharge] = useState(zone?.flatSurcharge ?? 0);
  const [coordsText, setCoordsText] = useState(
    zone
      ? JSON.stringify(zone.geometry?.coordinates ?? [], null, 2)
      : '[\n  [\n    [-0.13, 51.50],\n    [-0.10, 51.50],\n    [-0.10, 51.52],\n    [-0.13, 51.52],\n    [-0.13, 51.50]\n  ]\n]'
  );

  const save = useMutation({
    mutationFn: async () => {
      let coordinates: any;
      try {
        coordinates = JSON.parse(coordsText);
      } catch {
        throw new Error('Coordinates must be valid JSON');
      }
      const body = {
        name,
        kind,
        description,
        color,
        isActive,
        surgeMultiplier: Number(surgeMultiplier),
        flatSurcharge: Number(flatSurcharge),
        geometry: { type: 'Polygon', coordinates },
      };
      if (isEdit) return zonesAPI.updateZone(zone._id, body);
      return zonesAPI.createZone(body);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Zone updated' : 'Zone created');
      onSaved();
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || e?.message || 'Save failed'),
  });

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit zone' : 'New zone'} size="xl">
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600">Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Kind</label>
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {ZONE_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Description</label>
            <textarea
              className="input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Color</label>
            <input
              type="color"
              className="input h-10 p-1"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="active" className="text-sm">
              Active
            </label>
          </div>
          <div>
            <label className="text-xs text-gray-600">Surge multiplier (×)</label>
            <input
              type="number"
              step="0.05"
              min="0.5"
              max="5"
              className="input"
              value={surgeMultiplier}
              onChange={(e) => setSurgeMultiplier(e.target.value)}
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Only used when kind = "surge". 1.0 = no surge.
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-600">Flat surcharge (₹)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="input"
              value={flatSurcharge}
              onChange={(e) => setFlatSurcharge(e.target.value)}
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Added on top of surge. Useful for airport pickup fees.
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-600">
            Polygon coordinates (GeoJSON: array of rings; each ring is [lng, lat] pairs and
            must close)
          </label>
          <textarea
            className="input font-mono text-xs"
            rows={10}
            value={coordsText}
            onChange={(e) => setCoordsText(e.target.value)}
          />
          <p className="text-[10px] text-gray-500 mt-1">
            Tip: draw a polygon at{' '}
            <a
              className="text-primary-600 underline"
              href="https://geojson.io"
              target="_blank"
              rel="noreferrer"
            >
              geojson.io
            </a>{' '}
            and paste the <code>coordinates</code> array here.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !name}
            className="btn btn-primary"
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create zone'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// SURGE RULES TAB
// ════════════════════════════════════════════════════════════════════

function SurgeRulesTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['surge-rules'],
    queryFn: async () => (await zonesAPI.listSurgeRules()).data?.data?.rules ?? [],
  });
  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => (await zonesAPI.listZones()).data?.data?.zones ?? [],
  });

  const del = useMutation({
    mutationFn: (id: string) => zonesAPI.deleteSurgeRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surge-rules'] });
      toast.success('Rule deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Failed to delete rule'),
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setCreating(true)} className="btn btn-primary">
          <Plus className="w-4 h-4 mr-1" /> New rule
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !rules?.length ? (
        <div className="bg-white border rounded-lg p-10 text-center text-gray-500 text-sm">
          No surge rules yet. Create one to apply time-based pricing.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Zone</th>
                <th className="px-3 py-2 text-left">Days</th>
                <th className="px-3 py-2 text-left">Window</th>
                <th className="px-3 py-2 text-right">×</th>
                <th className="px-3 py-2 text-right">+ ₹</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((r: any) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    {r.description && (
                      <div className="text-xs text-gray-500">{r.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.zone?.name ? (
                      <span className="text-xs">{r.zone.name}</span>
                    ) : (
                      <span className="text-xs text-gray-400">Global</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.daysOfWeek?.length === 7
                      ? 'Daily'
                      : r.daysOfWeek?.map((d: number) => DAY_LABELS[d]).join(', ')}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {minutesToHHMM(r.startMinute)} – {minutesToHHMM(r.endMinute)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">×{r.multiplier}</td>
                  <td className="px-3 py-2 text-right">
                    {(r.flatSurcharge ?? 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">{r.priority}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={r.isActive ? 'active' : 'inactive'} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(r)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                      >
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => setDeleting(r)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <SurgeRuleFormModal
          rule={editing}
          zones={zones ?? []}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['surge-rules'] })}
        />
      )}

      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting._id)}
        title="Delete rule"
        message={`Delete "${deleting?.name}"?`}
        confirmText="Delete"
        variant="danger"
        isLoading={del.isPending}
      />
    </div>
  );
}

function SurgeRuleFormModal({
  rule,
  zones,
  onClose,
  onSaved,
}: {
  rule: any | null;
  zones: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!rule;
  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [zone, setZone] = useState<string>(rule?.zone?._id ?? rule?.zone ?? '');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    rule?.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]
  );
  const [startMinute, setStartMinute] = useState(
    minutesToHHMM(rule?.startMinute ?? 17 * 60)
  );
  const [endMinute, setEndMinute] = useState(minutesToHHMM(rule?.endMinute ?? 20 * 60));
  const [multiplier, setMultiplier] = useState(rule?.multiplier ?? 1.5);
  const [flatSurcharge, setFlatSurcharge] = useState(rule?.flatSurcharge ?? 0);
  const [priority, setPriority] = useState(rule?.priority ?? 0);
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);

  const toggleDay = (d: number) =>
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );

  const save = useMutation({
    mutationFn: async () => {
      const body: any = {
        name,
        description,
        zone: zone || undefined,
        daysOfWeek,
        startMinute: hhmmToMinutes(startMinute),
        endMinute: hhmmToMinutes(endMinute),
        multiplier: Number(multiplier),
        flatSurcharge: Number(flatSurcharge),
        priority: Number(priority),
        isActive,
      };
      if (isEdit) return zonesAPI.updateSurgeRule(rule._id, body);
      return zonesAPI.createSurgeRule(body);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Rule updated' : 'Rule created');
      onSaved();
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || e?.message || 'Save failed'),
  });

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit surge rule' : 'New surge rule'} size="lg">
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Description</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Zone (optional)</label>
            <select
              className="input"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            >
              <option value="">Global (all areas)</option>
              {zones.map((z) => (
                <option key={z._id} value={z._id}>
                  {z.name} ({z.kind})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Priority (higher wins)</label>
            <input
              type="number"
              className="input"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Start time</label>
            <input
              type="time"
              className="input"
              value={startMinute}
              onChange={(e) => setStartMinute(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">End time</label>
            <input
              type="time"
              className="input"
              value={endMinute}
              onChange={(e) => setEndMinute(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Multiplier (×)</label>
            <input
              type="number"
              step="0.05"
              min="0.5"
              max="5"
              className="input"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Flat surcharge (₹)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="input"
              value={flatSurcharge}
              onChange={(e) => setFlatSurcharge(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-600">Days of week</label>
          <div className="flex gap-2 mt-1">
            {DAY_LABELS.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(i)}
                className={`px-3 py-1.5 text-xs rounded border ${
                  daysOfWeek.includes(i)
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="r-active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <label htmlFor="r-active" className="text-sm">
            Active
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !name}
            className="btn btn-primary"
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create rule'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// PROBE TAB — test surge for a (lat,lng,when)
// ════════════════════════════════════════════════════════════════════

function ProbeTab() {
  const [lat, setLat] = useState('51.5074');
  const [lng, setLng] = useState('-0.1278');
  const [subtotal, setSubtotal] = useState('20');
  const [when, setWhen] = useState(
    new Date().toISOString().slice(0, 16) // yyyy-MM-ddTHH:mm
  );
  const [result, setResult] = useState<any | null>(null);

  const probe = useMutation({
    mutationFn: () =>
      zonesAPI.probe({
        lat: Number(lat),
        lng: Number(lng),
        subtotal: Number(subtotal),
        when: new Date(when).toISOString(),
      }),
    onSuccess: (res) => setResult(res.data?.data),
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Probe failed'),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Test point
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600">Latitude</label>
            <input className="input" value={lat} onChange={(e) => setLat(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-600">Longitude</label>
            <input className="input" value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-600">Fare subtotal (₹)</label>
            <input
              className="input"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">When</label>
            <input
              type="datetime-local"
              className="input"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={() => probe.mutate()}
          disabled={probe.isPending}
          className="btn btn-primary w-full"
        >
          {probe.isPending ? 'Probing…' : 'Resolve surge'}
        </button>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4" /> Result
        </h3>
        {!result ? (
          <p className="text-sm text-gray-500">Run a probe to see the resolved surge.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Multiplier"
                value={`×${result.surge?.multiplier ?? 1}`}
                accent={result.surge?.multiplier > 1}
              />
              <Stat
                label="Surcharge"
                value={`₹${(result.surge?.flatSurcharge ?? 0).toFixed(2)}`}
                accent={result.surge?.flatSurcharge > 0}
              />
              <Stat
                label="Surge fare"
                value={`₹${(result.surge?.surgeAmount ?? 0).toFixed(2)}`}
                accent={result.surge?.surgeAmount > 0}
              />
              <Stat
                label="Pickup blocked"
                value={result.blocked ? 'YES' : 'No'}
                danger={result.blocked}
              />
            </div>
            {result.blocked && result.blockedBy && (
              <div className="bg-red-50 text-red-700 text-xs rounded p-2">
                Blocked by zone <strong>{result.blockedBy.name}</strong> ({result.blockedBy.kind})
              </div>
            )}
            {result.surge?.reasons?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1">
                  <Zap className="w-3.5 h-3.5" /> Reasons
                </div>
                <ul className="text-xs space-y-1">
                  {result.surge.reasons.map((r: string, i: number) => (
                    <li key={i} className="text-gray-700">• {r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-[10px] text-gray-400">
              Evaluated at {format(new Date(result.when), 'PP p')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded p-3 border ${
        danger ? 'bg-red-50 border-red-200' : accent ? 'bg-amber-50 border-amber-200' : 'bg-gray-50'
      }`}
    >
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-semibold ${danger ? 'text-red-700' : ''}`}>{value}</div>
    </div>
  );
}

