import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { routesAPI, driversAPI } from '@/services/api';
import { Modal, ConfirmModal } from '@/components/Modal';
import { PageHeader, LoadingSpinner, RefreshButton } from '@/components/common';
import { PlaceSearchInput } from '@/components/PlaceSearchInput';
import { UserSearchSelect, type AdminUserLite } from '@/components/UserSearchSelect';
import { Plus, Pencil, Trash2, MapPin, Users, UserCog, Search, UserPlus, Check } from 'lucide-react';
import toast from 'react-hot-toast';

type RouteType = 'private' | 'scheduled';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

type ScheduleTimingKey =
  | 'bookingCutoffMinutes'
  | 'maxAdvanceBookingDays'
  | 'startWindowMinutes'
  | 'minRestMinutes'
  | 'cancellationCutoffMinutes';

/** Optional per-route timing overrides. Empty input = platform default
 *  (the field is omitted from the payload). Ranges mirror the backend. */
const TIMING_FIELDS: Array<{
  key: ScheduleTimingKey;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  hint: string;
}> = [
  {
    key: 'bookingCutoffMinutes',
    label: 'Booking cutoff (minutes)',
    min: 0,
    max: 720,
    defaultValue: 10,
    hint: 'Customer bookings close this many minutes before each departure.',
  },
  {
    key: 'maxAdvanceBookingDays',
    label: 'Advance booking window (days)',
    min: 1,
    max: 60,
    defaultValue: 14,
    hint: 'Customers can book seats up to this many days ahead.',
  },
  {
    key: 'startWindowMinutes',
    label: 'Start window (minutes)',
    min: 5,
    max: 720,
    defaultValue: 30,
    hint: 'Drivers can start the journey this many minutes before the departure time.',
  },
  {
    key: 'minRestMinutes',
    label: 'Minimum rest (minutes)',
    min: 0,
    max: 1440,
    defaultValue: 0,
    hint: 'Minimum rest a driver must take after completing this route before starting their next journey. Set this on long routes.',
  },
  {
    key: 'cancellationCutoffMinutes',
    label: 'Cancellation cutoff (minutes)',
    min: 0,
    max: 1440,
    defaultValue: 60,
    hint: 'Free cancellation closes this many minutes before departure.',
  },
];

interface Stop {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  sequence: number;
  fareFromPrevious: number;
  /** Postal code for this stop. Picker captures it from the autocomplete
   *  result; the admin can override / type one in for stops where the
   *  geocoder didn't return one. Used by the customer scheduled-route
   *  lookup to match riders by PIN. */
  pincode?: string;
}

interface Departure {
  stopIndex: number;
  time: string;
}

interface RouteForm {
  name: string;
  description?: string;
  type: RouteType;
  isActive: boolean;
  corridorBufferMeters: number;
  stops: Stop[];
  schedule?: {
    daysOfWeek: number[];
    departures: Departure[];
    returnDepartures: Departure[];
    seatPrice?: number;
    vehicleType?: string;
    totalSeats?: number;
    /** Timing overrides — undefined means "use the platform default" and
     *  the key is omitted from the save payload entirely. */
    bookingCutoffMinutes?: number;
    maxAdvanceBookingDays?: number;
    startWindowMinutes?: number;
    minRestMinutes?: number;
    cancellationCutoffMinutes?: number;
  };
}

const emptyStop = (i: number): Stop => ({
  name: '',
  address: '',
  lat: 0,
  lng: 0,
  sequence: i,
  fareFromPrevious: 0,
  pincode: undefined,
});

const blankForm = (): RouteForm => ({
  name: '',
  description: '',
  type: 'scheduled',
  isActive: true,
  corridorBufferMeters: 1500,
  stops: [emptyStop(0), emptyStop(1)],
  schedule: {
    // New scheduled routes start with every day selected — the admin
    // deselects the days the shuttle does not run.
    daysOfWeek: [...ALL_DAYS],
    departures: [],
    returnDepartures: [],
    seatPrice: 0,
    vehicleType: '',
    totalSeats: 1,
  },
});

