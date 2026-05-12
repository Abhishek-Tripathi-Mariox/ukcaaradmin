import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { onePassAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, StatCard, RefreshButton } from '@/components/common';
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
  const queryClient = useQueryClient();

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
    },
    onError: () => toast.error('Failed to grant subscription'),
  });

  const getDaysRemaining = (expiresAt: string) => {
    const days = differenceInDays(new Date(expiresAt), new Date());
    return days;
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
      render: (driver: any) => (
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-gray-400" />
          <span className="capitalize">{driver.driverProfile?.vehicleType}</span>
        </div>
      ),
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
        const daysRemaining = getDaysRemaining(driver.driverProfile?.onePassExpiresAt);
        return (
          <div>
            <div className={clsx(
              'font-medium',
              daysRemaining <= 7 ? 'text-red-600' : daysRemaining <= 30 ? 'text-yellow-600' : 'text-green-600'
            )}>
              {daysRemaining} days left
            </div>
            <div className="text-sm text-gray-500">
              {format(new Date(driver.driverProfile?.onePassExpiresAt), 'MMM d, yyyy')}
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (driver: any) => {
        const daysRemaining = getDaysRemaining(driver.driverProfile?.onePassExpiresAt);
        return (
          <StatusBadge
            status={daysRemaining > 0 ? 'active' : 'expired'}
            variant={daysRemaining > 0 ? 'success' : 'danger'}
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
                Current expiry: {selectedDriver?.driverProfile?.onePassExpiresAt && 
                  format(new Date(selectedDriver.driverProfile.onePassExpiresAt), 'PPP')}
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
        }}
        title="Grant OnePass Subscription"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driver ID *
            </label>
            <input
              type="text"
              value={grantData.driverId}
              onChange={(e) => setGrantData({ ...grantData, driverId: e.target.value })}
              className="input"
              placeholder="Enter driver ID..."
            />
          </div>
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
            <button onClick={() => setShowGrantModal(false)} className="btn btn-secondary">
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
