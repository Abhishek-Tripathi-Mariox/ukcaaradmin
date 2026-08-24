import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { onePassAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, StatCard, RefreshButton } from '@/components/common';
import { UserSearchSelect, type AdminUserLite } from '@/components/UserSearchSelect';
import {
  Search,
  Crown,
  Plus,
  Calendar,
  XCircle,
  RefreshCw,
  Star,
  Car,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, differenceInDays } from 'date-fns';
import clsx from 'clsx';

export default function OnePassPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [cancelReason, setCancelReason] = useState('');
  const [grantData, setGrantData] = useState({
    driverId: '',
    plan: 'monthly',
    duration: 30,
    reason: '',
  });
  const [grantUser, setGrantUser] = useState<AdminUserLite | null>(null);
  const queryClient = useQueryClient();

  // ── Plan configuration (price/duration the driver app offers) ──
  type PlanRow = { key: string; label: string; price: number; days: number; active: boolean };
  const plansQ = useQuery({
    queryKey: ['onepass', 'plans'],
    queryFn: async () => (await onePassAPI.getPlans()).data?.data?.plans as PlanRow[],
  });
  const [planRows, setPlanRows] = useState<PlanRow[] | null>(null);
  useEffect(() => {
    if (plansQ.data) setPlanRows(plansQ.data.map((p) => ({ ...p })));
  }, [plansQ.data]);
  const savePlansMut = useMutation({
    mutationFn: (rows: PlanRow[]) => onePassAPI.updatePlans(rows),
    onSuccess: () => {
      toast.success('OnePass plans saved');
      queryClient.invalidateQueries({ queryKey: ['onepass', 'plans'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save plans'),
  });
  const setPlanField = (i: number, field: keyof PlanRow, value: any) =>
    setPlanRows((rows) => rows?.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)) ?? rows);

  const { data: stats } = useQuery({
    queryKey: ['onepass', 'stats'],
    queryFn: async () => {
      const res = await onePassAPI.getStats();
      return res.data.data;
    },
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['onepass', 'subscribers', page, search, statusFilter],
    queryFn: async () => {
      const params: any = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await onePassAPI.getSubscribers(params);
      return {
        data: res.data?.data?.subscribers ?? [],
        pagination: res.data?.data?.pagination ?? null,
      };
    },
  });

  const extendMutation = useMutation({
    mutationFn: ({ driverId, days }: { driverId: string; days: number }) =>
      onePassAPI.extendSubscription(driverId, days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onepass'] });
      toast.success('Subscription extended');
      setShowExtendModal(false);
      setExtendDays(30);
    },
    onError: () => toast.error('Failed to extend subscription'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ driverId, reason }: { driverId: string; reason: string }) =>
      onePassAPI.cancelSubscription(driverId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onepass'] });
      toast.success('Subscription cancelled');
      setShowCancelModal(false);
      setCancelReason('');
    },
    onError: () => toast.error('Failed to cancel subscription'),
  });

  const grantMutation = useMutation({
    mutationFn: (data: { driverId: string; plan: string; duration: number; reason: string }) =>
      onePassAPI.grantSubscription(data.driverId, data.plan, data.duration, data.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onepass'] });
      toast.success('Subscription granted');
      setShowGrantModal(false);
      setGrantData({ driverId: '', plan: 'monthly', duration: 30, reason: '' });
      setGrantUser(null);
    },
    onError: () => toast.error('Failed to grant subscription'),
  });

  // Returns null when there is no valid expiry date, so callers can render a
  // placeholder instead of feeding an Invalid Date to date-fns (which throws).
  const getDaysRemaining = (expiresAt?: string | null): number | null => {
    if (!expiresAt) return null;
    const d = new Date(expiresAt);
    if (isNaN(d.getTime())) return null;
    return differenceInDays(d, new Date());
  };

  const columns = [
    {
      key: 'driver',
      header: 'Driver',
      render: (driver: any) => (
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Crown className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-900">
              {driver.firstName} {driver.lastName}
            </div>
            <div className="text-sm text-gray-500">{driver.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (driver: any) => {
        const dp = driver.driverProfile;
        const vehicle = [dp?.vehicleMake, dp?.vehicleModel].filter(Boolean).join(' ') || '—';
        return (
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-gray-400" />
            <span className="capitalize">{vehicle}</span>
          </div>
        );
      },
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (driver: any) => (
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span>{driver.driverProfile?.rating?.toFixed(1) || '-'}</span>
        </div>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (driver: any) => {
        const expiry = driver.driverProfile?.onePassExpiry;
        const daysRemaining = getDaysRemaining(expiry);
        if (daysRemaining === null) {
          return <span className="text-sm text-gray-400">—</span>;
        }
        // An elapsed pass has a NEGATIVE difference; rendering it raw read as
        // "-4 days left". Past expiry we count days elapsed instead.
        const elapsed = daysRemaining < 0;
        const magnitude = Math.abs(daysRemaining);
        const unit = magnitude === 1 ? 'day' : 'days';
        return (
          <div>
            <div className={clsx(
              'font-medium',
              elapsed || daysRemaining <= 7
                ? 'text-red-600'
                : daysRemaining <= 30
                  ? 'text-yellow-600'
                  : 'text-green-600'
            )}>
              {elapsed
                ? magnitude === 0
                  ? 'Expired today'
                  : `Expired ${magnitude} ${unit} ago`
                : `${daysRemaining} ${unit} left`}
            </div>
            <div className="text-sm text-gray-500">
              {format(new Date(expiry), 'MMM d, yyyy')}
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (driver: any) => {
        const daysRemaining = getDaysRemaining(driver.driverProfile?.onePassExpiry);
        const active = daysRemaining !== null && daysRemaining > 0;
        return (
          <StatusBadge
            status={active ? 'active' : 'expired'}
            variant={active ? 'success' : 'danger'}
          />
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (driver: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDriver(driver);
              setShowExtendModal(true);
            }}
            className="p-2 hover:bg-green-50 rounded-lg"
            title="Extend"
          >
            <Calendar className="w-4 h-4 text-green-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDriver(driver);
              setShowCancelModal(true);
            }}
            className="p-2 hover:bg-red-50 rounded-lg"
            title="Cancel"
          >
            <XCircle className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="OnePass Management"
        subtitle="Manage driver subscription plans"
        actions={
          <div className="flex gap-2">
            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
            <button
              onClick={() => setShowGrantModal(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Grant OnePass
            </button>
          </div>
        }
      />

      {/* Plan configuration — price + duration the driver app shows. */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-8">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold">Subscription Plans</h3>
          <div className="flex items-center gap-2">
            {/* The editor could only EDIT existing rows, so an admin whose
                saved plans predate the 'daily' default had no way to add one. */}
            <button
              className="btn btn-secondary btn-sm"
              disabled={!planRows}
              onClick={() =>
                planRows &&
                setPlanRows([
                  ...planRows,
                  { key: '', label: '', price: 0, days: 1, active: true },
                ])
              }
            >
              Add Plan
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!planRows || savePlansMut.isPending}
              onClick={() => planRows && savePlansMut.mutate(planRows)}
            >
              {savePlansMut.isPending ? 'Saving…' : 'Save Plans'}
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          These are the exact plans and prices the driver app offers. The price is charged
          server-side, so the app can never bill a value you didn't set here.
        </p>
        {!planRows ? (
          <p className="text-sm text-gray-400 py-4">Loading plans…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Key</th>
                  <th className="py-2 pr-3">Label</th>
                  <th className="py-2 pr-3">Price (₹)</th>
                  <th className="py-2 pr-3">Duration (days)</th>
                  <th className="py-2 pr-3">Active</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <input className="input input-sm w-28" value={row.key}
                        onChange={(e) => setPlanField(i, 'key', e.target.value)} />
                    </td>
                    <td className="py-2 pr-3">
                      <input className="input input-sm w-36" value={row.label}
                        onChange={(e) => setPlanField(i, 'label', e.target.value)} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min={0} className="input input-sm w-28" value={row.price}
                        onChange={(e) => setPlanField(i, 'price', Number(e.target.value))} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min={1} className="input input-sm w-28" value={row.days}
                        onChange={(e) => setPlanField(i, 'days', Number(e.target.value))} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="checkbox" checked={row.active}
                        onChange={(e) => setPlanField(i, 'active', e.target.checked)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Subscribers"
          value={stats?.activeSubscribers || 0}
          icon={<Crown className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="Expiring Soon (7 days)"
          value={stats?.expiringSoon || 0}
          icon={<Calendar className="w-6 h-6" />}
          color="yellow"
        />
        <StatCard
          title="Monthly Revenue"
          value={`₹${stats?.monthlyRevenue?.toFixed(2) || '0.00'}`}
          icon={<RefreshCw className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Total Revenue"
          value={`₹${stats?.totalRevenue?.toFixed(2) || '0.00'}`}
          icon={<RefreshCw className="w-6 h-6" />}
          color="primary"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
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
          <option value="expiring">Expiring Soon</option>
          <option value="expired">Expired</option>
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
            keyExtractor={(driver) => driver._id}
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

      {/* Extend Modal */}
      <Modal
        isOpen={showExtendModal}
        onClose={() => {
          setShowExtendModal(false);
          setExtendDays(30);
        }}
        title="Extend Subscription"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Crown className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="font-medium">
                {selectedDriver?.firstName} {selectedDriver?.lastName}
              </div>
              <div className="text-sm text-gray-500">
                Current expiry: {selectedDriver?.driverProfile?.onePassExpiry
                  ? format(new Date(selectedDriver.driverProfile.onePassExpiry), 'PPP')
                  : '—'}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Extend by (days)
            </label>
            <input
              type="number"
              value={extendDays}
              onChange={(e) => setExtendDays(Number(e.target.value))}
              className="input"
              min={1}
              max={365}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowExtendModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedDriver) {
                  extendMutation.mutate({ driverId: selectedDriver._id, days: extendDays });
                }
              }}
              className="btn btn-primary"
              disabled={extendMutation.isPending}
            >
              Extend
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancelReason('');
        }}
        title="Cancel Subscription"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to cancel the OnePass subscription for {selectedDriver?.firstName} {selectedDriver?.lastName}?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Enter reason..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCancelModal(false)} className="btn btn-secondary">
              Close
            </button>
            <button
              onClick={() => {
                if (selectedDriver && cancelReason) {
                  cancelMutation.mutate({ driverId: selectedDriver._id, reason: cancelReason });
                }
              }}
              className="btn btn-danger"
              disabled={!cancelReason || cancelMutation.isPending}
            >
              Cancel Subscription
            </button>
          </div>
        </div>
      </Modal>

      {/* Grant Modal */}
      <Modal
        isOpen={showGrantModal}
        onClose={() => {
          setShowGrantModal(false);
          setGrantData({ driverId: '', plan: 'monthly', duration: 30, reason: '' });
          setGrantUser(null);
        }}
        title="Grant OnePass Subscription"
      >
        <div className="space-y-4">
          <UserSearchSelect
            label="Driver"
            required
            roles={['driver']}
            defaultRole="driver"
            value={grantUser}
            onChange={(u) => {
              setGrantUser(u);
              setGrantData({ ...grantData, driverId: u?._id ?? '' });
            }}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan
            </label>
            <select
              value={grantData.plan}
              onChange={(e) => setGrantData({ ...grantData, plan: e.target.value })}
              className="input"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (days)
            </label>
            <input
              type="number"
              value={grantData.duration}
              onChange={(e) => setGrantData({ ...grantData, duration: Number(e.target.value) })}
              className="input"
              min={1}
              max={365}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <textarea
              value={grantData.reason}
              onChange={(e) => setGrantData({ ...grantData, reason: e.target.value })}
              className="input"
              rows={2}
              placeholder="Enter reason for granting..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowGrantModal(false);
                setGrantUser(null);
                setGrantData({ driverId: '', plan: 'monthly', duration: 30, reason: '' });
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (grantData.driverId && grantData.reason) {
                  grantMutation.mutate(grantData);
                }
              }}
              className="btn btn-primary"
              disabled={!grantData.driverId || !grantData.reason || grantMutation.isPending}
            >
              Grant OnePass
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