export default function RoutesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<{ type?: RouteType; isActive?: boolean; search: string }>({
    search: '',
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [managing, setManaging] = useState<any | null>(null);

  const queryParams = useMemo(() => {
    const p: any = {};
    if (filter.type) p.type = filter.type;
    if (filter.isActive !== undefined) p.isActive = filter.isActive;
    if (filter.search.trim()) p.search = filter.search.trim();
    return p;
  }, [filter]);

  const { data: routes = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['routes', queryParams],
    queryFn: async () => (await routesAPI.list(queryParams)).data?.data?.routes ?? [],
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => routesAPI.remove(id),
    onSuccess: () => {
      toast.success('Route deleted');
      qc.invalidateQueries({ queryKey: ['routes'] });
      setDeleting(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Delete failed'),
  });

  return (
    <div>
      <PageHeader
        title="Routes"
        subtitle="Shuttle corridors with fixed stops, departure times and seat inventory"
        actions={
          <div className="flex gap-2">
            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
            <button
              className="btn-primary inline-flex items-center gap-2"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} /> New route
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-lg border p-3 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block">Type</label>
          <select
            className="border rounded px-2 py-1.5 text-sm"
            value={filter.type ?? ''}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                type: (e.target.value || undefined) as RouteType | undefined,
              }))
            }
          >
            <option value="">All</option>
            <option value="private">Private</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block">Status</label>
          <select
            className="border rounded px-2 py-1.5 text-sm"
            value={filter.isActive === undefined ? '' : filter.isActive ? 'true' : 'false'}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                isActive:
                  e.target.value === '' ? undefined : e.target.value === 'true',
              }))
            }
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs text-gray-500 block">Search</label>
          <input
            className="border rounded px-2 py-1.5 text-sm w-full"
            placeholder="Search by name…"
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : routes.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">
          <MapPin className="mx-auto mb-2" />
          No routes yet. Create one to start onboarding drivers.
        </div>
      ) : (
        <div className="grid gap-3">
          {routes.map((r: any) => (
            <div
              key={r._id}
              className="bg-white border rounded-lg p-4 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{r.name}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.type === 'private'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {r.type}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {r.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {r.description && (
                  <p className="text-sm text-gray-600 mt-1">{r.description}</p>
                )}
                <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span>{r.stops?.length ?? 0} stops</span>
                  <span>Corridor ±{r.corridorBufferMeters ?? 0}m</span>
                  {r.type === 'scheduled' && r.schedule?.seatPrice !== undefined && (
                    <span>Seat ₹{r.schedule.seatPrice}</span>
                  )}
                  {r.type === 'scheduled' && r.schedule?.totalSeats !== undefined && (
                    <span>{r.schedule.totalSeats} seats</span>
                  )}
                  {Array.isArray(r.stops) && r.stops.length >= 2 && (
                    <span>
                      End-to-end ₹
                      {r.stops
                        .reduce(
                          (acc: number, s: any) =>
                            acc + (Number(s.fareFromPrevious) || 0),
                          0
                        )
                        .toFixed(2)}
                    </span>
                  )}
                  <span>
                    {r.registeredDrivers?.filter((d: any) => d.status === 'approved').length ?? 0}{' '}
                    approved drivers
                  </span>
                  {r.type === 'private' && (
                    <span>{r.assignedUsers?.length ?? 0} assigned users</span>
                  )}
                </div>
                {r.stops?.length > 0 && (
                  <div className="text-xs text-gray-500 mt-2 truncate">
                    {r.stops.map((s: any) => s.name).join('  →  ')}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  className="btn-ghost p-2"
                  title="Manage drivers / users"
                  onClick={() => setManaging(r)}
                >
                  <UserCog size={16} />
                </button>
                <button
                  className="btn-ghost p-2"
                  title="Edit"
                  onClick={() => setEditing(r)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="btn-ghost p-2 text-red-600"
                  title="Delete"
                  onClick={() => setDeleting(r)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <RouteFormModal
          initial={blankForm()}
          onClose={() => setCreating(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['routes'] });
            setCreating(false);
          }}
        />
      )}
      {editing && (
        <RouteFormModal
          initial={toFormValue(editing)}
          editingId={editing._id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['routes'] });
            setEditing(null);
          }}
        />
      )}
      {managing && (
        <ManageRouteModal
          route={managing}
          onClose={() => setManaging(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ['routes'] })}
        />
      )}
      {deleting && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteMut.mutate(deleting._id)}
          title="Delete route?"
          message={`This will permanently remove "${deleting.name}".`}
          confirmText="Delete"
          variant="danger"
        />
      )}
    </div>
  );
}

