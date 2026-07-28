import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ridesAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal, ConfirmModal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner, RefreshButton } from '@/components/common';
import {
  Search,
  Eye,
  MapPin,
  Clock,
  CreditCard,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Navigation,
  UserPlus,
  KeyRound,
  Flag,
  CalendarClock,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, differenceInMinutes } from 'date-fns';
import clsx from 'clsx';
import type { Ride } from '@/types';

type TabType = 'all' | 'scheduled' | 'live' | 'disputes';

function NumInput({
  value,
  onChange,
  min,
  max,
  step,
  className = 'input',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: string;
  className?: string;
}) {
  const [text, setText] = useState<string>(String(value ?? 0));
  const [prevVal, setPrevVal] = useState<number>(value);

  if (value !== prevVal) {
    setPrevVal(value);
    setText(String(value ?? 0));
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed)) {
          onChange(parsed);
        } else if (e.target.value === '') {
          onChange(0);
        }
      }}
      onBlur={() => {
        const parsed = parseFloat(text);
        const finalVal = isNaN(parsed) ? 0 : parsed;
        setText(String(finalVal));
        onChange(finalVal);
      }}
      className={className}
    />
  );
}

export default function RidesPage() {
  // Honour a ?tab= deep-link (e.g. the dashboard's "Live Rides" → ?tab=live
  // and "Disputes" → ?tab=disputes quick actions). Falls back to "all".
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType | null;
  const [tab, setTab] = useState<TabType>(
    tabParam && ['all', 'scheduled', 'live', 'disputes'].includes(tabParam) ? tabParam : 'all',
  );
  const [page, setPage] = useState(1);
  // ── Filters (shared across tabs; each tab uses the subset that applies) ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [rideTypeFilter, setRideTypeFilter] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [minFare, setMinFare] = useState<string>('');
  const [maxFare, setMaxFare] = useState<string>('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showFareModal, setShowFareModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [rideToComplete, setRideToComplete] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundPercentage, setRefundPercentage] = useState(100);
  const [newDriverId, setNewDriverId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [newFare, setNewFare] = useState(0);
  const [fareReason, setFareReason] = useState('');
  const [disputeResolution, setDisputeResolution] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [disputeNotes, setDisputeNotes] = useState('');
  // Manual driver-assign modal — for `searching` rides where no driver
  // picked up the auto-dispatch. Admin types a name/phone, gets the
  // matching drivers within 7 km of the pickup, and clicks one to assign.
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignSearchDebounced, setAssignSearchDebounced] = useState('');
  // OTP-confirm modal — admin types the 4-digit code the customer reads
  // out (or copies from the ride doc) so we can start the trip from the
  // admin console without needing the driver app to type it in.
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const queryClient = useQueryClient();

  // Debounce the assign-modal search so we don't fire a request on every
  // keystroke. 250ms — short enough to feel live, long enough that typing
  // a 10-digit phone doesn't kick off 10 round-trips.
  useEffect(() => {
    const t = setTimeout(() => setAssignSearchDebounced(assignSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [assignSearch]);

  // Debounce the free-text/number filters (search + fare range) so typing
  // doesn't fire a request per keystroke. Discrete selects (status, type,
  // payment, dates) are applied immediately and don't need this.
  const [debouncedText, setDebouncedText] = useState({ search: '', minFare: '', maxFare: '' });
  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedText({ search: search.trim(), minFare: minFare.trim(), maxFare: maxFare.trim() }),
      350,
    );
    return () => clearTimeout(t);
  }, [search, minFare, maxFare]);

  // Are any filters active? Drives the "Clear filters" affordance.
  const hasActiveFilters =
    !!search || !!statusFilter || !!rideTypeFilter || !!paymentFilter ||
    !!startDate || !!endDate || !!minFare || !!maxFare;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setRideTypeFilter('');
    setPaymentFilter('');
    setStartDate('');
    setEndDate('');
    setMinFare('');
    setMaxFare('');
    setPage(1);
  };

  // Reset filters that don't apply when moving between tabs, and jump back
  // to page 1 so the new tab starts clean.
  const switchTab = (next: TabType) => {
    setTab(next);
    setPage(1);
    clearFilters();
  };

  // Nearby drivers within 7 km, filtered by the search box. Only runs when
  // the modal is open and we have a ride id — no point pre-fetching.
  const { data: assignNearby, isLoading: assignLoading } = useQuery({
    queryKey: ['admin-assign-nearby', selectedRide?._id, assignSearchDebounced],
    queryFn: async () => {
      if (!selectedRide?._id) return { drivers: [], radiusKm: 7 };
      const res = await ridesAPI.nearbyDrivers(selectedRide._id, assignSearchDebounced || undefined);
      return res.data?.data ?? { drivers: [], radiusKm: 7 };
    },
    enabled: showAssignModal && !!selectedRide?._id,
    refetchInterval: showAssignModal ? 15000 : false,
  });

  const assignMutation = useMutation({
    mutationFn: ({ rideId, driverId }: { rideId: string; driverId: string }) =>
      ridesAPI.assignDriver(rideId, driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rides'] });
      toast.success('Driver assigned — alerts sent');
      setShowAssignModal(false);
      setAssignSearch('');
      setAssignSearchDebounced('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to assign driver';
      toast.error(msg);
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ rideId, otp }: { rideId: string; otp: string }) =>
      ridesAPI.verifyOtp(rideId, otp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rides'] });
      toast.success('Trip started — both apps notified');
      setShowOtpModal(false);
      setOtpInput('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'OTP verification failed';
      toast.error(msg);
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ rideId }: { rideId: string }) => ridesAPI.complete(rideId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rides'] });
      toast.success('Ride completed — both apps notified');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to complete ride';
      toast.error(msg);
    },
  });

  // Assemble the query params from the active filters. The same shape works
  // for the all / scheduled / disputes endpoints; `live` filters client-side.
  const buildParams = () => {
    const params: Record<string, any> = { page, limit: 10 };
    if (debouncedText.search) params.search = debouncedText.search;
    if (statusFilter) params.status = statusFilter;
    if (rideTypeFilter) params.rideType = rideTypeFilter;
    if (paymentFilter) params.paymentMethod = paymentFilter;
    // Send the raw YYYY-MM-DD strings — converting local midnight to a UTC
    // ISO string shifted the day boundary for IST admins. The backend
    // interprets these as inclusive day bounds.
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (debouncedText.minFare) params.minFare = Number(debouncedText.minFare);
    if (debouncedText.maxFare) params.maxFare = Number(debouncedText.maxFare);
    return params;
  };

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'rides', tab, page, debouncedText, statusFilter, rideTypeFilter,
      paymentFilter, startDate, endDate,
    ],
    queryFn: async () => {
      const params = buildParams();

      if (tab === 'live') {
        // Live returns the full active set; filtering is applied client-side
        // (see `liveRides` below) so the 10s auto-refresh stays cheap.
        const res = await ridesAPI.getLive();
        return { data: res.data.data?.rides ?? [], pagination: null };
      }
      if (tab === 'scheduled') {
        const res = await ridesAPI.getScheduled(params);
        return {
          data: res.data?.data?.rides ?? [],
          pagination: res.data?.data?.pagination ?? null,
        };
      }
      if (tab === 'disputes') {
        const res = await ridesAPI.getDisputes(params);
        return {
          data: res.data?.data?.rides ?? [],
          pagination: res.data?.data?.pagination ?? null,
        };
      }
      const res = await ridesAPI.getAll(params);
      return {
        data: res.data?.data?.rides ?? [],
        pagination: res.data?.data?.pagination ?? null,
      };
    },
    refetchInterval: tab === 'live' ? 10000 : false,
  });

  // Client-side filtering for the Live tab — the endpoint has no query
  // params, so we apply the same filters to the fetched active rides.
  const matchesCategory = (ride: Ride) => {
    if (!rideTypeFilter) return true;
    if (rideTypeFilter === 'scheduled') return !!ride.isScheduled;
    if (rideTypeFilter === 'private') return ride.isPrivate === true;
    if (rideTypeFilter === 'instant') return !ride.isScheduled && !ride.isPrivate;
    return ride.rideType === rideTypeFilter;
  };
  const liveRides: Ride[] = (data?.data || []).filter((ride: Ride) => {
    if (tab !== 'live') return true;
    if (statusFilter && ride.status !== statusFilter) return false;
    if (paymentFilter && ride.paymentMethod !== paymentFilter) return false;
    if (!matchesCategory(ride)) return false;
    const fare = ride.actualFare ?? ride.estimatedFare ?? 0;
    if (debouncedText.minFare && fare < Number(debouncedText.minFare)) return false;
    if (debouncedText.maxFare && fare > Number(debouncedText.maxFare)) return false;
    if (debouncedText.search) {
      const q = debouncedText.search.toLowerCase();
      const hay = [
        ride._id,
        ride.customer?.firstName, ride.customer?.lastName, ride.customer?.phone,
        ride.driver?.firstName, ride.driver?.lastName, ride.driver?.phone,
        ride.pickup?.address, ride.dropoff?.address,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const cancelMutation = useMutation({
    // Shuttle seat reservations carry a `sched_` id and live in a separate
    // collection, so they take the booking-cancel endpoint; everything else
    // is a real Ride.
    mutationFn: ({ id, reason, refundPct }: { id: string; reason: string; refundPct: number }) =>
      id.startsWith('sched_')
        ? ridesAPI.cancelScheduledBooking(id, reason)
        : ridesAPI.cancel(id, reason, refundPct),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rides'] });
      toast.success('Ride cancelled');
      setShowCancelModal(false);
      setCancelReason('');
    },
    onError: () => toast.error('Failed to cancel ride'),
  });

  const reassignMutation = useMutation({
    mutationFn: ({ id, driverId, reason }: { id: string; driverId: string; reason: string }) =>
      ridesAPI.reassign(id, driverId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rides'] });
      toast.success('Ride reassigned');
      setShowReassignModal(false);
      setNewDriverId('');
      setReassignReason('');
    },
    onError: () => toast.error('Failed to reassign ride'),
  });

  const adjustFareMutation = useMutation({
    mutationFn: ({ id, fare, reason }: { id: string; fare: number; reason: string }) =>
      ridesAPI.adjustFare(id, fare, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rides'] });
      toast.success('Fare adjusted');
      setShowFareModal(false);
      setNewFare(0);
      setFareReason('');
    },
    onError: () => toast.error('Failed to adjust fare'),
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: ({ id, resolution, refund, notes }: { id: string; resolution: string; refund?: number; notes?: string }) =>
      ridesAPI.resolveDispute(id, resolution, refund, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rides'] });
      toast.success('Dispute resolved');
      setShowDisputeModal(false);
      setDisputeResolution('');
      setRefundAmount(0);
      setDisputeNotes('');
    },
    onError: () => toast.error('Failed to resolve dispute'),
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'searching':
        return 'text-yellow-600 bg-yellow-50';
      case 'driver_assigned':
      case 'driver_arriving':
      case 'driver_arrived':
        return 'text-blue-600 bg-blue-50';
      case 'in_progress':
        return 'text-indigo-600 bg-indigo-50';
      case 'payment_pending':
        return 'text-amber-600 bg-amber-50';
      case 'reserved':
        return 'text-blue-600 bg-blue-50';
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'cancelled':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const columns = [
    {
      key: 'ride',
      header: 'Ride',
      render: (ride: Ride) => (
        <div>
          <div className="font-medium text-gray-900">#{ride._id.slice(-8).toUpperCase()}</div>
          <div className="text-sm text-gray-500">
            {format(new Date(ride.createdAt), 'MMM d, yyyy HH:mm')}
          </div>
          {ride.isScheduled && ride.scheduledAt && (
            <div className="flex items-center gap-1 text-xs text-blue-600 mt-0.5">
              <CalendarClock className="w-3 h-3" />
              Departs {format(new Date(ride.scheduledAt), 'MMM d, HH:mm')}
            </div>
          )}
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
            ride.isScheduled
              ? 'bg-blue-100 text-blue-700'
              : ride.isPrivate === true
              ? 'bg-purple-100 text-purple-700'
              : 'bg-green-100 text-green-700'
          }`}>
            {ride.isScheduled ? 'Scheduled' : ride.isPrivate === true ? 'Private' : 'Instant'}
          </span>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (ride: Ride) => (
        <div className="max-w-xs">
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5" />
            <span className="truncate">{ride.pickup?.address || 'N/A'}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5" />
            <span className="truncate">{ride.dropoff?.address || 'N/A'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (ride: Ride) => (
        <div className="text-sm">
          <div className="font-medium">
            {ride.customer?.firstName} {ride.customer?.lastName}
          </div>
          <div className="text-gray-500">{ride.customer?.phone}</div>
        </div>
      ),
    },
    {
      key: 'driver',
      header: 'Driver',
      render: (ride: Ride) => (
        ride.driver ? (
          <div className="text-sm">
            <div className="font-medium">
              {ride.driver?.firstName} {ride.driver?.lastName}
            </div>
            <div className="text-gray-500">{ride.driver?.driverProfile?.plateNumber}</div>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'fare',
      header: 'Fare',
      render: (ride: Ride) => (
        <div className="font-medium">₹{(ride.actualFare ?? ride.estimatedFare ?? 0).toFixed(2)}</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (ride: Ride) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={ride.status} />
          {ride.dispute?.status === 'open' && (
            <span className="badge badge-warning">Disputed</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (ride: Ride) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRide(ride);
              setShowDetails(true);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
          {/* Cancel is allowed for any non-terminal ride — instant, private,
              scheduled, or a shuttle seat reservation (status 'reserved'). */}
          {!['completed', 'cancelled'].includes(ride.status) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRide(ride);
                setShowCancelModal(true);
              }}
              className="p-2 hover:bg-red-50 rounded-lg"
              title="Cancel Ride"
            >
              <XCircle className="w-4 h-4 text-red-500" />
            </button>
          )}
          {['searching', 'driver_assigned', 'driver_arriving', 'driver_arrived', 'in_progress', 'payment_pending'].includes(ride.status) && (
            <>
              {ride.driver && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRide(ride);
                    setShowReassignModal(true);
                  }}
                  className="p-2 hover:bg-blue-50 rounded-lg"
                  title="Reassign Driver"
                >
                  <RefreshCw className="w-4 h-4 text-blue-500" />
                </button>
              )}
              {ride.status === 'searching' && !ride.driver && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRide(ride);
                    setAssignSearch('');
                    setAssignSearchDebounced('');
                    setShowAssignModal(true);
                  }}
                  className="p-2 hover:bg-emerald-50 rounded-lg"
                  title="Manually assign a driver"
                >
                  <UserPlus className="w-4 h-4 text-emerald-500" />
                </button>
              )}
              {['driver_assigned', 'driver_arriving', 'driver_arrived'].includes(ride.status) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRide(ride);
                    setOtpInput('');
                    setShowOtpModal(true);
                  }}
                  className="p-2 hover:bg-amber-50 rounded-lg"
                  title="Verify pickup OTP and start trip"
                >
                  <KeyRound className="w-4 h-4 text-amber-500" />
                </button>
              )}
              {ride.status === 'in_progress' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRideToComplete(ride._id);
                    setShowCompleteModal(true);
                  }}
                  className="p-2 hover:bg-violet-50 rounded-lg"
                  title="Complete ride"
                >
                  <Flag className="w-4 h-4 text-violet-500" />
                </button>
              )}
            </>
          )}
          {ride.status === 'completed' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRide(ride);
                setNewFare(ride.actualFare ?? ride.estimatedFare ?? 0);
                setShowFareModal(true);
              }}
              className="p-2 hover:bg-yellow-50 rounded-lg"
              title="Adjust Fare"
            >
              <CreditCard className="w-4 h-4 text-yellow-500" />
            </button>
          )}
          {ride.dispute?.status === 'open' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRide(ride);
                setShowDisputeModal(true);
              }}
              className="p-2 hover:bg-orange-50 rounded-lg"
              title="Resolve Dispute"
            >
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Ride Management"
        subtitle="Monitor and manage all rides"
        actions={<RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {[
          { key: 'all', label: 'All Rides', icon: MapPin },
          { key: 'scheduled', label: 'Scheduled', icon: CalendarClock },
          { key: 'live', label: 'Live Tracking', icon: Navigation },
          { key: 'disputes', label: 'Disputes', icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => switchTab(key as TabType)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Filters — shared across every tab. The Live tab applies them
          client-side; the others pass them through to the API. */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ride ID, customer, or driver..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input pl-10"
            />
          </div>

          {/* Status — options adapt to the active tab */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input w-full lg:w-44"
            title="Filter by status"
          >
            <option value="">All Status</option>
            {tab === 'disputes' ? (
              <>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </>
            ) : tab === 'live' ? (
              <>
                <option value="searching">Searching</option>
                <option value="driver_assigned">Driver Assigned</option>
                <option value="driver_arriving">Driver Arriving</option>
                <option value="driver_arrived">Driver Arrived</option>
                <option value="in_progress">In Progress</option>
              </>
            ) : tab === 'scheduled' ? (
              <>
                <option value="reserved">Reserved (Shuttle)</option>
                <option value="searching">Searching</option>
                <option value="driver_assigned">Driver Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </>
            ) : (
              <>
                <option value="searching">Searching</option>
                <option value="driver_assigned">Driver Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="payment_pending">Payment Pending</option>
                <option value="reserved">Reserved (Scheduled)</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </>
            )}
          </select>

          {/* Ride type category */}
          <select
            value={rideTypeFilter}
            onChange={(e) => {
              setRideTypeFilter(e.target.value);
              setPage(1);
            }}
            className="input w-full lg:w-40"
            title="Filter by ride type"
          >
            <option value="">All Types</option>
            <option value="instant">Instant</option>
            <option value="private">Private</option>
            <option value="scheduled">Scheduled</option>
          </select>

          {/* Payment method */}
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
            className="input w-full lg:w-40"
            title="Filter by payment method"
          >
            <option value="">All Payments</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="wallet">Wallet</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
          {/* Date range — filters the scheduled departure on the Scheduled
              tab, otherwise the booking-created date. */}
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="input w-full sm:w-40"
              title={tab === 'scheduled' ? 'Departure from' : 'From date'}
            />
            <span className="text-gray-400">–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="input w-full sm:w-40"
              title={tab === 'scheduled' ? 'Departure to' : 'To date'}
            />
          </div>

          {/* Fare range */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500 shrink-0">₹</span>
            <input
              type="number"
              placeholder="Min fare"
              value={minFare}
              onChange={(e) => {
                setMinFare(e.target.value);
                setPage(1);
              }}
              className="input w-28"
              min={0}
            />
            <span className="text-gray-400">–</span>
            <input
              type="number"
              placeholder="Max fare"
              value={maxFare}
              onChange={(e) => {
                setMaxFare(e.target.value);
                setPage(1);
              }}
              className="input w-28"
              min={0}
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Live Tracking View */}
      {tab === 'live' && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {liveRides.map((ride: Ride) => (
            <div
              key={ride._id}
              className={clsx(
                'rounded-lg p-4 cursor-pointer transition-all hover:shadow-md',
                getStatusColor(ride.status)
              )}
              onClick={() => {
                setSelectedRide(ride);
                setShowDetails(true);
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">#{ride._id.slice(-8).toUpperCase()}</span>
                <StatusBadge status={ride.status} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5" />
                  <span className="truncate">{ride.pickup?.address}</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5" />
                  <span className="truncate">{ride.dropoff?.address}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-current/20 flex items-center justify-between">
                <span>{ride.customer?.firstName} {ride.customer?.lastName}</span>
                <span className="font-medium">₹{(ride.actualFare ?? ride.estimatedFare ?? 0).toFixed(2)}</span>
              </div>
            </div>
          ))}
          {liveRides.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              {hasActiveFilters
                ? 'No active rides match the current filters'
                : 'No active rides at the moment'}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {tab !== 'live' && (
        isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={data?.data || []}
              keyExtractor={(ride) => ride._id}
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
        )
      )}

      {/* Complete Ride Confirm Modal */}
      <ConfirmModal
        isOpen={showCompleteModal}
        onClose={() => { setShowCompleteModal(false); setRideToComplete(null); }}
        onConfirm={() => {
          if (rideToComplete) completeMutation.mutate({ rideId: rideToComplete });
          setShowCompleteModal(false);
          setRideToComplete(null);
        }}
        title="Complete Ride"
        message="Mark this ride as completed? Both the customer and driver will be notified and the fare will be settled."
        confirmText="Complete Ride"
        cancelText="Cancel"
        variant="info"
        isLoading={completeMutation.isPending}
      />

      {/* Ride Details Modal */}
      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Ride Details"
        size="xl"
      >
        {selectedRide && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">
                  Ride #{selectedRide._id.slice(-8).toUpperCase()}
                </div>
                <div className="text-sm text-gray-500">
                  {format(new Date(selectedRide.createdAt), 'PPpp')}
                </div>
              </div>
              <StatusBadge status={selectedRide.status} />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Route</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full mt-1" />
                    <div>
                      <div className="text-sm font-medium">Pickup</div>
                      <div className="text-sm text-gray-600">{selectedRide.pickup?.address}</div>
                    </div>
                  </div>
                  {selectedRide.stops?.map((stop, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mt-1" />
                      <div>
                        <div className="text-sm font-medium">Stop {idx + 1}</div>
                        <div className="text-sm text-gray-600">{stop.address}</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full mt-1" />
                    <div>
                      <div className="text-sm font-medium">Dropoff</div>
                      <div className="text-sm text-gray-600">{selectedRide.dropoff?.address}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Fare Breakdown</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Base Fare</span>
                    <span>₹{(selectedRide.baseFare ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Distance Fare</span>
                    <span>₹{(selectedRide.distanceFare ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time Fare</span>
                    <span>₹{(selectedRide.timeFare ?? 0).toFixed(2)}</span>
                  </div>
                  {(selectedRide.surgeFare ?? 0) > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Surge</span>
                      <span>₹{selectedRide.surgeFare.toFixed(2)}</span>
                    </div>
                  )}
                  {(selectedRide.discount ?? 0) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-₹{selectedRide.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {(selectedRide.tip ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span>Tip</span>
                      <span>₹{selectedRide.tip.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedRide.status === 'completed' && (selectedRide.actualDistance ?? 0) > 0 && (
                    <div className="flex justify-between text-gray-500 text-xs">
                      <span>Distance</span>
                      <span>{(selectedRide.actualDistance ?? selectedRide.estimatedDistance ?? 0).toFixed(2)} km</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>₹{(selectedRide.actualFare ?? selectedRide.estimatedFare ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Customer</h4>
                <div className="text-sm">
                  <div>{selectedRide.customer?.firstName} {selectedRide.customer?.lastName}</div>
                  <div className="text-gray-500">{selectedRide.customer?.phone}</div>
                  <div className="text-gray-500">{selectedRide.customer?.email}</div>
                </div>
              </div>
              {selectedRide.driver ? (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Driver</h4>
                  <div className="text-sm">
                    <div>{selectedRide.driver?.firstName} {selectedRide.driver?.lastName}</div>
                    <div className="text-gray-500">{selectedRide.driver?.phone}</div>
                    <div className="text-gray-500">{selectedRide.driver?.driverProfile?.plateNumber}</div>
                  </div>
                </div>
              ) : selectedRide.status === 'searching' ? (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Driver</h4>
                  <div className="text-sm text-gray-500 mb-3">
                    Still searching — no driver has accepted yet.
                  </div>
                  <button
                    onClick={() => {
                      setAssignSearch('');
                      setAssignSearchDebounced('');
                      setShowAssignModal(true);
                    }}
                    className="btn btn-primary inline-flex items-center gap-2 text-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    Assign a nearby driver
                  </button>
                </div>
              ) : null}
            </div>

            {/* Lifecycle controls — confirm OTP / complete from admin while
                the driver app's flow isn't end-to-end. */}
            {['driver_assigned', 'driver_arriving', 'driver_arrived', 'in_progress'].includes(selectedRide.status) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div>
                  <h4 className="font-medium text-amber-900 mb-1">Test controls</h4>
                  <p className="text-xs text-amber-700">
                    Drive the ride lifecycle from admin while the driver app's
                    OTP/complete flow is still being wired. Both customer and
                    driver get socket + push notifications when you act here.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['driver_assigned', 'driver_arriving', 'driver_arrived'].includes(selectedRide.status) && (
                    <button
                      onClick={() => {
                        setOtpInput('');
                        setShowOtpModal(true);
                      }}
                      className="btn btn-primary inline-flex items-center gap-2 text-sm"
                    >
                      <KeyRound className="w-4 h-4" />
                      Verify OTP & start trip
                    </button>
                  )}
                  {selectedRide.status === 'in_progress' && (
                    <button
                      onClick={() => {
                        setRideToComplete(selectedRide._id);
                        setShowCompleteModal(true);
                      }}
                      disabled={completeMutation.isPending}
                      className="btn btn-primary inline-flex items-center gap-2 text-sm"
                    >
                      <Flag className="w-4 h-4" />
                      Complete ride
                    </button>
                  )}
                </div>
              </div>
            )}

            {(() => {
              const distKm = (selectedRide.actualDistance ?? selectedRide.estimatedDistance ?? 0);
              const startTime = selectedRide.startedAt;
              const endTime = selectedRide.completedAt;
              const durationMins = startTime && endTime
                ? differenceInMinutes(new Date(endTime), new Date(startTime))
                : (selectedRide.actualDuration ?? selectedRide.estimatedDuration ?? null);
              const durationLabel = durationMins != null
                ? durationMins < 60
                  ? `${durationMins} min`
                  : `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
                : '-';
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <MapPin className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                    <div className="text-lg font-semibold">{distKm > 0 ? `${distKm.toFixed(2)} km` : '-'}</div>
                    <div className="text-sm text-gray-500">Distance</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <Clock className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                    <div className="text-base font-semibold">{startTime ? format(new Date(startTime), 'HH:mm') : '-'}</div>
                    <div className="text-xs text-gray-400">{startTime ? format(new Date(startTime), 'MMM d') : ''}</div>
                    <div className="text-sm text-gray-500">Start</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <Clock className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                    <div className="text-base font-semibold">{endTime ? format(new Date(endTime), 'HH:mm') : '-'}</div>
                    <div className="text-xs text-gray-400">{endTime ? format(new Date(endTime), 'MMM d') : ''}</div>
                    <div className="text-sm text-gray-500">End</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <CreditCard className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                    <div className="text-base font-semibold">{durationLabel}</div>
                    <div className="text-sm text-gray-500">Duration</div>
                  </div>
                </div>
              );
            })()}

            {/* Mongoose materialises an empty `dispute` object on every ride,
                so gate on the fields only real disputes carry. */}
            {(selectedRide.dispute?.reason || selectedRide.dispute?.status === 'resolved') && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Dispute
                </h4>
                <p className="text-sm text-red-800">{selectedRide.dispute.reason || 'Flagged for review'}</p>
                {selectedRide.dispute.resolution && (
                  <p className="text-sm text-red-700 mt-2">
                    <strong>Resolution:</strong> {selectedRide.dispute.resolution}
                  </p>
                )}
              </div>
            )}

            {selectedRide.status === 'cancelled' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Cancellation
                </h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <div>
                    <span className="text-gray-500">Cancelled by: </span>
                    <span className="font-medium capitalize">
                      {selectedRide.cancellation?.cancelledBy ?? 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Reason: </span>
                    {selectedRide.cancellation?.reason || 'No reason provided'}
                  </div>
                  {selectedRide.cancellation?.cancelledAt && (
                    <div className="text-xs text-gray-400">
                      {format(new Date(selectedRide.cancellation.cancelledAt), 'PPpp')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Admin can cancel any non-terminal ride — including scheduled
                rides and shuttle seat reservations — straight from here. */}
            {!['completed', 'cancelled'].includes(selectedRide.status) && (
              <div className="flex justify-end border-t pt-4">
                <button
                  onClick={() => {
                    setShowDetails(false);
                    setShowCancelModal(true);
                  }}
                  className="btn btn-danger inline-flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel this ride
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancelReason('');
        }}
        title="Cancel Ride"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cancellation Reason *
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Enter reason..."
            />
          </div>
          {/* Shuttle seat reservations are cancelled via the booking endpoint,
              which doesn't process refunds — hide the field for those. */}
          {!selectedRide?._id.startsWith('sched_') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Refund Percentage
              </label>
              <NumInput
                value={refundPercentage}
                onChange={setRefundPercentage}
                className="input"
                min={0}
                max={100}
              />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowCancelModal(false)} className="btn btn-secondary">
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedRide && cancelReason.trim()) {
                  cancelMutation.mutate({
                    id: selectedRide._id,
                    reason: cancelReason.trim(),
                    refundPct: refundPercentage,
                  });
                }
              }}
              className="btn btn-danger"
              disabled={!cancelReason.trim() || cancelMutation.isPending}
            >
              Cancel Ride
            </button>
          </div>
        </div>
      </Modal>

      {/* Reassign Modal */}
      <Modal
        isOpen={showReassignModal}
        onClose={() => {
          setShowReassignModal(false);
          setNewDriverId('');
          setReassignReason('');
        }}
        title="Reassign Driver"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Driver ID *
            </label>
            <input
              type="text"
              value={newDriverId}
              onChange={(e) => setNewDriverId(e.target.value)}
              className="input"
              placeholder="Enter driver ID..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <textarea
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              className="input"
              rows={2}
              placeholder="Enter reason..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowReassignModal(false)} className="btn btn-secondary">
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedRide && newDriverId.trim() && reassignReason.trim()) {
                  reassignMutation.mutate({
                    id: selectedRide._id,
                    driverId: newDriverId.trim(),
                    reason: reassignReason.trim(),
                  });
                }
              }}
              className="btn btn-primary"
              disabled={!newDriverId.trim() || !reassignReason.trim() || reassignMutation.isPending}
            >
              Reassign
            </button>
          </div>
        </div>
      </Modal>

      {/* Manual Driver Assign Modal — for searching rides where auto-dispatch
          didn't land. Lists drivers within 7 km of the pickup, filterable
          by name or phone. Clicking a row force-assigns and triggers the
          ride:driver-assigned / ride:assigned events on the customer and
          driver apps respectively. */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setAssignSearch('');
          setAssignSearchDebounced('');
        }}
        title="Assign a nearby driver"
        size="lg"
      >
        {selectedRide && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Pickup: <span className="font-medium text-gray-900">{selectedRide.pickup?.address}</span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                placeholder="Search by driver name or phone number…"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="text-xs text-gray-500">
              Showing online drivers within {assignNearby?.radiusKm ?? 7} km of the pickup.
              {assignNearby?.drivers?.length ? ` ${assignNearby.drivers.length} match${assignNearby.drivers.length === 1 ? '' : 'es'}.` : ''}
            </div>

            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {assignLoading ? (
                <div className="p-6 text-center">
                  <LoadingSpinner />
                </div>
              ) : !assignNearby?.drivers?.length ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  {assignSearchDebounced
                    ? `No drivers within 7 km matching "${assignSearchDebounced}".`
                    : 'No online drivers within 7 km of the pickup.'}
                </div>
              ) : (
                assignNearby.drivers.map((d: any) => {
                  const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Driver';
                  const vehicle = [d.vehicle?.color, d.vehicle?.make, d.vehicle?.model]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <div
                      key={d._id}
                      className="flex items-center justify-between p-3 hover:bg-emerald-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{fullName}</div>
                        <div className="text-xs text-gray-500">{d.phone}</div>
                        {vehicle && (
                          <div className="text-xs text-gray-500 truncate">
                            {vehicle}
                            {d.vehicle?.plate ? ` · ${d.vehicle.plate}` : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">{d.distanceKm.toFixed(1)} km</div>
                          <div className="text-xs text-gray-500">★ {(d.rating ?? 5).toFixed(1)}</div>
                        </div>
                        <button
                          onClick={() => {
                            if (!selectedRide?._id) return;
                            assignMutation.mutate({
                              rideId: selectedRide._id,
                              driverId: d._id,
                            });
                          }}
                          disabled={assignMutation.isPending}
                          className="btn btn-primary text-xs px-3 py-1.5"
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssignSearch('');
                  setAssignSearchDebounced('');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Pickup-OTP confirmation. Same effect as the driver typing the
          rider's OTP — flips status to in_progress and broadcasts to
          both apps. */}
      <Modal
        isOpen={showOtpModal}
        onClose={() => {
          setShowOtpModal(false);
          setOtpInput('');
        }}
        title="Verify pickup OTP"
      >
        {selectedRide && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Confirm the 4-digit OTP the rider reads out to the driver.
              The system OTP for this ride is{' '}
              <span className="font-mono font-semibold text-gray-900">
                {(selectedRide as any).pickupOtp ?? '— already used —'}
              </span>
              .
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OTP *
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-mono tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtpInput('');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedRide?._id && otpInput.length === 4) {
                    verifyOtpMutation.mutate({
                      rideId: selectedRide._id,
                      otp: otpInput,
                    });
                  }
                }}
                disabled={otpInput.length !== 4 || verifyOtpMutation.isPending}
                className="btn btn-primary"
              >
                Verify & start trip
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Fare Adjustment Modal */}
      <Modal
        isOpen={showFareModal}
        onClose={() => {
          setShowFareModal(false);
          setNewFare(0);
          setFareReason('');
        }}
        title="Adjust Fare"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Original Fare
            </label>
            <div className="text-lg font-semibold">₹{(selectedRide?.actualFare ?? selectedRide?.estimatedFare ?? 0).toFixed(2)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Fare *
            </label>
            <NumInput
              value={newFare}
              onChange={setNewFare}
              className="input"
              step="0.01"
              min={0}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <textarea
              value={fareReason}
              onChange={(e) => setFareReason(e.target.value)}
              className="input"
              rows={2}
              placeholder="Enter reason..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowFareModal(false)} className="btn btn-secondary">
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedRide && fareReason.trim()) {
                  adjustFareMutation.mutate({
                    id: selectedRide._id,
                    fare: newFare,
                    reason: fareReason.trim(),
                  });
                }
              }}
              className="btn btn-primary"
              disabled={!fareReason.trim() || newFare < 0 || adjustFareMutation.isPending}
            >
              Adjust Fare
            </button>
          </div>
        </div>
      </Modal>

      {/* Dispute Resolution Modal */}
      <Modal
        isOpen={showDisputeModal}
        onClose={() => {
          setShowDisputeModal(false);
          setDisputeResolution('');
          setRefundAmount(0);
          setDisputeNotes('');
        }}
        title="Resolve Dispute"
      >
        <div className="space-y-4">
          {selectedRide?.dispute && (
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-red-900">Dispute Reason:</div>
              <div className="text-sm text-red-800">{selectedRide.dispute.reason || 'Flagged for review'}</div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resolution *
            </label>
            <select
              value={disputeResolution}
              onChange={(e) => setDisputeResolution(e.target.value)}
              className="input"
            >
              <option value="">Select resolution...</option>
              <option value="refund_full">Full Refund</option>
              <option value="refund_partial">Partial Refund</option>
              <option value="no_action">No Action Required</option>
              <option value="driver_warning">Driver Warning</option>
              <option value="customer_warning">Customer Warning</option>
            </select>
          </div>
          {disputeResolution.includes('refund') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Refund Amount
              </label>
              <NumInput
                value={refundAmount}
                onChange={setRefundAmount}
                className="input"
                step="0.01"
                min={0}
                max={selectedRide?.actualFare ?? selectedRide?.estimatedFare ?? 0}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={disputeNotes}
              onChange={(e) => setDisputeNotes(e.target.value)}
              className="input"
              rows={3}
              placeholder="Additional notes..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowDisputeModal(false)} className="btn btn-secondary">
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedRide && disputeResolution) {
                  resolveDisputeMutation.mutate({
                    id: selectedRide._id,
                    resolution: disputeResolution,
                    refund: refundAmount || undefined,
                    notes: disputeNotes?.trim() || undefined,
                  });
                }
              }}
              className="btn btn-primary"
              disabled={!disputeResolution || resolveDisputeMutation.isPending}
            >
              Resolve
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
