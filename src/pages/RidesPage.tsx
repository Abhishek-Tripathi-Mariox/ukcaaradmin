import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ridesAPI } from '@/services/api';
import { DataTable, Pagination } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { PageHeader, StatusBadge, LoadingSpinner } from '@/components/common';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Ride } from '@/types';

type TabType = 'all' | 'live' | 'disputes';

export default function RidesPage() {
  const [tab, setTab] = useState<TabType>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showFareModal, setShowFareModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refundPercentage, setRefundPercentage] = useState(100);
  const [newDriverId, setNewDriverId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [newFare, setNewFare] = useState(0);
  const [fareReason, setFareReason] = useState('');
  const [disputeResolution, setDisputeResolution] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [disputeNotes, setDisputeNotes] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['rides', tab, page, search, statusFilter],
    queryFn: async () => {
      const params: any = { page, limit: 10 };
      if (search) params.search = search;
      
      if (tab === 'live') {
        const res = await ridesAPI.getLive();
        return { data: res.data.data, pagination: null };
      } else if (tab === 'disputes') {
        if (statusFilter) params.status = statusFilter;
        const res = await ridesAPI.getDisputes(params);
        return {
          data: res.data?.data?.rides ?? [],
          pagination: res.data?.data?.pagination ?? null,
        };
      } else {
        if (statusFilter) params.status = statusFilter;
        const res = await ridesAPI.getAll(params);
        return {
          data: res.data?.data?.rides ?? [],
          pagination: res.data?.data?.pagination ?? null,
        };
      }
    },
    refetchInterval: tab === 'live' ? 10000 : false,
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason, refundPct }: { id: string; reason: string; refundPct: number }) =>
      ridesAPI.cancel(id, reason, refundPct),
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
        <div className="font-medium">₹{ride.fare?.total?.toFixed(2) || '0.00'}</div>
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
          {['searching', 'driver_assigned', 'driver_arriving', 'driver_arrived', 'in_progress'].includes(ride.status) && (
            <>
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
            </>
          )}
          {ride.status === 'completed' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRide(ride);
                setNewFare(ride.fare?.total || 0);
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
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'all', label: 'All Rides', icon: MapPin },
          { key: 'live', label: 'Live Tracking', icon: Navigation },
          { key: 'disputes', label: 'Disputes', icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key as TabType);
              setPage(1);
              setStatusFilter('');
            }}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
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

      {/* Filters */}
      {tab !== 'live' && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
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
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input w-full sm:w-40"
          >
            <option value="">All Status</option>
            {tab === 'disputes' ? (
              <>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </>
            ) : (
              <>
                <option value="searching">Searching</option>
                <option value="driver_assigned">Driver Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </>
            )}
          </select>
        </div>
      )}

      {/* Live Tracking View */}
      {tab === 'live' && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {(data?.data || []).map((ride: Ride) => (
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
                <span className="font-medium">₹{ride.fare?.total?.toFixed(2)}</span>
              </div>
            </div>
          ))}
          {(data?.data || []).length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              No active rides at the moment
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
                    <span>₹{selectedRide.fare?.baseFare?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Distance Fare</span>
                    <span>₹{selectedRide.fare?.distanceFare?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time Fare</span>
                    <span>₹{selectedRide.fare?.timeFare?.toFixed(2) || '0.00'}</span>
                  </div>
                  {selectedRide.fare?.surgeFare > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Surge</span>
                      <span>₹{selectedRide.fare?.surgeFare?.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedRide.fare?.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-₹{selectedRide.fare?.discount?.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedRide.fare?.tip > 0 && (
                    <div className="flex justify-between">
                      <span>Tip</span>
                      <span>₹{selectedRide.fare?.tip?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>₹{selectedRide.fare?.total?.toFixed(2) || '0.00'}</span>
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
              {selectedRide.driver && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Driver</h4>
                  <div className="text-sm">
                    <div>{selectedRide.driver?.firstName} {selectedRide.driver?.lastName}</div>
                    <div className="text-gray-500">{selectedRide.driver?.phone}</div>
                    <div className="text-gray-500">{selectedRide.driver?.driverProfile?.plateNumber}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <MapPin className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                <div className="text-lg font-semibold">{selectedRide.distance?.toFixed(1) || '-'}</div>
                <div className="text-sm text-gray-500">miles</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <Clock className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                <div className="text-lg font-semibold">{selectedRide.duration || '-'}</div>
                <div className="text-sm text-gray-500">minutes</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <CreditCard className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                <div className="text-lg font-semibold capitalize">{selectedRide.paymentMethod}</div>
                <div className="text-sm text-gray-500">
                  <StatusBadge status={selectedRide.paymentStatus} />
                </div>
              </div>
            </div>

            {selectedRide.dispute && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Dispute
                </h4>
                <p className="text-sm text-red-800">{selectedRide.dispute.reason}</p>
                {selectedRide.dispute.resolution && (
                  <p className="text-sm text-red-700 mt-2">
                    <strong>Resolution:</strong> {selectedRide.dispute.resolution}
                  </p>
                )}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Refund Percentage
            </label>
            <input
              type="number"
              value={refundPercentage}
              onChange={(e) => setRefundPercentage(Number(e.target.value))}
              className="input"
              min={0}
              max={100}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCancelModal(false)} className="btn btn-secondary">
              Close
            </button>
            <button
              onClick={() => {
                if (selectedRide && cancelReason) {
                  cancelMutation.mutate({
                    id: selectedRide._id,
                    reason: cancelReason,
                    refundPct: refundPercentage,
                  });
                }
              }}
              className="btn btn-danger"
              disabled={!cancelReason || cancelMutation.isPending}
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
            <button onClick={() => setShowReassignModal(false)} className="btn btn-secondary">
              Close
            </button>
            <button
              onClick={() => {
                if (selectedRide && newDriverId && reassignReason) {
                  reassignMutation.mutate({
                    id: selectedRide._id,
                    driverId: newDriverId,
                    reason: reassignReason,
                  });
                }
              }}
              className="btn btn-primary"
              disabled={!newDriverId || !reassignReason || reassignMutation.isPending}
            >
              Reassign
            </button>
          </div>
        </div>
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
            <div className="text-lg font-semibold">₹{selectedRide?.fare?.total?.toFixed(2)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Fare *
            </label>
            <input
              type="number"
              value={newFare}
              onChange={(e) => setNewFare(Number(e.target.value))}
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
            <button onClick={() => setShowFareModal(false)} className="btn btn-secondary">
              Close
            </button>
            <button
              onClick={() => {
                if (selectedRide && fareReason) {
                  adjustFareMutation.mutate({
                    id: selectedRide._id,
                    fare: newFare,
                    reason: fareReason,
                  });
                }
              }}
              className="btn btn-primary"
              disabled={!fareReason || adjustFareMutation.isPending}
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
              <div className="text-sm text-red-800">{selectedRide.dispute.reason}</div>
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
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                className="input"
                step="0.01"
                min={0}
                max={selectedRide?.fare?.total || 0}
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
            <button onClick={() => setShowDisputeModal(false)} className="btn btn-secondary">
              Close
            </button>
            <button
              onClick={() => {
                if (selectedRide && disputeResolution) {
                  resolveDisputeMutation.mutate({
                    id: selectedRide._id,
                    resolution: disputeResolution,
                    refund: refundAmount || undefined,
                    notes: disputeNotes || undefined,
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