function toFormValue(r: any): RouteForm {
  return {
    name: r.name || '',
    description: r.description || '',
    type: r.type,
    isActive: !!r.isActive,
    corridorBufferMeters: r.corridorBufferMeters ?? 1500,
    stops:
      Array.isArray(r.stops) && r.stops.length >= 2
        ? r.stops.map((s: any, i: number) => ({
            name: s.name || '',
            address: s.address || '',
            lat: Number(s.lat) || 0,
            lng: Number(s.lng) || 0,
            sequence: typeof s.sequence === 'number' ? s.sequence : i,
            fareFromPrevious:
              i === 0 ? 0 : Number(s.fareFromPrevious) || 0,
            // Without this the saved PIN was correctly persisted but never
            // re-hydrated into the edit form — the field appeared empty
            // and a save would overwrite it back to undefined.
            pincode: s.pincode ? String(s.pincode) : undefined,
          }))
        : [emptyStop(0), emptyStop(1)],
    schedule: {
      // Legacy routes could carry an empty daysOfWeek, which downstream code
      // inverted to "runs every day" — hydrate that as all 7 selected so the
      // form shows the effective behaviour and saves it explicitly.
      daysOfWeek:
        Array.isArray(r.schedule?.daysOfWeek) && r.schedule.daysOfWeek.length > 0
          ? r.schedule.daysOfWeek
          : [...ALL_DAYS],
      departures: r.schedule?.departures ?? [],
      returnDepartures: r.schedule?.returnDepartures ?? [],
      seatPrice: r.schedule?.seatPrice ?? 0,
      vehicleType: r.schedule?.vehicleType ?? '',
      totalSeats: r.schedule?.totalSeats ?? 0,
      // Timing overrides round-trip into the form; absent stays absent so an
      // untouched save doesn't pin the current platform default onto the route.
      bookingCutoffMinutes:
        typeof r.schedule?.bookingCutoffMinutes === 'number'
          ? r.schedule.bookingCutoffMinutes
          : undefined,
      maxAdvanceBookingDays:
        typeof r.schedule?.maxAdvanceBookingDays === 'number'
          ? r.schedule.maxAdvanceBookingDays
          : undefined,
      startWindowMinutes:
        typeof r.schedule?.startWindowMinutes === 'number'
          ? r.schedule.startWindowMinutes
          : undefined,
      minRestMinutes:
        typeof r.schedule?.minRestMinutes === 'number'
          ? r.schedule.minRestMinutes
          : undefined,
      cancellationCutoffMinutes:
        typeof r.schedule?.cancellationCutoffMinutes === 'number'
          ? r.schedule.cancellationCutoffMinutes
          : undefined,
    },
  };
}

// ════════════════════════════════════════════════════════════════════
// FORM MODAL
// ════════════════════════════════════════════════════════════════════

