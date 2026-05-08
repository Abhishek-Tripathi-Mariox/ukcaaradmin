import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Car, Fuel } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  vehicleTypesAPI,
  fuelTypesAPI,
  CatalogueType,
} from '@/services/api';
import { Modal, ConfirmModal } from '@/components/Modal';
import { PageHeader, LoadingSpinner } from '@/components/common';

type Tab = 'vehicle' | 'fuel';

export default function VehicleTypesPage() {
  const [tab, setTab] = useState<Tab>('vehicle');

  return (
    <div>
      <PageHeader
        title="Vehicle & Fuel Types"
        subtitle="Manage the dropdown options drivers see during registration"
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
  api: typeof vehicleTypesAPI;
  singularLabel: string;
}

function CataloguePanel({ queryKey, api, singularLabel }: CataloguePanelProps) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CatalogueType | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CatalogueType | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () =>
      (await api.list()).data?.data?.types as CatalogueType[] | undefined,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${singularLabel} deleted`);
      setDeleting(null);
    },
    onError: () => toast.error(`Failed to delete ${singularLabel}`),
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
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((row) => (
                <tr key={row._id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                  <td className="px-3 py-2 text-gray-500">
                    <code className="text-xs">{row.code}</code>
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {row.description || '—'}
                  </td>
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
                      onClick={() => setDeleting(row)}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
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

      {deleting && (
        <ConfirmModal
          isOpen
          title={`Delete ${singularLabel}?`}
          message={`"${deleting.name}" will no longer appear in driver registration. Existing drivers who selected it keep their record.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={() => remove.mutate(deleting._id)}
          onClose={() => setDeleting(null)}
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
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      // Empty code → backend will auto-slugify from name
      code: code.trim() || undefined,
      description: description.trim() || undefined,
      sortOrder,
      isActive,
    } as Partial<CatalogueType>);
  };

  return (
    <Modal
      isOpen
      title={initial ? `Edit ${singularLabel}` : `New ${singularLabel}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
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
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
