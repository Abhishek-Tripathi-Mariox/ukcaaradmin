import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Car, Fuel, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  vehicleTypesAPI,
  fuelTypesAPI,
  CatalogueType,
} from '@/services/api';
import { Modal } from '@/components/Modal';
import { PageHeader, LoadingSpinner, RefreshButton } from '@/components/common';

type Tab = 'vehicle' | 'fuel';

export default function VehicleTypesPage() {
  const qcMain = useQueryClient();
  const [tab, setTab] = useState<Tab>('vehicle');

  const handleRefresh = () => {
    qcMain.refetchQueries({ queryKey: ['admin-vehicle-types'] });
    qcMain.refetchQueries({ queryKey: ['admin-fuel-types'] });
  };

  return (
    <div>
      <PageHeader
        title="Vehicle & Fuel Types"
        subtitle="Manage the dropdown options drivers see during registration"
        actions={<RefreshButton onRefresh={handleRefresh} />}
      />

      <div className="border-b mb-4 flex gap-1">
        <TabButton
          icon={<Car className="w-4 h-4" />}
          label="Vehicle types"
          active={tab === 'vehicle'}
          onClick={() => setTab('vehicle')}
        />
        <TabButton
          icon={<Fuel className="w-4 h-4" />}
          label="Fuel types"
          active={tab === 'fuel'}
          onClick={() => setTab('fuel')}
        />
      </div>

      {tab === 'vehicle' ? (
        <CataloguePanel
          queryKey="admin-vehicle-types"
          api={vehicleTypesAPI}
          singularLabel="vehicle type"
        />
      ) : (
        <CataloguePanel
          queryKey="admin-fuel-types"
          api={fuelTypesAPI}
          singularLabel="fuel type"
        />
      )}
    </div>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-brand-teal text-brand-teal'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

interface CataloguePanelProps {
  queryKey: string;
  // Typed against the fuel API: the two catalogues share list/create/update/
  // remove, and only vehicle types carry uploadIcon (called directly in the
  // modal, not through this prop).
  api: typeof fuelTypesAPI;
  singularLabel: string;
}

function CataloguePanel({ queryKey, api, singularLabel }: CataloguePanelProps) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CatalogueType | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () =>
      (await api.list()).data?.data?.types as CatalogueType[] | undefined,
  });

  const toggleStatus = useMutation({
    mutationFn: async (row: CatalogueType) => {
      return api.update(row._id, { isActive: !row.isActive });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setCreating(true)}
          className="btn btn-primary whitespace-nowrap"
        >
          <Plus className="w-4 h-4 mr-1" /> New {singularLabel}
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.length ? (
        <div className="bg-white border rounded-lg p-10 text-center">
          <p className="text-sm text-gray-500">
            No {singularLabel}s yet. Create one to populate the driver registration form.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                {singularLabel === 'vehicle type' && (
                  <th className="px-3 py-2 text-left">Icon</th>
                )}
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Description</th>
                {singularLabel === 'vehicle type' && (
                  <th className="px-3 py-2">Tier</th>
                )}
                {singularLabel === 'vehicle type' && (
                  <th className="px-3 py-2 text-left">Fare</th>
                )}
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((row) => (
                <tr key={row._id}>
                  {singularLabel === 'vehicle type' && (
                    <td className="px-3 py-2">
                      <div className="w-9 h-9 rounded border bg-gray-50 flex items-center justify-center overflow-hidden">
                        {row.iconUrl ? (
                          <img
                            src={row.iconUrl}
                            alt=""
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-gray-400">app</span>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                  <td className="px-3 py-2 text-gray-500">
                    <code className="text-xs">{row.code}</code>
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {row.description || '—'}
                  </td>
                  {singularLabel === 'vehicle type' && (
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          row.tier === 'private'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {row.tier ?? 'instant'}
                      </span>
                    </td>
                  )}
                  {singularLabel === 'vehicle type' && (
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {(() => {
                        const parts = [
                          row.baseFare != null ? `₹${row.baseFare} base` : null,
                          row.perKmFare != null ? `₹${row.perKmFare}/km` : null,
                          row.perMinFare != null ? `₹${row.perMinFare}/min` : null,
                          row.minFare != null ? `₹${row.minFare} min` : null,
                        ].filter(Boolean);
                        return parts.length ? (
                          <span>{parts.join(' · ')}</span>
                        ) : (
                          <span className="text-gray-400">Default</span>
                        );
                      })()}
                    </td>
                  )}
                  <td className="px-3 py-2 text-center text-gray-500">
                    {row.sortOrder}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        row.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {row.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing(row)}
                      className="text-gray-400 hover:text-brand-teal p-1"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleStatus.mutate(row)}
                      className="p-1 ml-2"
                      title={row.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {row.isActive ? (
                        <ToggleRight className="w-5 h-5 text-green-600 inline" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400 inline" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(editing || creating) && (
        <EditModal
          initial={editing ?? undefined}
          singularLabel={singularLabel}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={async (payload) => {
            try {
              if (editing) {
                await api.update(editing._id, payload);
                toast.success(`${singularLabel} updated`);
              } else {
                await api.create(payload);
                toast.success(`${singularLabel} created`);
              }
              qc.invalidateQueries({ queryKey: [queryKey] });
              setEditing(null);
              setCreating(false);
            } catch (err: any) {
              toast.error(
                err?.response?.data?.message ?? `Failed to save ${singularLabel}`,
              );
            }
          }}
        />
      )}

    </>
  );
}

interface EditModalProps {
  initial?: CatalogueType;
  singularLabel: string;
  onClose: () => void;
  onSave: (payload: Partial<CatalogueType>) => void | Promise<void>;
}

function EditModal({ initial, singularLabel, onClose, onSave }: EditModalProps) {
  // The same modal is reused for fuel types — they don't have a tier so we
  // only show the dropdown for the vehicle-type variant.
  const isVehicleType = singularLabel === 'vehicle type';
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [tier, setTier] = useState<'instant' | 'private'>(
    initial?.tier ?? 'instant',
  );
  // Pricing fields — vehicle-type only. We track each as a string so the
  // input can hold a blank state (= "not configured, use fallback"); the
  // submit handler parses to number or leaves undefined.
  const fmt = (v: number | null | undefined) => (v === undefined || v === null ? '' : String(v));
  const [baseFare, setBaseFare] = useState(fmt(initial?.baseFare));
  const [perKmFare, setPerKmFare] = useState(fmt(initial?.perKmFare));
  const [perMinFare, setPerMinFare] = useState(fmt(initial?.perMinFare));
  const [minFare, setMinFare] = useState(fmt(initial?.minFare));
  // Artwork for the customer ride picker. Empty = use the app's bundled art.
  const [iconUrl, setIconUrl] = useState<string>(initial?.iconUrl ?? '');
  const [iconUploading, setIconUploading] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);

  const pickIcon = async (file?: File | null) => {
    if (!file) return;
    setIconError(null);
    setIconUploading(true);
    try {
      const res = await vehicleTypesAPI.uploadIcon(file);
      const url = res.data?.data?.url ?? res.data?.url;
      if (!url) throw new Error('Upload did not return a URL');
      setIconUrl(url);
    } catch (err: any) {
      setIconError(
        err?.response?.data?.message ?? err?.message ?? 'Could not upload the image.',
      );
    } finally {
      setIconUploading(false);
    }
  };

  // Blank → null: the backend unsets the field on null, so a set fare
  // (or description) can actually be cleared. undefined would be JSON-dropped.
  const parseFare = (v: string): number | null => {
    const t = v.trim();
    if (!t) return null;
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Saving mid-upload dropped the new icon (the URL arrived after save).
    if (!name.trim() || iconUploading) return;
    onSave({
      name: name.trim(),
      // Empty code → backend will auto-slugify from name
      code: code.trim() || undefined,
      description: description.trim() || null,
      sortOrder,
      isActive,
      ...(isVehicleType
        ? {
            tier,
            baseFare: parseFare(baseFare),
            perKmFare: parseFare(perKmFare),
            perMinFare: parseFare(perMinFare),
            minFare: parseFare(minFare),
            // null clears it on the backend, so the app reverts to its art.
            iconUrl: iconUrl.trim() || null,
          }
        : {}),
    } as Partial<CatalogueType>);
  };

  return (
    <Modal
      isOpen
      title={initial ? `Edit ${singularLabel}` : `New ${singularLabel}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {isVehicleType && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Icon <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                {iconUrl ? (
                  <img src={iconUrl} alt="" className="max-w-full max-h-full object-contain" />
                ) : (
                  <Car className="w-6 h-6 text-gray-300" />
                )}
              </div>
              <div className="min-w-0">
                <input
                  id="vehicle-type-icon"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={iconUploading}
                  onChange={(e) => {
                    pickIcon(e.target.files?.[0]);
                    // Clear it so picking the same file again still fires.
                    e.currentTarget.value = '';
                  }}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {iconUploading
                    ? 'Uploading…'
                    : iconError
                    ? iconError
                    : 'PNG or WebP on a transparent background, about 200×200. Leave empty to use the app’s built-in artwork.'}
                </p>
              </div>
              {iconUrl && !iconUploading && (
                <button
                  type="button"
                  onClick={() => setIconUrl('')}
                  className="text-xs text-red-600 hover:underline shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display name
          </label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sedan"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Code{' '}
            <span className="text-xs text-gray-400">
              (auto-generated from name if blank)
            </span>
          </label>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="sedan"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional helper text"
          />
        </div>
        {isVehicleType && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service tier
            </label>
            <select
              className="input"
              value={tier}
              onChange={(e) => setTier(e.target.value as 'instant' | 'private')}
            >
              <option value="instant">Instant — everyday rides (Mini, Sedan, Bike)</option>
              <option value="private">Private — premium rides (Uber Black-style)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Customers see Instant types under the "Instant" tab and Private types under the "Private" tab.
            </p>
          </div>
        )}

        {isVehicleType && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="text-sm font-medium text-amber-900 mb-1">Fare rules</div>
            <p className="text-xs text-amber-800 mb-3">
              These rates drive every ride priced as this vehicle type — the
              fare shown to the customer on Select Ride, the fare stored on
              the ride doc, and the receipt on completion. Leave any field
              blank to fall back to the default for the bucket.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Base fare (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="input"
                  value={baseFare}
                  onChange={(e) => setBaseFare(e.target.value)}
                  placeholder="e.g. 49"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Per km (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="input"
                  value={perKmFare}
                  onChange={(e) => setPerKmFare(e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Per minute (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="input"
                  value={perMinFare}
                  onChange={(e) => setPerMinFare(e.target.value)}
                  placeholder="e.g. 1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Minimum fare (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="input"
                  value={minFare}
                  onChange={(e) => setMinFare(e.target.value)}
                  placeholder="e.g. 30"
                />
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort order
            </label>
            <input
              type="number"
              className="input"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active (shown to drivers)
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={iconUploading}
            title={iconUploading ? 'Wait for the icon to finish uploading' : undefined}
          >
            {iconUploading ? 'Uploading…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