function RouteFormModal({
  initial,
  editingId,
  onClose,
  onSaved,
}: {
  initial: RouteForm;
  editingId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RouteForm>(initial);
  const [errors, setErrors] = useState<{
    name?: string;
    stops?: string;
    stopFields?: Record<number, string>;
    schedule?: string;
    departures?: string;
    days?: string;
    timing?: Partial<Record<ScheduleTimingKey, string>>;
  }>({});
  const isScheduled = form.type === 'scheduled';

  /** Mirror backend Route schema validation (see ukcaar-backend/src/models/Route.ts). */
  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Name is required';

    if (!Array.isArray(form.stops) || form.stops.length < 2) {
      next.stops = 'A route must have at least two stops';
    } else {
      const stopFields: Record<number, string> = {};
      form.stops.forEach((s, i) => {
        if (!s.name?.trim()) {
          stopFields[i] = 'Stop name is required';
        } else if (
          !Number.isFinite(Number(s.lat)) ||
          !Number.isFinite(Number(s.lng)) ||
          (Number(s.lat) === 0 && Number(s.lng) === 0)
        ) {
          stopFields[i] = 'Pick a place from the suggestions (location required)';
        } else if (Number(s.lat) < -90 || Number(s.lat) > 90 || Number(s.lng) < -180 || Number(s.lng) > 180) {
          stopFields[i] = 'Coordinates out of range';
        }
      });
      if (Object.keys(stopFields).length) next.stopFields = stopFields;
    }

    if (isScheduled) {
      if ((Number(form.schedule?.totalSeats) || 0) < 1) {
        next.schedule = 'Total seats must be at least 1';
      }
      if ((form.schedule?.daysOfWeek ?? []).length === 0) {
        next.days = 'A scheduled route must run on at least one day of the week';
      }
      const deps = form.schedule?.departures ?? [];
      if (deps.length === 0) {
        next.departures = 'Add at least one departure for a scheduled route';
      } else {
        const bad = deps.find(
          (d) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time || '')
        );
        if (bad) next.departures = 'Each departure needs a valid HH:MM time';
      }
      const timing: Partial<Record<ScheduleTimingKey, string>> = {};
      for (const tf of TIMING_FIELDS) {
        const v = form.schedule?.[tf.key];
        if (v === undefined) continue; // empty box = platform default
        if (!Number.isInteger(v) || v < tf.min || v > tf.max) {
          timing[tf.key] = `Enter a whole number between ${tf.min} and ${tf.max}, or leave empty for the default`;
        }
      }
      if (Object.keys(timing).length) next.timing = timing;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        type: form.type,
        isActive: form.isActive,
        corridorBufferMeters: Number(form.corridorBufferMeters) || 0,
        stops: form.stops.map((s, i) => ({
          name: s.name.trim(),
          address: s.address?.trim() || undefined,
          lat: Number(s.lat),
          lng: Number(s.lng),
          sequence: i,
          fareFromPrevious: i === 0 ? 0 : Number(s.fareFromPrevious) || 0,
          pincode: s.pincode?.trim() || undefined,
        })),
      };
      if (isScheduled) {
        payload.schedule = {
          daysOfWeek: form.schedule?.daysOfWeek ?? [],
          departures: (form.schedule?.departures ?? []).map((d) => ({
            stopIndex: Number(d.stopIndex),
            time: d.time,
          })),
          returnDepartures: (form.schedule?.returnDepartures ?? []).map((d) => ({
            stopIndex: Number(d.stopIndex),
            time: d.time,
          })),
          seatPrice: Number(form.schedule?.seatPrice) || 0,
          vehicleType: form.schedule?.vehicleType?.trim() || undefined,
          totalSeats: Number(form.schedule?.totalSeats) || 0,
        };
        // Timing overrides: only send fields the admin actually filled in.
        // An empty box must NOT become 0 — omitting the key keeps the route
        // on the platform default.
        for (const tf of TIMING_FIELDS) {
          const v = form.schedule?.[tf.key];
          if (typeof v === 'number' && Number.isFinite(v)) {
            payload.schedule[tf.key] = v;
          }
        }
      }
      return editingId
        ? routesAPI.update(editingId, payload)
        : routesAPI.create(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? 'Route updated' : 'Route created');
      onSaved();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Save failed'),
  });

  const updateStop = (idx: number, patch: Partial<Stop>) => {
    setForm((f) => ({
      ...f,
      stops: f.stops.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const removeStop = (idx: number) => {
    setForm((f) => ({
      ...f,
      stops: f.stops.length <= 2 ? f.stops : f.stops.filter((_, i) => i !== idx),
    }));
  };

  const addStop = () =>
    setForm((f) => ({ ...f, stops: [...f.stops, emptyStop(f.stops.length)] }));

  const toggleDay = (d: number) => {
    const current = form.schedule?.daysOfWeek ?? [];
    // A scheduled route must keep at least one running day — deselecting the
    // last one would (via a legacy quirk) flip the route to "runs every day".
    if (current.includes(d) && current.length === 1) {
      setErrors((p) => ({
        ...p,
        days: 'A scheduled route must run on at least one day of the week',
      }));
      return;
    }
    setForm((f) => {
      const days = f.schedule?.daysOfWeek ?? [];
      return {
        ...f,
        schedule: {
          ...(f.schedule ?? { daysOfWeek: [], departures: [], returnDepartures: [] }),
          daysOfWeek: days.includes(d)
            ? days.filter((x) => x !== d)
            : [...days, d].sort(),
        },
      };
    });
    if (errors.days) setErrors((p) => ({ ...p, days: undefined }));
  };

  const addDeparture = () =>
    setForm((f) => ({
      ...f,
      schedule: {
        ...(f.schedule ?? { daysOfWeek: [], departures: [], returnDepartures: [] }),
        departures: [
          ...(f.schedule?.departures ?? []),
          { stopIndex: 0, time: '09:00' },
        ],
      },
    }));

  const updateDeparture = (idx: number, patch: Partial<Departure>) =>
    setForm((f) => ({
      ...f,
      schedule: {
        ...(f.schedule ?? { daysOfWeek: [], departures: [], returnDepartures: [] }),
        departures: (f.schedule?.departures ?? []).map((d, i) =>
          i === idx ? { ...d, ...patch } : d
        ),
      },
    }));

  const removeDeparture = (idx: number) =>
    setForm((f) => ({
      ...f,
      schedule: {
        ...(f.schedule ?? { daysOfWeek: [], departures: [], returnDepartures: [] }),
        departures: (f.schedule?.departures ?? []).filter((_, i) => i !== idx),
      },
    }));

  const addReturnDeparture = () =>
    setForm((f) => ({
      ...f,
      schedule: {
        ...(f.schedule ?? { daysOfWeek: [], departures: [], returnDepartures: [] }),
        returnDepartures: [
          ...(f.schedule?.returnDepartures ?? []),
          { stopIndex: 0, time: '17:00' },
        ],
      },
    }));

  const updateReturnDeparture = (idx: number, patch: Partial<Departure>) =>
    setForm((f) => ({
      ...f,
      schedule: {
        ...(f.schedule ?? { daysOfWeek: [], departures: [], returnDepartures: [] }),
        returnDepartures: (f.schedule?.returnDepartures ?? []).map((d, i) =>
          i === idx ? { ...d, ...patch } : d
        ),
      },
    }));

  const removeReturnDeparture = (idx: number) =>
    setForm((f) => ({
      ...f,
      schedule: {
        ...(f.schedule ?? { daysOfWeek: [], departures: [], returnDepartures: [] }),
        returnDepartures: (f.schedule?.returnDepartures ?? []).filter((_, i) => i !== idx),
      },
    }));

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={editingId ? 'Edit route' : 'New route'}
      size="lg"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Basics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              className={`input ${errors.name ? 'input-error' : ''}`}
              required
              aria-invalid={!!errors.name}
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
              }}
            />
            {errors.name && (
              <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-600">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              className="input"
              required
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as RouteType }))
              }
            >
              {/* 'private' routes are consumed by no runtime flow (private
                  rides dispatch by vehicle-type tier, not routes), so the
                  option is hidden for new routes. It still renders when
                  editing a legacy private route so saving doesn't silently
                  flip its type. */}
              {form.type === 'private' && (
                <option value="private">Private (legacy, unused by live flows)</option>
              )}
              <option value="scheduled">Scheduled (shuttle, fixed seats &amp; times)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Description</label>
            <textarea
              className="input"
              rows={2}
              value={form.description ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Corridor buffer (m)</label>
            <input
              type="number"
              min={0}
              max={50000}
              className="input"
              value={form.corridorBufferMeters}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  corridorBufferMeters: Number(e.target.value),
                }))
              }
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Pickup/drop locations within this distance of any stop count as
              "on this route".
            </p>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
              />
              Active
            </label>
          </div>
        </div>

        {/* Stops */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">
              Stops (in order) <span className="text-red-500">*</span>
            </h4>
            <button className="btn-ghost text-xs" onClick={addStop}>
              + Add stop
            </button>
          </div>
          {errors.stops && (
            <p className="text-[11px] text-red-600 mb-2">{errors.stops}</p>
          )}
          <div className="space-y-2">
            {form.stops.map((s, i) => (
              <div
                key={i}
                className="bg-gray-50 p-3 rounded-lg border border-gray-200"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold inline-flex items-center justify-center mt-1">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <PlaceSearchInput
                      value={
                        s.lat || s.lng || s.name
                          ? {
                              name: s.name,
                              address: s.address ?? '',
                              lat: s.lat,
                              lng: s.lng,
                              pincode: s.pincode,
                            }
                          : null
                      }
                      onChange={(v) =>
                        updateStop(i, {
                          name: v?.name ?? '',
                          address: v?.address ?? '',
                          lat: v?.lat ?? 0,
                          lng: v?.lng ?? 0,
                          // Picker captures it; admin can override below.
                          pincode: v?.pincode,
                        })
                      }
                      placeholder={`Search stop #${i + 1}…`}
                    />
                    <div className="mt-2">
                      <label className="text-[11px] text-gray-500 block mb-0.5">
                        Pincode{' '}
                        <span className="text-gray-400">
                          (auto-filled from search; required for rider PIN match)
                        </span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        className="input max-w-[180px]"
                        placeholder="e.g. 207123"
                        value={s.pincode ?? ''}
                        onChange={(e) =>
                          updateStop(i, {
                            pincode: e.target.value.replace(/\D/g, '') || undefined,
                          })
                        }
                      />
                    </div>
                    {errors.stopFields?.[i] && (
                      <p className="text-[11px] text-red-600 mt-1">
                        {errors.stopFields[i]}
                      </p>
                    )}
                    <div className="mt-2">
                      <label className="text-[11px] text-gray-500 block mb-0.5">
                        {i === 0
                          ? 'First stop — no inbound fare'
                          : 'Fare from previous stop (₹)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="input max-w-[180px]"
                        placeholder={i === 0 ? '0.00' : '0.00'}
                        value={i === 0 ? 0 : s.fareFromPrevious}
                        disabled={i === 0}
                        onChange={(e) =>
                          updateStop(i, {
                            fareFromPrevious: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <button
                    className="shrink-0 inline-flex items-center justify-center h-9 w-9 text-red-600 hover:bg-red-50 rounded disabled:text-gray-300 disabled:hover:bg-transparent"
                    onClick={() => removeStop(i)}
                    disabled={form.stops.length <= 2}
                    title={
                      form.stops.length <= 2
                        ? 'A route needs at least 2 stops'
                        : 'Remove'
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Per-segment fare (₹): customers booking from stop&nbsp;A → stop&nbsp;B
            pay the sum of <em>fare-from-previous</em> for every stop after A
            up to and including B. End-to-end fare is the sum of all segments.
          </p>
        </div>

        {/* Scheduled-only fields */}
        {isScheduled && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Schedule</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-600">Seat price (₹) (fallback)</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={form.schedule?.seatPrice ?? 0}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      schedule: {
                        ...(f.schedule ?? { daysOfWeek: [], departures: [], returnDepartures: [] }),
                        seatPrice: Number(e.target.value),
                      },
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Total seats</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={form.schedule?.totalSeats ?? 0}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      schedule: {
                        ...(f.schedule ?? { daysOfWeek: [], departures: [], returnDepartures: [] }),
                        totalSeats: Number(e.target.value),
                      },
                    }))
                  }
                />
                {errors.schedule && (
                  <p className="text-[11px] text-red-600 mt-1">{errors.schedule}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-600">Vehicle type</label>
                <input
                  className="input"
                  placeholder="e.g. minibus, sedan…"
                  value={form.schedule?.vehicleType ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      schedule: {
                        ...(f.schedule ?? { daysOfWeek: [], departures: [], returnDepartures: [] }),
                        vehicleType: e.target.value,
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-gray-600 block mb-1">
                Days of week
              </label>
              <div className="flex gap-1 flex-wrap">
                {DAY_LABELS.map((d, i) => {
                  const on = form.schedule?.daysOfWeek?.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`px-2.5 py-1 text-xs rounded border ${
                        on
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              {errors.days && (
                <p className="text-[11px] text-red-600 mt-1">{errors.days}</p>
              )}
            </div>

            <div className="mt-3">
              <label className="text-xs text-gray-600 block mb-1">
                Timing rules
              </label>
              <p className="text-[11px] text-gray-500 mb-2">
                All times are IST. Leave a field empty to use the platform
                default.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {TIMING_FIELDS.map((tf) => (
                  <div key={tf.key}>
                    <label className="text-xs text-gray-600">{tf.label}</label>
                    <input
                      type="number"
                      min={tf.min}
                      max={tf.max}
                      step={1}
                      className={`input ${errors.timing?.[tf.key] ? 'input-error' : ''}`}
                      placeholder={`Default: ${tf.defaultValue}`}
                      aria-invalid={!!errors.timing?.[tf.key]}
                      value={form.schedule?.[tf.key] ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setForm((f) => ({
                          ...f,
                          schedule: {
                            ...(f.schedule ?? {
                              daysOfWeek: [],
                              departures: [],
                              returnDepartures: [],
                            }),
                            [tf.key]: raw === '' ? undefined : Number(raw),
                          },
                        }));
                        if (errors.timing?.[tf.key])
                          setErrors((p) => ({
                            ...p,
                            timing: { ...p.timing, [tf.key]: undefined },
                          }));
                      }}
                    />
                    <p className="text-[11px] text-gray-500 mt-1">{tf.hint}</p>
                    {errors.timing?.[tf.key] && (
                      <p className="text-[11px] text-red-600 mt-1">
                        {errors.timing[tf.key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-600">Departures</label>
                <button className="btn-ghost text-xs" onClick={addDeparture}>
                  + Add departure
                </button>
              </div>
              <div className="space-y-2">
                {(form.schedule?.departures ?? []).map((d, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded"
                  >
                    <select
                      className="input col-span-7"
                      value={d.stopIndex}
                      onChange={(e) =>
                        updateDeparture(i, {
                          stopIndex: Number(e.target.value),
                        })
                      }
                    >
                      {form.stops.map((s, si) => (
                        <option key={si} value={si}>
                          #{si + 1} {s.name || '(unnamed)'}
                        </option>
                      ))}
                    </select>
                    <div className="col-span-4 flex items-center gap-1.5">
                      <input
                        type="time"
                        className="input flex-1 min-w-0"
                        value={d.time}
                        onChange={(e) =>
                          updateDeparture(i, { time: e.target.value })
                        }
                      />
                      <span className="text-[11px] text-gray-500 shrink-0">
                        IST
                      </span>
                    </div>
                    <button
                      className="col-span-1 text-red-600"
                      onClick={() => removeDeparture(i)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {(form.schedule?.departures ?? []).length === 0 && (
                  <div className="text-xs text-gray-500">
                    No departures yet.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-600">Return departures (optional)</label>
                <button className="btn-ghost text-xs" onClick={addReturnDeparture}>
                  + Add return departure
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mb-2">
                Leave empty if this route doesn't run a return leg. Drivers who
                opt into round-trip on their registration will offer these
                times to customers.
              </p>
              <div className="space-y-2">
                {(form.schedule?.returnDepartures ?? []).map((d, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded"
                  >
                    <select
                      className="input col-span-7"
                      value={d.stopIndex}
                      onChange={(e) =>
                        updateReturnDeparture(i, {
                          stopIndex: Number(e.target.value),
                        })
                      }
                    >
                      {form.stops.map((s, si) => (
                        <option key={si} value={si}>
                          #{si + 1} {s.name || '(unnamed)'}
                        </option>
                      ))}
                    </select>
                    <div className="col-span-4 flex items-center gap-1.5">
                      <input
                        type="time"
                        className="input flex-1 min-w-0"
                        value={d.time}
                        onChange={(e) =>
                          updateReturnDeparture(i, { time: e.target.value })
                        }
                      />
                      <span className="text-[11px] text-gray-500 shrink-0">
                        IST
                      </span>
                    </div>
                    <button
                      className="col-span-1 text-red-600"
                      onClick={() => removeReturnDeparture(i)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {(form.schedule?.returnDepartures ?? []).length === 0 && (
                  <div className="text-xs text-gray-500">
                    No return departures.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {errors.departures && (
          <p className="text-[11px] text-red-600">{errors.departures}</p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={saveMut.isPending}
            onClick={() => {
              if (!validate()) {
                toast.error('Please fix the highlighted fields');
                return;
              }
              saveMut.mutate();
            }}
          >
            {saveMut.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Create route'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// MANAGE DRIVERS / USERS MODAL
// ════════════════════════════════════════════════════════════════════

function ManageRouteModal({
  route,
  onClose,
  onChanged,
}: {
  route: any;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'drivers' | 'users'>('drivers');
  const [assignUser, setAssignUser] = useState<AdminUserLite | null>(null);

  // Driver picker — search the global driver pool to assign someone to this
  // route. Debounced so we don't fire a request on every keystroke.
  const [driverSearch, setDriverSearch] = useState('');
  const [driverSearchDebounced, setDriverSearchDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDriverSearchDebounced(driverSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [driverSearch]);

  const { data: full, isLoading } = useQuery({
    queryKey: ['route', route._id],
    queryFn: async () => (await routesAPI.get(route._id)).data?.data?.route,
  });

  const { data: driverSearchData, isFetching: driverSearchLoading } = useQuery({
    queryKey: ['route-driver-search', route._id, driverSearchDebounced],
    queryFn: async () =>
      (await driversAPI.getAll({ search: driverSearchDebounced, limit: 10 })).data?.data,
    enabled: tab === 'drivers' && driverSearchDebounced.length > 0,
    placeholderData: keepPreviousData,
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['route', route._id] });
    onChanged();
  };

  const driverMut = useMutation({
    mutationFn: ({
      driverId,
      status,
    }: {
      driverId: string;
      status: string;
    }) => routesAPI.updateDriver(route._id, driverId, { status }),
    onSuccess: () => {
      toast.success('Updated');
      refetchAll();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const removeDriverMut = useMutation({
    mutationFn: (driverId: string) =>
      routesAPI.removeDriver(route._id, driverId),
    onSuccess: () => {
      toast.success('Driver removed');
      refetchAll();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Remove failed'),
  });

  const assignDriverMut = useMutation({
    mutationFn: (driverId: string) => routesAPI.addDriver(route._id, driverId),
    onSuccess: () => {
      toast.success('Driver assigned to route');
      setDriverSearch('');
      setDriverSearchDebounced('');
      refetchAll();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Assign failed'),
  });

  const assignMut = useMutation({
    mutationFn: (uid: string) => routesAPI.assignUser(route._id, uid),
    onSuccess: () => {
      toast.success('User assigned');
      setAssignUser(null);
      refetchAll();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Assign failed'),
  });

  const unassignMut = useMutation({
    mutationFn: (uid: string) => routesAPI.unassignUser(route._id, uid),
    onSuccess: () => {
      toast.success('Removed');
      refetchAll();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed'),
  });

  const drivers = full?.registeredDrivers ?? [];
  const users = full?.assignedUsers ?? [];
  const showUsersTab = (full?.type ?? route.type) === 'private';

  // Drivers already on this route — used to disable them in the picker so
  // the admin can't add a duplicate (they still show up, just greyed out).
  const registeredDriverIds = useMemo(
    () =>
      new Set(
        drivers.map((d: any) => String(d.driver?._id || d.driver)),
      ),
    [drivers],
  );
  const driverResults: any[] = driverSearchData?.drivers ?? [];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Manage — ${route.name}`}
      size="lg"
    >
      <div className="flex gap-2 border-b mb-4">
        <button
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            tab === 'drivers'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-gray-500'
          }`}
          onClick={() => setTab('drivers')}
        >
          <span className="inline-flex items-center gap-1">
            <UserCog size={14} /> Drivers
          </span>
        </button>
        {showUsersTab && (
          <button
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              tab === 'users'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500'
            }`}
            onClick={() => setTab('users')}
          >
            <span className="inline-flex items-center gap-1">
              <Users size={14} /> Assigned users
            </span>
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : tab === 'drivers' ? (
        <div className="space-y-4">
          {/* Assign a driver — search the global driver pool. Drivers already
              on this route appear but are disabled so they can't be added
              twice; manage them in the list below instead. */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Assign a driver
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9 w-full"
                placeholder="Search drivers by name or phone…"
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
              />
            </div>
            {driverSearchDebounced.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {driverSearchLoading && driverResults.length === 0 ? (
                  <div className="p-4 text-center">
                    <LoadingSpinner />
                  </div>
                ) : driverResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No drivers match "{driverSearchDebounced}".
                  </div>
                ) : (
                  driverResults.map((d: any) => {
                    const alreadyOnRoute = registeredDriverIds.has(String(d._id));
                    const fullName =
                      d.firstName || d.lastName
                        ? `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim()
                        : 'Driver';
                    return (
                      <div
                        key={d._id}
                        className="flex items-center justify-between gap-3 p-2.5"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {fullName}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {d.phone || d.email || ''}
                            {d.driverProfile?.plateNumber
                              ? `  •  ${d.driverProfile.plateNumber}`
                              : ''}
                          </div>
                        </div>
                        {alreadyOnRoute ? (
                          <span className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-400 px-2 py-1">
                            <Check size={13} /> On route
                          </span>
                        ) : (
                          <button
                            className="btn-primary text-xs inline-flex items-center gap-1 shrink-0 px-3 py-1.5"
                            disabled={assignDriverMut.isPending}
                            onClick={() => assignDriverMut.mutate(String(d._id))}
                          >
                            <UserPlus size={13} /> Assign
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">
              On this route ({drivers.length})
            </h4>
            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
          {drivers.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-6">
              No drivers have registered for this route yet.
            </div>
          )}
          {drivers.map((d: any) => {
            const drv = d.driver || {};
            const driverId = drv._id || d.driver;
            return (
              <div
                key={driverId}
                className="border rounded p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {drv.firstName || drv.lastName
                      ? `${drv.firstName ?? ''} ${drv.lastName ?? ''}`.trim()
                      : 'Driver'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {drv.phone || drv.email || ''}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Status:{' '}
                    <span className="font-medium text-gray-700">{d.status}</span>
                    {d.note ? `  •  ${d.note}` : ''}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {d.status !== 'approved' && (
                    <button
                      className="btn-ghost text-xs text-green-700"
                      onClick={() =>
                        driverMut.mutate({ driverId, status: 'approved' })
                      }
                    >
                      Approve
                    </button>
                  )}
                  {d.status !== 'rejected' && (
                    <button
                      className="btn-ghost text-xs text-amber-700"
                      onClick={() =>
                        driverMut.mutate({ driverId, status: 'rejected' })
                      }
                    >
                      Reject
                    </button>
                  )}
                  <button
                    className="btn-ghost text-xs text-red-600"
                    onClick={() => removeDriverMut.mutate(driverId)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <UserSearchSelect
            label="Assign rider"
            roles={['customer']}
            value={assignUser}
            onChange={setAssignUser}
          />
          <button
            className="btn-primary w-full"
            disabled={!assignUser || assignMut.isPending}
            onClick={() => assignUser && assignMut.mutate(assignUser._id)}
          >
            Assign to route
          </button>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {users.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-6">
                No users assigned yet.
              </div>
            )}
            {users.map((u: any) => {
              const id = u._id || u;
              return (
                <div
                  key={id}
                  className="border rounded p-2 flex items-center justify-between"
                >
                  <div className="text-sm">
                    {u.firstName || u.lastName
                      ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
                      : 'User'}
                    <span className="text-xs text-gray-500 ml-2">
                      {u.phone || u.email || ''}
                    </span>
                  </div>
                  <button
                    className="btn-ghost text-xs text-red-600"
                    onClick={() => unassignMut.mutate(id)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
