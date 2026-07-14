import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promoAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal, ConfirmModal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, RefreshButton } from '@/components/common';
import {
  Search,
  Eye,
  Edit,
  Trash2,
  Plus,
  Tag,
  Percent,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { PromoCode } from '@/types';

export default function PromosPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedPromo, setSelectedPromo] = useState<PromoCode | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    maxUses: 100,
    maxUsesPerUser: 1,
    minRideAmount: 0,
    maxDiscount: 0,
    expiresAt: '',
    description: '',
  });
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['promos', page, search, statusFilter],
    queryFn: async () => {
      const params: any = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.isActive = statusFilter === 'active';
      const res = await promoAPI.getAll(params);
      return {
        data: res.data?.data?.promos ?? [],
        pagination: res.data?.data?.pagination ?? null,
      };
    },
  });

  // Usage breakdown (GET /admin/promos/:id/usage) — loaded when the Usage
  // modal is open for the selected promo.
  const { data: usage, isFetching: usageLoading } = useQuery({
    queryKey: ['promo-usage', selectedPromo?._id],
    queryFn: async () => {
      const res = await promoAPI.getUsage(selectedPromo!._id);
      return res.data.data as {
        summary: {
          uses: number;
          usedCount: number;
          totalDiscount: number;
          uniqueCustomers: number;
          remainingUses: number;
        };
        recent: Array<{
          _id: string;
          customer?: { firstName?: string; lastName?: string; phone?: string };
          discount: number;
          status: string;
          createdAt: string;
        }>;
      };
    },
    enabled: showUsage && !!selectedPromo?._id,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => promoAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promos'] });
      toast.success('Promo code created');
      setShowForm(false);
      resetForm();
    },
    onError: () => toast.error('Failed to create promo code'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => promoAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promos'] });
      toast.success('Promo code updated');
      setShowForm(false);
      resetForm();
    },
    onError: () => toast.error('Failed to update promo code'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => promoAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promos'] });
      toast.success('Promo code deleted');
      setShowDeleteModal(false);
    },
    onError: () => toast.error('Failed to delete promo code'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => promoAPI.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promos'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'percentage',
      value: 0,
      maxUses: 100,
      maxUsesPerUser: 1,
      minRideAmount: 0,
      maxDiscount: 0,
      expiresAt: '',
      description: '',
    });
    setIsEditing(false);
    setSelectedPromo(null);
  };

  const handleEdit = (promo: PromoCode) => {
    setSelectedPromo(promo);
    setFormData({
      code: promo.code,
      type: promo.type,
      value: promo.value,
      maxUses: promo.maxUses,
      maxUsesPerUser: promo.maxUsesPerUser,
      minRideAmount: promo.minRideAmount,
      maxDiscount: promo.maxDiscount || 0,
      expiresAt: promo.expiresAt ? format(new Date(promo.expiresAt), "yyyy-MM-dd'T'HH:mm") : '',
      description: promo.description || '',
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSubmit = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const data: any = {
      ...formData,
      minFare: Number(formData.minRideAmount) || 0,
      minRideAmount: Number(formData.minRideAmount) || 0,
      expiresAt: formData.expiresAt
        ? new Date(formData.expiresAt).toISOString()
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
    if (!data.maxDiscount) delete data.maxDiscount;
    if (!data.description) delete data.description;

    if (isEditing && selectedPromo) {
      updateMutation.mutate({ id: selectedPromo._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (promo: PromoCode) => (
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary-500" />
          <span className="font-mono font-medium">{promo.code}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (promo: PromoCode) => (
        <div className="flex items-center gap-2">
          {promo.type === 'percentage' ? (
            <Percent className="w-4 h-4 text-blue-500" />
          ) : (
            <DollarSign className="w-4 h-4 text-green-500" />
          )}
          <span className="capitalize">{promo.type}</span>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (promo: PromoCode) => (
        <span className="font-medium">
          {promo.type === 'percentage' ? `${promo.value}%` : `₹${promo.value}`}
        </span>
      ),
    },
    {
      key: 'usage',
      header: 'Usage',
      render: (promo: PromoCode) => (
        <span>
          {promo.usedCount} / {promo.maxUses}
        </span>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (promo: PromoCode) => (
        <span className="text-gray-600">
          {promo.expiresAt ? format(new Date(promo.expiresAt), 'MMM d, yyyy') : 'Never'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (promo: PromoCode) => (
        <StatusBadge status={promo.isActive ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (promo: PromoCode) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPromo(promo);
              setShowDetails(true);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPromo(promo);
              setShowUsage(true);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Usage"
          >
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMutation.mutate(promo._id);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title={promo.isActive ? 'Deactivate' : 'Activate'}
          >
            {promo.isActive ? (
              <ToggleRight className="w-4 h-4 text-green-500" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(promo);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Edit"
          >
            <Edit className="w-4 h-4 text-blue-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPromo(promo);
              setShowDeleteModal(true);
            }}
            className="p-2 hover:bg-red-50 rounded-lg"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Promo Codes"
        subtitle="Create and manage promotional codes"
        actions={
          <div className="flex gap-2">
            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Promo Code
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input w-full sm:w-40"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data || []}
            keyExtractor={(promo) => promo._id}
          />
          {data?.pagination && (
            <Pagination
              page={page}
              totalPages={data.pagination.pages}
              total={data.pagination.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Promo Details Modal */}
      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Promo Code Details"
        size="lg"
      >
        {selectedPromo && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Tag className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <div className="text-lg font-mono font-semibold">{selectedPromo.code}</div>
                  <div className="text-sm text-gray-500">{selectedPromo.description || 'No description'}</div>
                </div>
              </div>
              <StatusBadge status={selectedPromo.isActive ? 'active' : 'inactive'} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Type</div>
                <div className="text-lg font-semibold capitalize">{selectedPromo.type}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Value</div>
                <div className="text-lg font-semibold">
                  {selectedPromo.type === 'percentage' ? `${selectedPromo.value}%` : `₹${selectedPromo.value}`}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Usage</div>
                <div className="text-lg font-semibold">
                  {selectedPromo.usedCount} / {selectedPromo.maxUses}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Per User</div>
                <div className="text-lg font-semibold">{selectedPromo.maxUsesPerUser}</div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Restrictions</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Min Ride Amount:</span>
                  <span className="ml-2">₹{selectedPromo.minRideAmount}</span>
                </div>
                {selectedPromo.maxDiscount && (
                  <div>
                    <span className="text-gray-500">Max Discount:</span>
                    <span className="ml-2">₹{selectedPromo.maxDiscount}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2">{format(new Date(selectedPromo.createdAt), 'PPP')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Expires:</span>
                  <span className="ml-2">
                    {selectedPromo.expiresAt
                      ? format(new Date(selectedPromo.expiresAt), 'PPP')
                      : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Promo Usage Modal */}
      <Modal
        isOpen={showUsage}
        onClose={() => setShowUsage(false)}
        title={`Usage — ${selectedPromo?.code ?? ''}`}
        size="lg"
      >
        {usageLoading && !usage ? (
          <LoadingSpinner />
        ) : usage ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Total Uses</div>
                <div className="text-lg font-semibold">{usage.summary.uses}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Total Discount</div>
                <div className="text-lg font-semibold">₹{usage.summary.totalDiscount.toFixed(2)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Unique Customers</div>
                <div className="text-lg font-semibold">{usage.summary.uniqueCustomers}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Remaining Uses</div>
                <div className="text-lg font-semibold">{usage.summary.remainingUses}</div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Recent Redemptions</h4>
              {usage.recent.length === 0 ? (
                <div className="text-sm text-gray-500">No redemptions yet.</div>
              ) : (
                <div className="space-y-2">
                  {usage.recent.map((r) => (
                    <div
                      key={r._id}
                      className="flex items-center justify-between text-sm border-b border-gray-100 pb-2"
                    >
                      <div>
                        <div className="font-medium">
                          {r.customer?.firstName} {r.customer?.lastName}
                        </div>
                        <div className="text-gray-500">{r.customer?.phone}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-green-600">-₹{r.discount?.toFixed(2)}</div>
                        <div className="text-gray-400">
                          {format(new Date(r.createdAt), 'MMM d, yyyy HH:mm')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No usage data.</div>
        )}
      </Modal>

      {/* Create/Edit Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
        title={isEditing ? 'Edit Promo Code' : 'Create Promo Code'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="input font-mono"
                placeholder="SAVE20"
                disabled={isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'percentage' | 'fixed' })}
                className="input"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value *
              </label>
              <input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                className="input"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Uses
              </label>
              <input
                type="number"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: Number(e.target.value) })}
                className="input"
                min={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Uses Per User
              </label>
              <input
                type="number"
                value={formData.maxUsesPerUser}
                onChange={(e) => setFormData({ ...formData, maxUsesPerUser: Number(e.target.value) })}
                className="input"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Ride Amount (₹)
              </label>
              <input
                type="number"
                value={formData.minRideAmount}
                onChange={(e) => setFormData({ ...formData, minRideAmount: Number(e.target.value) })}
                className="input"
                min={0}
                step="0.01"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {formData.type === 'percentage' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Discount (₹)
                </label>
                <input
                  type="number"
                  value={formData.maxDiscount}
                  onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                  className="input"
                  min={0}
                  step="0.01"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expires At
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={2}
              placeholder="Optional description..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e)}
              className="btn btn-primary"
              disabled={!formData.code || !formData.value || createMutation.isPending || updateMutation.isPending}
            >
              {isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => selectedPromo && deleteMutation.mutate(selectedPromo._id)}
        title="Delete Promo Code"
        message={`Are you sure you want to delete promo code "${selectedPromo?.code}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
