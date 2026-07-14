import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { driversAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal, ConfirmModal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, RefreshButton } from '@/components/common';
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Ban,
  FileText,
  Star,
  Car,
  Wifi,
  WifiOff,
  Mail,
  Phone,
  Crown,
  Percent,
  Calendar,
  MapPin,
  ExternalLink,
  Activity,
  Zap,
  Lock,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Driver, DriverDocument, Ride } from '@/types';

type TabType = 'all' | 'applications' | 'online';
type DetailTab = 'overview' | 'rides' | 'documents' | 'stats';

const formatGBP = (n?: number) =>
  `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DriversPage() {
  const qc = useQueryClient();

  // Honour a ?tab= deep-link (e.g. the dashboard's "Review Applications"
  // quick action sends ?tab=applications). Falls back to "all".
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType | null;
  const [tab, setTab] = useState<TabType>(
    tabParam && ['all', 'applications', 'online'].includes(tabParam) ? tabParam : 'all',
  );
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  // Advanced filters for the "All Drivers" list, revealed by the Filters
  // button. Each maps to a query param the /admin/drivers endpoint supports.
  const [showFilters, setShowFilters] = useState(false);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('');
  const [onlineFilter, setOnlineFilter] = useState<string>('');
  const [onePassFilter, setOnePassFilter] = useState<string>('');
  const [minRatingFilter, setMinRatingFilter] = useState<string>('');

  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  // Which tab the detail modal should open on. Used to bounce the admin
  // straight to "Documents" when approval is blocked by unverified docs.
  const [detailInitialTab, setDetailInitialTab] = useState<DetailTab>('overview');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendDuration, setSuspendDuration] = useState(7);
  const [commissionRate, setCommissionRate] = useState(20);

  const listQuery = useQuery({
    queryKey: [
      'drivers',
      tab,
      page,
      search,
      statusFilter,
      serviceTypeFilter,
      onlineFilter,
      onePassFilter,
      minRatingFilter,
    ],
    queryFn: async () => {
      const params: any = { page, limit: 10 };
      if (search) params.search = search;

      if (tab === 'applications') {
        params.status = statusFilter || 'pending';
        const res = await driversAPI.getApplications(params);
        return res.data?.data;
      }

      // Advanced filters apply to the All Drivers list. The Online tab forces
      // isOnline, so the online filter is hidden/ignored there.
      if (statusFilter === 'verified') params.isVerified = true;
      else if (statusFilter === 'pending') params.isVerified = false;
      else if (statusFilter === 'suspended') params.isActive = false;
      if (serviceTypeFilter) params.serviceType = serviceTypeFilter;
      if (onePassFilter) params.isOnePass = onePassFilter === 'yes';
      if (minRatingFilter) params.minRating = Number(minRatingFilter);

      if (tab === 'online') {
        params.isOnline = true;
      } else if (onlineFilter) {
        params.isOnline = onlineFilter === 'online';
      }

      const res = await driversAPI.getAll(params);
      return res.data?.data;
    },
    placeholderData: keepPreviousData,
  });

  const drivers: Driver[] = listQuery.data?.drivers ?? [];
  const pagination = listQuery.data?.pagination;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['drivers'] });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      driversAPI.approveApplication(id, note),
    onSuccess: () => {
      invalidate();
      toast.success('Driver approved');
      setShowApproveModal(false);
    },
    onError: (err: any) => {
      // Surface the backend's reason — particularly the "all docs must be
      // verified before approval" message — so the admin knows what's blocking.
      const data = err?.response?.data;
      const msg = data?.message || 'Failed to approve driver';
      const blockedByDocs =
        err?.response?.status === 400 &&
        (data?.data?.missing?.length || data?.data?.unverified?.length);

      toast.error(msg);
      setShowApproveModal(false);

      if (blockedByDocs) {
        // Bounce the admin straight to the Documents tab on the driver's
        // detail modal so they can review/approve each doc.
        setDetailInitialTab('documents');
        setShowDetails(true);
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      driversAPI.rejectApplication(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Application rejected');
      setShowRejectModal(false);
      setRejectReason('');
    },
    onError: () => toast.error('Failed to reject driver'),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason, duration }: { id: string; reason: string; duration: number }) =>
      driversAPI.suspendDriver(id, reason, duration),
    onSuccess: () => {
      invalidate();
      toast.success('Driver suspended');
      setShowSuspendModal(false);
      setSuspendReason('');
    },
    onError: () => toast.error('Failed to suspend driver'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => driversAPI.reactivateDriver(id),
    onSuccess: () => {
      invalidate();
      toast.success('Driver reactivated');
    },
    onError: () => toast.error('Failed to reactivate driver'),
  });

  const forceOfflineMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      driversAPI.forceOffline(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Driver forced offline');
    },
    onError: () => toast.error('Failed to force offline'),
  });

  const commissionMutation = useMutation({
    mutationFn: ({ id, rate }: { id: string; rate: number }) =>
      driversAPI.updateCommission(id, rate),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['driver-detail'] });
      toast.success('Commission updated');
      setShowCommissionModal(false);
    },
    onError: () => toast.error('Failed to update commission'),
  });

  // Advanced filters available on the All Drivers tab (Online tab forces
  // online, so it doesn't count its own online filter).
  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (serviceTypeFilter ? 1 : 0) +
    (tab !== 'online' && onlineFilter ? 1 : 0) +
    (onePassFilter ? 1 : 0) +
    (minRatingFilter ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter('');
    setServiceTypeFilter('');
    setOnlineFilter('');
    setOnePassFilter('');
    setMinRatingFilter('');
    setPage(1);
  };

  const columns = [
    {
      key: 'driver',
      header: 'Driver',
      render: (d: Driver) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <Avatar driver={d} size={40} />
            {d.driverProfile?.isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {d.firstName || '—'} {d.lastName || ''}
            </div>
            <div className="text-xs text-gray-500 truncate">{d.phone || d.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (d: Driver) => {
        const v = d.driverProfile;
        const make = [v?.vehicleMake, v?.vehicleModel].filter(Boolean).join(' ');
        return (
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-sm font-medium">{make || '—'}</div>
              <div className="text-xs text-gray-500">
                {v?.plateNumber || 'No plate'} {v?.vehicleColor ? `• ${v.vehicleColor}` : ''}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'category',
      header: 'Category',
      render: (d: Driver) => <ServiceTypeBadge serviceType={d.driverProfile?.serviceType} />,
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (d: Driver) => (
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="font-medium">{d.driverProfile?.rating?.toFixed(1) ?? '—'}</span>
          <span className="text-gray-400 text-xs ml-1">
            ({d.driverProfile?.totalTrips ?? 0})
          </span>
        </div>
      ),
    },
    {
      key: 'earnings',
      header: 'Earnings',
      render: (d: Driver) => (
        <span className="text-sm font-medium">{formatGBP(d.driverProfile?.totalEarnings)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (d: Driver) => (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={driverStatusLabel(d)} />
          {d.driverProfile?.isOnePass && (
            <span className="badge bg-purple-100 text-purple-800 inline-flex items-center gap-1">
              <Crown className="w-3 h-3" /> OnePass
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (d: Driver) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => {
              setSelectedDriver(d);
              setShowDetails(true);
            }}
            className="p-1.5 hover:bg-gray-100 rounded"
            title="View details"
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
          {!d.isVerified && (
            <>
              <button
                onClick={() => {
                  setSelectedDriver(d);
                  setShowApproveModal(true);
                }}
                className="p-1.5 hover:bg-green-50 rounded"
                title="Approve"
              >
                <CheckCircle className="w-4 h-4 text-green-500" />
              </button>
              <button
                onClick={() => {
                  setSelectedDriver(d);
                  setShowRejectModal(true);
                }}
                className="p-1.5 hover:bg-red-50 rounded"
                title="Reject"
              >
                <XCircle className="w-4 h-4 text-red-500" />
              </button>
            </>
          )}
          {d.isVerified && d.isActive && (
            <button
              onClick={() => {
                setSelectedDriver(d);
                setShowSuspendModal(true);
              }}
              className="p-1.5 hover:bg-red-50 rounded"
              title="Suspend"
            >
              <Ban className="w-4 h-4 text-red-500" />
            </button>
          )}
          {d.isVerified && !d.isActive && (
            <button
              onClick={() => reactivateMutation.mutate(d._id)}
              className="p-1.5 hover:bg-green-50 rounded"
              title="Reactivate"
            >
              <CheckCircle className="w-4 h-4 text-green-500" />
            </button>
          )}
          {d.driverProfile?.isOnline && (
            <button
              onClick={() => forceOfflineMutation.mutate({ id: d._id, reason: 'Admin action' })}
              className="p-1.5 hover:bg-yellow-50 rounded"
              title="Force offline"
            >
              <WifiOff className="w-4 h-4 text-yellow-500" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Driver Management"
        subtitle="Drivers, applications, documents, rides and earnings"
        actions={<RefreshButton onRefresh={() => listQuery.refetch()} isFetching={listQuery.isFetching} />}
      />

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'all', label: 'All Drivers', icon: Car },
          { key: 'applications', label: 'Applications', icon: FileText },
          { key: 'online', label: 'Online Now', icon: Wifi },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key as TabType);
              setPage(1);
              setStatusFilter('');
              setServiceTypeFilter('');
              setOnlineFilter('');
              setOnePassFilter('');
              setMinRatingFilter('');
            }}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone or plate…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input pl-9"
            />
          </div>
          {tab === 'applications' ? (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input sm:w-48"
            >
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
            </select>
          ) : (
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={clsx(
                'btn inline-flex items-center gap-2 shrink-0',
                showFilters || activeFilterCount > 0 ? 'btn-primary' : 'btn-secondary',
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-semibold rounded-full bg-white/90 text-primary-700">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>

        {tab !== 'applications' && showFilters && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="input w-full"
                >
                  <option value="">All status</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Unverified</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">Category</label>
                <select
                  value={serviceTypeFilter}
                  onChange={(e) => {
                    setServiceTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="input w-full"
                >
                  <option value="">All categories</option>
                  <option value="instant">Instant</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="private">Private</option>
                </select>
              </div>

              {tab !== 'online' && (
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Availability</label>
                  <select
                    value={onlineFilter}
                    onChange={(e) => {
                      setOnlineFilter(e.target.value);
                      setPage(1);
                    }}
                    className="input w-full"
                  >
                    <option value="">All</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-600 block mb-1">OnePass</label>
                <select
                  value={onePassFilter}
                  onChange={(e) => {
                    setOnePassFilter(e.target.value);
                    setPage(1);
                  }}
                  className="input w-full"
                >
                  <option value="">All</option>
                  <option value="yes">OnePass</option>
                  <option value="no">Non-OnePass</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">Minimum rating</label>
                <select
                  value={minRatingFilter}
                  onChange={(e) => {
                    setMinRatingFilter(e.target.value);
                    setPage(1);
                  }}
                  className="input w-full"
                >
                  <option value="">Any rating</option>
                  <option value="4.5">4.5+</option>
                  <option value="4">4.0+</option>
                  <option value="3">3.0+</option>
                  <option value="2">2.0+</option>
                </select>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
                >
                  <X className="w-4 h-4" />
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {listQuery.isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={drivers}
            keyExtractor={(d) => d._id}
            emptyMessage="No drivers match these filters"
          />
          {pagination && (
            <Pagination
              page={page}
              totalPages={pagination.pages}
              total={pagination.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {showDetails && selectedDriver && (
        <DriverDetailModal
          driverId={selectedDriver._id}
          initialTab={detailInitialTab}
          onClose={() => {
            setShowDetails(false);
            setSelectedDriver(null);
            setDetailInitialTab('overview');
          }}
          onAction={{
            suspend: () => setShowSuspendModal(true),
            reactivate: () => reactivateMutation.mutate(selectedDriver._id),
            forceOffline: () =>
              forceOfflineMutation.mutate({ id: selectedDriver._id, reason: 'Admin action' }),
            approve: () => setShowApproveModal(true),
            reject: () => setShowRejectModal(true),
            updateCommission: (rate) => {
              setCommissionRate(rate);
              setShowCommissionModal(true);
            },
            verifyDocument: ({ documentType, status, note }) => {
              driversAPI
                .verifyDocument(selectedDriver._id, documentType, status, note)
                .then(() => {
                  qc.invalidateQueries({ queryKey: ['driver-detail', selectedDriver._id] });
                  invalidate();
                  toast.success(`Document ${status}`);
                })
                .catch(() => toast.error('Failed to update document'));
            },
          }}
        />
      )}

      <ConfirmModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={() =>
          selectedDriver && approveMutation.mutate({ id: selectedDriver._id })
        }
        title="Approve Driver"
        message={`Approve ${selectedDriver?.firstName ?? ''} ${selectedDriver?.lastName ?? ''}? They'll be able to go online and accept rides.`}
        confirmText="Approve"
        variant="info"
        isLoading={approveMutation.isPending}
      />

      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
        }}
        title="Reject Driver Application"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Reject {selectedDriver?.firstName}'s application?
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reason for rejection *
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Why was this application rejected?"
            />
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <button type="button" onClick={() => setShowRejectModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                selectedDriver &&
                rejectReason.trim() &&
                rejectMutation.mutate({ id: selectedDriver._id, reason: rejectReason.trim() })
              }
              className="btn btn-danger"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showSuspendModal}
        onClose={() => {
          setShowSuspendModal(false);
          setSuspendReason('');
        }}
        title="Suspend Driver"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Suspend {selectedDriver?.firstName}'s account. They'll be forced offline.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason *</label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="input"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Duration (days)
            </label>
            <input
              type="number"
              value={suspendDuration}
              onChange={(e) => setSuspendDuration(Number(e.target.value))}
              className="input"
              min={1}
              max={365}
            />
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <button onClick={() => setShowSuspendModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={() =>
                selectedDriver &&
                suspendReason &&
                suspendMutation.mutate({
                  id: selectedDriver._id,
                  reason: suspendReason,
                  duration: suspendDuration,
                })
              }
              className="btn btn-danger"
              disabled={!suspendReason || suspendMutation.isPending}
            >
              {suspendMutation.isPending ? 'Suspending…' : 'Suspend'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCommissionModal}
        onClose={() => setShowCommissionModal(false)}
        title="Update Commission"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Set the platform commission percentage for{' '}
            <strong>
              {selectedDriver?.firstName} {selectedDriver?.lastName}
            </strong>
            . Default is 20%.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Commission rate (%)
            </label>
            <input
              type="number"
              value={commissionRate}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
              min={0}
              max={100}
              step={0.5}
              className="input"
            />
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <button
              onClick={() => setShowCommissionModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                selectedDriver &&
                commissionMutation.mutate({ id: selectedDriver._id, rate: commissionRate })
              }
              className="btn btn-primary"
              disabled={commissionMutation.isPending}
            >
              {commissionMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface DetailActions {
  suspend: () => void;
  reactivate: () => void;
  forceOffline: () => void;
  approve: () => void;
  reject: () => void;
  updateCommission: (rate: number) => void;
  verifyDocument: (args: { documentType: string; status: 'verified' | 'rejected'; note?: string }) => void;
}

function DriverDetailModal({
  driverId,
  onClose,
  onAction,
  initialTab = 'overview',
}: {
  driverId: string;
  onClose: () => void;
  onAction: DetailActions;
  initialTab?: DetailTab;
}) {
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [ridesPage, setRidesPage] = useState(1);
  const [rideStatusFilter, setRideStatusFilter] = useState<string>('');
  const [docRejectTarget, setDocRejectTarget] = useState<DriverDocument | null>(null);
  const [docRejectNote, setDocRejectNote] = useState('');

  const detailQuery = useQuery({
    queryKey: ['driver-detail', driverId],
    queryFn: async () => (await driversAPI.getById(driverId)).data?.data,
    // Re-fetch every 15s so the Live location section in the Overview tab
    // tracks the driver in near-real-time without a manual refresh.
    refetchInterval: 15_000,
  });
  const statsQuery = useQuery({
    queryKey: ['driver-stats', driverId],
    queryFn: async () => (await driversAPI.getStats(driverId)).data?.data,
    enabled: tab === 'stats' || tab === 'overview',
  });
  const ridesQuery = useQuery({
    queryKey: ['driver-rides', driverId, ridesPage, rideStatusFilter],
    queryFn: async () =>
      (
        await driversAPI.getRides(driverId, {
          page: ridesPage,
          limit: 10,
          status: rideStatusFilter || undefined,
        })
      ).data?.data,
    enabled: tab === 'rides',
    placeholderData: keepPreviousData,
  });

  const driver: Driver | undefined = detailQuery.data?.driver;
  const earnings = detailQuery.data?.earnings as
    | { total: number; thisWeek: number; thisMonth: number }
    | undefined;

  return (
    <>
    <Modal
      isOpen
      onClose={onClose}
      title={driver ? `${driver.firstName} ${driver.lastName}` : 'Driver Details'}
      size="xl"
    >
      {detailQuery.isLoading || !driver ? (
        <LoadingSpinner />
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-4 pb-4 mb-4 border-b">
            <Avatar driver={driver} size={64} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold">
                  {driver.firstName} {driver.lastName}
                </h3>
                <StatusBadge status={driverStatusLabel(driver)} />
                {driver.driverProfile?.isOnline && (
                  <span className="badge bg-green-100 text-green-700 inline-flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> Online
                  </span>
                )}
                {driver.driverProfile?.isOnePass && (
                  <span className="badge bg-purple-100 text-purple-800 inline-flex items-center gap-1">
                    <Crown className="w-3 h-3" /> OnePass
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                {driver.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {driver.phone}
                  </span>
                )}
                {driver.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {driver.email}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Joined{' '}
                  {format(new Date(driver.createdAt), 'PP')}
                </span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!driver.isVerified && (
                <>
                  <button onClick={onAction.approve} className="btn btn-success btn-sm">
                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                  </button>
                  <button onClick={onAction.reject} className="btn btn-danger btn-sm">
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </button>
                </>
              )}
              {driver.isVerified && driver.isActive && (
                <button onClick={onAction.suspend} className="btn btn-danger btn-sm">
                  <Ban className="w-4 h-4 mr-1" /> Suspend
                </button>
              )}
              {driver.isVerified && !driver.isActive && (
                <button onClick={onAction.reactivate} className="btn btn-success btn-sm">
                  <CheckCircle className="w-4 h-4 mr-1" /> Reactivate
                </button>
              )}
              {driver.driverProfile?.isOnline && (
                <button onClick={onAction.forceOffline} className="btn btn-secondary btn-sm">
                  <WifiOff className="w-4 h-4 mr-1" /> Force offline
                </button>
              )}
              <button
                onClick={() =>
                  onAction.updateCommission(driver.driverProfile?.commissionRate ?? 20)
                }
                className="btn btn-secondary btn-sm"
              >
                <Percent className="w-4 h-4 mr-1" /> Commission
              </button>
            </div>
          </div>

          <div className="flex gap-1 border-b mb-4">
            {(
              [
                { key: 'overview', label: 'Overview' },
                { key: 'rides', label: 'Rides' },
                { key: 'documents', label: 'Documents' },
                { key: 'stats', label: 'Stats' },
              ] as { key: DetailTab; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={clsx(
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px',
                  tab === key
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Total trips"
                  value={String(driver.driverProfile?.totalTrips ?? 0)}
                />
                <StatCard
                  label="Rating"
                  value={
                    driver.driverProfile?.rating
                      ? driver.driverProfile.rating.toFixed(2)
                      : '—'
                  }
                  icon={<Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                />
                <StatCard
                  label="Total earnings"
                  value={formatGBP(driver.driverProfile?.totalEarnings)}
                />
                <StatCard
                  label="Commission"
                  value={`${driver.driverProfile?.commissionRate ?? 20}%`}
                />
              </div>

              {earnings && (
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Earnings this week" value={formatGBP(earnings.thisWeek)} />
                  <StatCard label="Earnings this month" value={formatGBP(earnings.thisMonth)} />
                  <StatCard label="Earnings all-time" value={formatGBP(earnings.total)} />
                </div>
              )}

              <DriverLiveLocationSection
                location={driver.driverProfile?.currentLocation}
                isOnline={!!driver.driverProfile?.isOnline}
                driverName={`${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim()}
                updatedAt={(driver.driverProfile as any)?.locationUpdatedAt}
              />

              <Section title="Vehicle">
                <KV label="Make">{driver.driverProfile?.vehicleMake || '—'}</KV>
                <KV label="Model">{driver.driverProfile?.vehicleModel || '—'}</KV>
                <KV label="Year">{driver.driverProfile?.vehicleYear || '—'}</KV>
                <KV label="Colour">{driver.driverProfile?.vehicleColor || '—'}</KV>
                <KV label="Plate">{driver.driverProfile?.plateNumber || '—'}</KV>
                <KV label="Insurance #">{driver.driverProfile?.insuranceNumber || '—'}</KV>
                <KV label="Licence #">{driver.driverProfile?.licenceNumber || '—'}</KV>
                {driver.driverProfile?.currentLocation && (
                  <KV label="Last location">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {driver.driverProfile.currentLocation.lat.toFixed(4)},{' '}
                      {driver.driverProfile.currentLocation.lng.toFixed(4)}
                    </span>
                  </KV>
                )}
              </Section>

              {driver.driverProfile?.isOnePass && driver.driverProfile?.onePassExpiry && (
                <Section title="OnePass">
                  <KV label="Expiry">
                    {format(new Date(driver.driverProfile.onePassExpiry), 'PPP')}
                  </KV>
                </Section>
              )}

              {!driver.isActive && (driver as any).disabledReason && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                  <div className="font-medium text-red-700 flex items-center gap-1">
                    <Ban className="w-4 h-4" /> Account disabled
                  </div>
                  <div className="text-red-700 mt-1">{(driver as any).disabledReason}</div>
                  {(driver as any).disabledAt && (
                    <div className="text-red-500 text-xs mt-1">
                      since {format(new Date((driver as any).disabledAt), 'PP p')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'rides' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={rideStatusFilter}
                  onChange={(e) => {
                    setRideStatusFilter(e.target.value);
                    setRidesPage(1);
                  }}
                  className="input sm:w-48"
                >
                  <option value="">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="in_progress">In progress</option>
                  <option value="driver_assigned">Driver assigned</option>
                </select>
                {ridesQuery.data?.pagination && (
                  <span className="text-xs text-gray-500 ml-auto">
                    {ridesQuery.data.pagination.total} total
                  </span>
                )}
              </div>

              {ridesQuery.isLoading ? (
                <LoadingSpinner />
              ) : !ridesQuery.data?.rides?.length ? (
                <div className="bg-gray-50 rounded p-8 text-center text-sm text-gray-500">
                  No rides found
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Customer</th>
                        <th className="px-3 py-2 text-left">Trip</th>
                        <th className="px-3 py-2 text-right">Fare</th>
                        <th className="px-3 py-2 text-right">Earned</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ridesQuery.data.rides.map((r: Ride & any) => (
                        <tr key={r._id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                            {format(new Date(r.createdAt), 'PP p')}
                          </td>
                          <td className="px-3 py-2">
                            {r.customer
                              ? `${r.customer.firstName ?? ''} ${r.customer.lastName ?? ''}`.trim() ||
                                r.customer.phone ||
                                '—'
                              : '—'}
                          </td>
                          <td className="px-3 py-2 max-w-xs">
                            <div className="text-xs text-gray-500 truncate">
                              <MapPin className="w-3 h-3 inline mr-1 text-green-600" />
                              {r.pickup?.address || '—'}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              <MapPin className="w-3 h-3 inline mr-1 text-red-600" />
                              {r.dropoff?.address || '—'}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatGBP(r.actualFare ?? r.estimatedFare)}
                          </td>
                          <td className="px-3 py-2 text-right text-green-700 font-medium">
                            {formatGBP(r.driverEarnings)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <RideStatusPill status={r.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {ridesQuery.data?.pagination && ridesQuery.data.pagination.pages > 1 && (
                <Pagination
                  page={ridesPage}
                  totalPages={ridesQuery.data.pagination.pages}
                  total={ridesQuery.data.pagination.total}
                  onPageChange={setRidesPage}
                />
              )}
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-3">
              {driver.driverProfile?.documents?.length ? (
                driver.driverProfile.documents.map((doc: DriverDocument) => (
                  <div
                    key={doc.type}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {docStatusIcon(doc.status)}
                      <div className="min-w-0">
                        <div className="font-medium capitalize">
                          {doc.type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {doc.expiry
                            ? `Expires: ${format(new Date(doc.expiry), 'PP')}`
                            : 'No expiry'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={doc.status} />
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> View
                        </a>
                      )}
                      {doc.status !== 'verified' && (
                        <button
                          onClick={() =>
                            onAction.verifyDocument({
                              documentType: doc.type,
                              status: 'verified',
                            })
                          }
                          className="btn btn-success btn-sm"
                        >
                          Approve
                        </button>
                      )}
                      {doc.status !== 'rejected' && (
                        <button
                          onClick={() => { setDocRejectNote(''); setDocRejectTarget(doc); }}
                          className="btn btn-danger btn-sm"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">No documents uploaded</p>
              )}

              {/* Passbook / cancelled-cheque sits with the documents (not buried
                  in the bank box) so it reviews like any other uploaded file. */}
              {driver.driverProfile?.bankDetails?.passbookUrl && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div className="min-w-0">
                      <div className="font-medium">Passbook / Cheque</div>
                      <div className="text-xs text-gray-500">Bank document</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={driver.driverProfile.bankDetails.passbookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" /> View
                    </a>
                  </div>
                </div>
              )}

              {/* Bank / payout details live in driverProfile.bankDetails,
                  separate from the verifiable document list — surface them
                  here too (including the passbook / cancelled-cheque file). */}
              {(() => {
                const bank = driver.driverProfile?.bankDetails;
                const hasBank =
                  !!bank &&
                  !!(bank.accountHolder || bank.bankName || bank.accountNumber || bank.ifsc || bank.passbookUrl);
                return (
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Bank details</div>
                    {hasBank ? (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <div>
                            <span className="text-gray-500">Account holder: </span>
                            {bank?.accountHolder || '—'}
                          </div>
                          <div>
                            <span className="text-gray-500">Bank: </span>
                            {bank?.bankName || '—'}
                          </div>
                          <div>
                            <span className="text-gray-500">Account no.: </span>
                            {bank?.accountNumber || '—'}
                          </div>
                          <div>
                            <span className="text-gray-500">IFSC: </span>
                            {bank?.ifsc || '—'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No bank details submitted.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {tab === 'stats' && (
            <div className="space-y-4">
              {statsQuery.isLoading ? (
                <LoadingSpinner />
              ) : !statsQuery.data ? (
                <p className="text-sm text-gray-500">No stats available.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard
                      label="This week"
                      value={formatGBP(statsQuery.data.earnings?.thisWeek)}
                    />
                    <StatCard
                      label="This month"
                      value={formatGBP(statsQuery.data.earnings?.thisMonth)}
                    />
                    <StatCard
                      label="All-time"
                      value={formatGBP(statsQuery.data.earnings?.total)}
                    />
                  </div>
                  <Section title="Rides by status">
                    <div className="col-span-full grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(statsQuery.data.rides?.byStatus ?? {}).map(
                        ([status, count]) => (
                          <div
                            key={status}
                            className="bg-gray-50 rounded p-2 flex items-center justify-between"
                          >
                            <RideStatusPill status={status} />
                            <span className="font-semibold">{String(count)}</span>
                          </div>
                        ),
                      )}
                    </div>
                  </Section>
                  <Section title="Activity">
                    <KV label="Total rides">{statsQuery.data.rides?.total ?? 0}</KV>
                  </Section>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>

    {docRejectTarget && (
      <Modal
        isOpen
        onClose={() => setDocRejectTarget(null)}
        title="Reject Document"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Rejecting <span className="font-medium capitalize">{docRejectTarget.type.replace(/_/g, ' ')}</span>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rejection note (optional)</label>
            <input
              autoFocus
              className="input w-full"
              placeholder="e.g. Document is blurry, expired…"
              value={docRejectNote}
              onChange={(e) => setDocRejectNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button className="btn btn-secondary" onClick={() => setDocRejectTarget(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                onAction.verifyDocument({
                  documentType: docRejectTarget.type,
                  status: 'rejected',
                  note: docRejectNote.trim() || undefined,
                });
                setDocRejectTarget(null);
              }}
            >
              Confirm Reject
            </button>
          </div>
        </div>
      </Modal>
    )}
  </>
  );
}

function Avatar({ driver, size = 40 }: { driver: Driver; size?: number }) {
  const initials = `${driver.firstName?.[0] ?? ''}${driver.lastName?.[0] ?? ''}`.toUpperCase();
  if (driver.avatar) {
    return (
      <img
        src={driver.avatar}
        alt={initials}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-medium"
    >
      {initials || <Car className="w-1/2 h-1/2" />}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="flex items-center gap-1 mt-0.5">
        {icon}
        <div className="text-lg font-semibold text-gray-900">{value}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-3">
      <div className="text-xs font-semibold uppercase text-gray-500 mb-2">{title}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">{children}</div>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs text-gray-500">{label}: </span>
      <span className="text-gray-800">{children}</span>
    </div>
  );
}

function docStatusIcon(status: string) {
  if (status === 'verified') return <CheckCircle className="w-5 h-5 text-green-500" />;
  if (status === 'rejected') return <XCircle className="w-5 h-5 text-red-500" />;
  return <FileText className="w-5 h-5 text-yellow-500" />;
}

function RideStatusPill({ status }: { status: string }) {
  const tone =
    status === 'completed'
      ? 'bg-green-100 text-green-700'
      : status === 'cancelled'
        ? 'bg-red-100 text-red-700'
        : status === 'in_progress'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-gray-100 text-gray-700';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
        tone,
      )}
    >
      <Activity className="w-3 h-3" />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function driverStatusLabel(d: Driver): string {
  if (!d.isActive) return 'suspended';
  if (!d.isVerified) return 'pending';
  return 'verified';
}

// The service category the driver registered for. Mirrors
// User.driverProfile.serviceType on the backend ('instant' | 'private' |
// 'scheduled'). Older drivers onboarded before this field existed show "—".
function ServiceTypeBadge({
  serviceType,
}: {
  serviceType?: 'instant' | 'private' | 'scheduled';
}) {
  if (!serviceType) return <span className="text-gray-400 text-sm">—</span>;
  const config = {
    instant: { label: 'Instant', icon: Zap, cls: 'bg-green-100 text-green-700' },
    scheduled: { label: 'Scheduled', icon: Calendar, cls: 'bg-blue-100 text-blue-700' },
    private: { label: 'Private', icon: Lock, cls: 'bg-purple-100 text-purple-700' },
  }[serviceType];
  const Icon = config.icon;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
        config.cls,
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// Leaflet bundlers strip default marker icon URLs — rebind once per module
// load. Same approach the LiveMapPage uses; safe to call repeatedly.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// 5km radius is the upper bound the admin should ever see. We pick a zoom
// level whose horizontal coverage at the driver's latitude is roughly 10km
// (so the 5km circle fits with a little breathing room) and lock the zoom
// + pan bounds to that. Without this, an admin could zoom out to a country
// view, which the spec forbids.
const RADIUS_KM = 5;
const RADIUS_M = RADIUS_KM * 1000;

function FitToRadius({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    // Build a bounding box ~RADIUS_KM around the center, then fit the map to
    // it. fitBounds picks the best zoom that shows the whole box; we then
    // freeze that zoom as both min and max so the user can't drift further.
    const latDelta = RADIUS_KM / 111;
    const lngDelta =
      RADIUS_KM /
      (111 * Math.cos((center[0] * Math.PI) / 180) || 111);
    const bounds = L.latLngBounds(
      [center[0] - latDelta, center[1] - lngDelta],
      [center[0] + latDelta, center[1] + lngDelta],
    );
    map.fitBounds(bounds, { animate: false, padding: [10, 10] });
    const z = map.getZoom();
    map.setMinZoom(z);
    map.setMaxZoom(z + 4); // allow zooming IN for detail, never OUT past 20km
    map.setMaxBounds(bounds.pad(0.25));
  }, [center, map]);
  return null;
}

function DriverLiveLocationSection({
  location,
  isOnline,
  driverName,
  updatedAt,
}: {
  location?: { lat: number; lng: number };
  isOnline: boolean;
  driverName: string;
  updatedAt?: string | Date;
}) {
  return (
    <div className="border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase text-gray-500">
          Live location
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span
            className={clsx(
              'inline-block w-2 h-2 rounded-full',
              isOnline ? 'bg-green-500' : 'bg-gray-400',
            )}
          />
          {isOnline ? 'Online' : 'Offline'}
          {updatedAt && (
            <span className="ml-2">
              · updated {format(new Date(updatedAt), 'p')}
            </span>
          )}
        </div>
      </div>

      {location ? (
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <MapContainer
            key={`${location.lat.toFixed(4)}-${location.lng.toFixed(4)}`}
            center={[location.lat, location.lng]}
            zoom={11}
            style={{ height: 280, width: '100%' }}
            scrollWheelZoom={false}
            doubleClickZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitToRadius center={[location.lat, location.lng]} />
            <Circle
              center={[location.lat, location.lng]}
              radius={RADIUS_M}
              pathOptions={{
                color: '#0097B3',
                fillColor: '#0097B3',
                fillOpacity: 0.08,
                weight: 1,
              }}
            />
            <Marker position={[location.lat, location.lng]} title={driverName} />
          </MapContainer>
          <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 flex items-center justify-between">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </span>
            <span>{RADIUS_KM} km radius · OpenStreetMap</span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          <MapPin className="w-5 h-5 mx-auto mb-1 text-gray-400" />
          {isOnline
            ? 'Driver is online but has not reported a location yet.'
            : 'Last known location not available.'}
        </div>
      )}
    </div>
  );
}
